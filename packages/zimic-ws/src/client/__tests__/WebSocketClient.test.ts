import {
  createWebSocketInterceptor,
  RemoteWebSocketInterceptor,
  WebSocketInterceptorClient,
} from '@zimic/interceptor/experimental/ws';
import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor, waitForNot } from '@zimic/utils/time';
import { joinURL } from '@zimic/utils/url';
import { WebSocketCloseTimeoutError, WebSocketOpenTimeoutError } from '@zimic/utils/ws';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { JSONStringified } from '@/types/json';
import { WebSocketMessageData, WebSocketSchema, WebSocketSchemaMessage } from '@/types/schema';
import { INTERCEPTOR_SERVER_URL } from '@tests/constants';

import { openWebSocketClient } from '../utils/lifecycle';
import { WebSocketClient } from '../WebSocketClient';
import { delayWebSocketClose, delayWebSocketListenerTrigger } from './utils';

const nodeMajorVersion = typeof window === 'undefined' ? Number(process.versions.node.split('.')[0]) : null;

// Node 22's native WebSocket dispatches only `error` when a connection fails before opening. Browsers and Node 24+
// follow the spec and dispatch `error`, then `close`. Remove this check when Node 22 support ends.
const isCloseDispatchedOnFailedConnection = nodeMajorVersion === null || nodeMajorVersion >= 24;

describe('WebSocketClient', () => {
  type Schema = WebSocketSchema<{
    '/': {
      message: { type: 'message'; data: string } | { type: 'count'; data: number };
    };
  }>;

  type BinarySchema = WebSocketSchema<{
    '/': {
      message: Blob | ArrayBuffer;
    };
  }>;

  let baseURL: string;
  let interceptor: RemoteWebSocketInterceptor<Schema>;
  let webSocketClient: WebSocketClient<Schema> | undefined;

  beforeEach(async () => {
    // Remote interceptors serve sockets through a real server in both Node and browsers, so the clients use native
    // sockets. Each test uses its own path to isolate its connections.
    baseURL = joinURL(INTERCEPTOR_SERVER_URL, `path-${crypto.randomUUID()}`).replace(/^http/, 'ws');
    interceptor = createWebSocketInterceptor<Schema>({ type: 'remote', baseURL });

    await interceptor.start();
    expect(interceptor.isRunning).toBe(true);
  });

  afterEach(async () => {
    vi.useRealTimers();

    await webSocketClient?.close();
    webSocketClient = undefined;

    await interceptor.stop();
  });

  describe('Lifecycle', () => {
    it('should open and close correctly', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);
      expect(webSocketClient.readyState).toBe(webSocketClient.CONNECTING);

      await webSocketClient.open();
      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);

      await webSocketClient.close();
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);
    });

    it('should not throw an error if opened multiple times', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);
      expect(webSocketClient.readyState).toBe(webSocketClient.CONNECTING);

      await webSocketClient.open();
      await webSocketClient.open();
      await webSocketClient.open();

      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
    });

    it('should open one socket if opened concurrently', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      // The interceptor decides each connection before its handshake finishes, so every socket is counted once open.
      const connectionListener = vi.fn(() => ({ action: 'accept' as const }));
      await interceptor.connection().respond(connectionListener);

      await Promise.all([webSocketClient.open(), webSocketClient.open()]);

      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
      expect(connectionListener).toHaveBeenCalledTimes(1);
    });

    it('should fail opening if closed while connecting', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const openPromise = webSocketClient.open();
      expect(webSocketClient.readyState).toBe(webSocketClient.CONNECTING);

      await webSocketClient.close();
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);

      await expect(openPromise).rejects.toHaveProperty('type', 'error');
    });

    it('should wait for the socket to close if closed multiple times while connecting', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const openPromise = webSocketClient.open();
      const firstClosePromise = webSocketClient.close();

      await webSocketClient.close();
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);

      await firstClosePromise;
      await expect(openPromise).rejects.toHaveProperty('type', 'error');
    });

    /* istanbul ignore else -- @preserve
     * Ignoring because each test run covers only the behavior of its Node.js version. */
    // Node 22 dispatches no close event for a connection closed before opening.
    if (isCloseDispatchedOnFailedConnection) {
      it('should dispatch the close event before closing finishes if closed while connecting', async () => {
        webSocketClient = new WebSocketClient<Schema>(baseURL);

        const closeListener = vi.fn();
        webSocketClient.addEventListener('close', closeListener);

        const openPromise = webSocketClient.open();
        await webSocketClient.close();

        expect(closeListener).toHaveBeenCalledTimes(1);

        await expect(openPromise).rejects.toHaveProperty('type', 'error');
      });
    }

    it('should fail opening if closed from an open listener', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      let closePromise: Promise<void> | undefined;

      webSocketClient.addEventListener('open', () => {
        closePromise = webSocketClient!.close();
      });

      await expect(webSocketClient.open()).rejects.toHaveProperty('type', 'close');
      expect(closePromise).toBeDefined();

      await closePromise;
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);
    });

    it('should fail joined opens if closed from an open listener', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      let closePromise: Promise<void> | undefined;

      webSocketClient.addEventListener('open', () => {
        closePromise = webSocketClient!.close();
      });

      const openPromise = webSocketClient.open();
      const joinedOpenPromise = webSocketClient.open();

      const openExpectation = expect(openPromise).rejects.toHaveProperty('type', 'close');
      const joinedOpenExpectation = expect(joinedOpenPromise).rejects.toHaveProperty('type', 'close');

      await openExpectation;
      await joinedOpenExpectation;

      await closePromise;
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);
    });

    it('should open a new socket if reopened from an open listener after closing', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      let closePromise: Promise<void> | undefined;
      let reopenPromise: Promise<void> | undefined;

      function reopenListener() {
        webSocketClient!.removeEventListener('open', reopenListener);
        closePromise = webSocketClient!.close();
        reopenPromise = webSocketClient!.open();
      }

      webSocketClient.addEventListener('open', reopenListener);

      await expect(webSocketClient.open()).rejects.toHaveProperty('type', 'close');

      await closePromise;
      await reopenPromise;
      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
    });

    it('should open a new socket if reopened while closing and the previous socket closes first', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);
      await webSocketClient.open();

      const previousSocketClosedPromise = createPromiseWithResolvers<void>();
      const originalWebSocketAddEventListener = WebSocket.prototype.addEventListener;

      // Delaying the open listeners until the previous socket closes makes the close finish before the reopen.
      const addEventListenerSpy = vi.spyOn(WebSocket.prototype, 'addEventListener').mockImplementation(function (
        this: WebSocket,
        type,
        listener,
        options,
      ) {
        const delayedListener =
          type === 'open'
            ? (event: Event) => {
                void previousSocketClosedPromise.then(() => {
                  (listener as EventListener)(event);
                });
              }
            : listener;

        originalWebSocketAddEventListener.call(this, type, delayedListener, options);
      });

      try {
        webSocketClient.addEventListener('close', () => {
          previousSocketClosedPromise.resolve();
        });

        const closePromise = webSocketClient.close();
        const openPromise = webSocketClient.open();

        await closePromise;
        await openPromise;

        expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
      } finally {
        addEventListenerSpy.mockRestore();
      }
    });

    it('should open a new socket if reopened while closing and the new socket opens first', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);
      await webSocketClient.open();

      const reopenedPromise = createPromiseWithResolvers<void>();
      const originalWebSocketAddEventListener = WebSocket.prototype.addEventListener;

      // Delaying the close listeners until the new socket opens makes the close finish after the reopen.
      const addEventListenerSpy = vi.spyOn(WebSocket.prototype, 'addEventListener').mockImplementation(function (
        this: WebSocket,
        type,
        listener,
        options,
      ) {
        const delayedListener =
          type === 'close'
            ? (event: Event) => {
                void reopenedPromise.then(() => {
                  (listener as EventListener)(event);
                });
              }
            : listener;

        originalWebSocketAddEventListener.call(this, type, delayedListener, options);
      });

      try {
        webSocketClient.addEventListener('open', () => {
          reopenedPromise.resolve();
        });

        const closePromise = webSocketClient.close();
        const openPromise = webSocketClient.open();

        await closePromise;
        await openPromise;

        expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
      } finally {
        addEventListenerSpy.mockRestore();
      }
    });

    it('should keep the newest socket if an earlier close finishes after it opens', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);
      await webSocketClient.open();

      const newestSocketOpenedPromise = createPromiseWithResolvers<void>();
      const originalWebSocketAddEventListener = WebSocket.prototype.addEventListener;

      // Delaying the close listeners until the newest socket opens makes the first close finish after it.
      const addEventListenerSpy = vi.spyOn(WebSocket.prototype, 'addEventListener').mockImplementation(function (
        this: WebSocket,
        type,
        listener,
        options,
      ) {
        const delayedListener =
          type === 'close'
            ? (event: Event) => {
                void newestSocketOpenedPromise.then(() => {
                  (listener as EventListener)(event);
                });
              }
            : listener;

        originalWebSocketAddEventListener.call(this, type, delayedListener, options);
      });

      try {
        const firstClosePromise = webSocketClient.close();

        const closedOpenPromise = webSocketClient.open();
        const closedOpenExpectation = expect(closedOpenPromise).rejects.toHaveProperty('type', 'error');

        const secondClosePromise = webSocketClient.close();

        await webSocketClient.open();
        newestSocketOpenedPromise.resolve();

        await firstClosePromise;
        await secondClosePromise;
        await closedOpenExpectation;

        expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
      } finally {
        addEventListenerSpy.mockRestore();
      }
    });

    it('should keep the newest socket if the server closed a reopened socket before the previous one closed', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const serverWebSocketClients: WebSocketInterceptorClient<Schema>[] = [];

      await interceptor.connection().effect((serverWebSocketClient) => {
        serverWebSocketClients.push(serverWebSocketClient);
      });

      await webSocketClient.open();

      const newestSocketOpenedPromise = createPromiseWithResolvers<void>();
      const originalWebSocketAddEventListener = WebSocket.prototype.addEventListener;

      // Delaying the close listeners added while the previous socket is closing until the newest socket opens keeps
      // the reopened socket waiting for the previous one to close.
      const addEventListenerSpy = vi.spyOn(WebSocket.prototype, 'addEventListener').mockImplementation(function (
        this: WebSocket,
        type,
        listener,
        options,
      ) {
        const delayedListener =
          type === 'close' && this.readyState === WebSocket.CLOSING
            ? (event: Event) => {
                void newestSocketOpenedPromise.then(() => {
                  (listener as EventListener)(event);
                });
              }
            : listener;

        originalWebSocketAddEventListener.call(this, type, delayedListener, options);
      });

      try {
        const closePromise = webSocketClient.close();

        const reopenedPromise = webSocketClient.open();
        const reopenedExpectation = expect(reopenedPromise).rejects.toHaveProperty('type', 'close');

        await waitFor(() => {
          expect(webSocketClient!.readyState).toBe(webSocketClient!.OPEN);
        });
        await waitFor(() => {
          expect(serverWebSocketClients).toHaveLength(2);
        });

        serverWebSocketClients[1].close();

        await waitFor(() => {
          expect(webSocketClient!.readyState).toBe(webSocketClient!.CLOSED);
        });

        await webSocketClient.open();
        newestSocketOpenedPromise.resolve();

        await closePromise;
        await reopenedExpectation;

        expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);

        await waitFor(() => {
          expect(serverWebSocketClients).toHaveLength(3);
        });
      } finally {
        addEventListenerSpy.mockRestore();
      }
    });

    it('should open a new socket if opened after closed while connecting', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const openPromise = webSocketClient.open();
      await webSocketClient.close();
      await expect(openPromise).rejects.toHaveProperty('type', 'error');

      await webSocketClient.open();
      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
    });

    it('should open a new socket if opened before a close while connecting finishes', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const closedOpenPromise = webSocketClient.open();
      const closePromise = webSocketClient.close();
      const openPromise = webSocketClient.open();

      await expect(closedOpenPromise).rejects.toHaveProperty('type', 'error');
      await closePromise;
      await openPromise;

      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
    });

    it('should open a new socket if opened after the server closed the connection', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const serverWebSocketClients: WebSocketInterceptorClient<Schema>[] = [];

      await interceptor.connection().effect((serverWebSocketClient) => {
        serverWebSocketClients.push(serverWebSocketClient);
      });

      await webSocketClient.open();

      await waitFor(() => {
        expect(serverWebSocketClients).toHaveLength(1);
      });

      serverWebSocketClients[0].close();

      await waitFor(() => {
        expect(webSocketClient!.readyState).toBe(webSocketClient!.CLOSED);
      });

      await webSocketClient.open();

      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);

      await waitFor(() => {
        expect(serverWebSocketClients).toHaveLength(2);
      });
    });

    it('should fail opening if closed while reopening after the server closed the connection', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const serverWebSocketClients: WebSocketInterceptorClient<Schema>[] = [];

      await interceptor.connection().effect((serverWebSocketClient) => {
        serverWebSocketClients.push(serverWebSocketClient);
      });

      await webSocketClient.open();

      await waitFor(() => {
        expect(serverWebSocketClients).toHaveLength(1);
      });

      serverWebSocketClients[0].close();

      await waitFor(() => {
        expect(webSocketClient!.readyState).toBe(webSocketClient!.CLOSED);
      });

      const openPromise = webSocketClient.open();
      expect(webSocketClient.readyState).toBe(webSocketClient.CONNECTING);

      await webSocketClient.close();
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);

      await expect(openPromise).rejects.toHaveProperty('type', 'error');
    });

    it('should not throw an error if closed multiple times', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);
      expect(webSocketClient.readyState).toBe(webSocketClient.CONNECTING);

      await webSocketClient.open();
      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);

      await webSocketClient.close();
      await webSocketClient.close();
      await webSocketClient.close();

      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);
    });

    it('should close with code and reason', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const closeListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'close'>>();
      webSocketClient.addEventListener('close', closeListener);

      await webSocketClient.open();

      const closeCode = 4000;
      const closeReason = 'test-close-reason';
      await webSocketClient.close(closeCode, closeReason);

      expect(closeListener).toHaveBeenCalledTimes(1);
      expect(closeListener).toHaveBeenCalledWith(
        expect.objectContaining({
          code: closeCode,
          reason: closeReason,
        }),
      );
    });

    it('should keep opening if closed with an invalid code while connecting', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const openPromise = webSocketClient.open();

      // Native sockets only accept the close code 1000 or codes from 3000 to 4999.
      const invalidCloseCode = 1001;
      await expect(webSocketClient.close(invalidCloseCode)).rejects.toHaveProperty('name', 'InvalidAccessError');

      await openPromise;
      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
    });

    it('should stay open if closed with an invalid code', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);
      await webSocketClient.open();

      // Native sockets only accept the close code 1000 or codes from 3000 to 4999.
      const invalidCloseCode = 1001;
      await expect(webSocketClient.close(invalidCloseCode)).rejects.toHaveProperty('name', 'InvalidAccessError');

      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
    });

    it('should support construction from a native socket', async () => {
      const protocols = ['protocol1'];

      const nativeWebSocketClient = new WebSocket(baseURL, protocols);
      webSocketClient = new WebSocketClient<Schema>(nativeWebSocketClient);

      expect(nativeWebSocketClient.readyState).toBe(WebSocket.CONNECTING);
      expect(webSocketClient.readyState).toBe(WebSocket.CONNECTING);

      await openWebSocketClient(nativeWebSocketClient);

      expect(nativeWebSocketClient.readyState).toBe(WebSocket.OPEN);
      expect(webSocketClient.readyState).toBe(WebSocket.OPEN);

      await webSocketClient.open();

      expect(nativeWebSocketClient.readyState).toBe(WebSocket.OPEN);

      expect(webSocketClient.readyState).toBe(WebSocket.OPEN);
      expect(webSocketClient.url).toBe(nativeWebSocketClient.url);
      expect(webSocketClient.protocol).toBe(protocols[0]);

      webSocketClient.binaryType = 'arraybuffer';
      expect(nativeWebSocketClient.binaryType).toBe('arraybuffer');

      await webSocketClient.close();

      expect(nativeWebSocketClient.readyState).toBe(WebSocket.CLOSED);
      expect(webSocketClient.readyState).toBe(WebSocket.CLOSED);
    });

    it('should be open if the native socket is already open when constructed', async () => {
      const protocols = ['protocol1'];

      const nativeWebSocketClient = new WebSocket(baseURL, protocols);
      await openWebSocketClient(nativeWebSocketClient);

      expect(nativeWebSocketClient.readyState).toBe(WebSocket.OPEN);

      webSocketClient = new WebSocketClient<Schema>(nativeWebSocketClient);

      expect(webSocketClient.readyState).toBe(WebSocket.OPEN);
      expect(webSocketClient.url).toBe(nativeWebSocketClient.url);
      expect(webSocketClient.protocol).toBe(protocols[0]);

      await webSocketClient.open();

      expect(nativeWebSocketClient.readyState).toBe(WebSocket.OPEN);
      expect(webSocketClient.readyState).toBe(WebSocket.OPEN);

      await openWebSocketClient(nativeWebSocketClient);

      expect(nativeWebSocketClient.readyState).toBe(WebSocket.OPEN);
      expect(webSocketClient.readyState).toBe(WebSocket.OPEN);

      await webSocketClient.close();

      expect(nativeWebSocketClient.readyState).toBe(WebSocket.CLOSED);
      expect(webSocketClient.readyState).toBe(WebSocket.CLOSED);
    });
  });

  describe('Properties', () => {
    it('should inherit all ready states from the native WebSocket class', () => {
      expect(WebSocketClient.CONNECTING).toBe(WebSocket.CONNECTING);
      expect(WebSocketClient.OPEN).toBe(WebSocket.OPEN);
      expect(WebSocketClient.CLOSING).toBe(WebSocket.CLOSING);
      expect(WebSocketClient.CLOSED).toBe(WebSocket.CLOSED);

      webSocketClient = new WebSocketClient<Schema>(baseURL);

      expect(webSocketClient.CONNECTING).toBe(WebSocket.CONNECTING);
      expect(webSocketClient.OPEN).toBe(WebSocket.OPEN);
      expect(webSocketClient.CLOSING).toBe(WebSocket.CLOSING);
      expect(webSocketClient.CLOSED).toBe(WebSocket.CLOSED);
    });

    it('should expose the protocol of the socket being opened to open listeners', async () => {
      const protocols = ['protocol1', 'protocol2'];
      webSocketClient = new WebSocketClient<Schema>(baseURL, protocols);

      let protocolWhileOpening: string | undefined;

      webSocketClient.addEventListener('open', () => {
        protocolWhileOpening = webSocketClient!.protocol;
      });

      await webSocketClient.open();

      expect(protocolWhileOpening).toBe(protocols[0]);
    });

    it('should expose URL, protocol, extensions, state, and buffer correctly', async () => {
      const protocols = ['protocol1', 'protocol2'];
      webSocketClient = new WebSocketClient<Schema>(baseURL, protocols);

      expect(webSocketClient.url).toBe(baseURL);
      expect(webSocketClient.protocol).toBe('');
      expect(webSocketClient.extensions).toBe('');
      expect(webSocketClient.readyState).toBe(webSocketClient.CONNECTING);
      expect(webSocketClient.bufferedAmount).toBe(0);

      await webSocketClient.open();

      expect(webSocketClient.protocol).toBe(protocols[0]);
      expect(webSocketClient.extensions).toBe('');
      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
      expect(webSocketClient.bufferedAmount).toBe(0);
    });

    it('should support setting binary type before and after opening', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      expect(webSocketClient.binaryType).toBe('blob');

      webSocketClient.binaryType = 'arraybuffer';
      expect(webSocketClient.binaryType).toBe('arraybuffer');

      await webSocketClient.open();
      expect(webSocketClient.binaryType).toBe('arraybuffer');

      webSocketClient.binaryType = 'blob';
      expect(webSocketClient.binaryType).toBe('blob');
    });

    it('should apply the binary type set in an open listener to received messages', async () => {
      const binaryInterceptor = createWebSocketInterceptor<BinarySchema>({ type: 'remote', baseURL });
      const binaryWebSocketClient = new WebSocketClient<BinarySchema>(baseURL);

      try {
        await binaryInterceptor.start();
        await binaryInterceptor.message().respond((message) => message);

        expect(binaryWebSocketClient.binaryType).toBe('blob');

        binaryWebSocketClient.addEventListener('open', () => {
          binaryWebSocketClient.binaryType = 'arraybuffer';
        });

        const messageListener = vi.fn<WebSocketClient.EventListener<BinarySchema, 'message'>>();
        binaryWebSocketClient.addEventListener('message', messageListener);

        await binaryWebSocketClient.open();
        expect(binaryWebSocketClient.binaryType).toBe('arraybuffer');

        binaryWebSocketClient.send(new Uint8Array([1, 2, 3]).buffer);

        await waitFor(() => {
          expect(messageListener).toHaveBeenCalledTimes(1);
        });

        const receivedData = messageListener.mock.calls[0][0].data;
        expect(receivedData).toBeInstanceOf(ArrayBuffer);
        expect(receivedData).toEqual(new Uint8Array([1, 2, 3]).buffer);
      } finally {
        await binaryWebSocketClient.close();
        await binaryInterceptor.stop();
      }
    });

    it('should apply the binary type set while opening to received messages', async () => {
      const binaryInterceptor = createWebSocketInterceptor<BinarySchema>({ type: 'remote', baseURL });
      const binaryWebSocketClient = new WebSocketClient<BinarySchema>(baseURL);

      let readyStateWhileSettingBinaryType: WebSocketClient.ReadyState | undefined;

      try {
        await binaryInterceptor.start();

        // The interceptor decides the connection before finishing its handshake, so this sets the binary type while
        // the client is still opening.
        await binaryInterceptor.connection().respond(() => {
          readyStateWhileSettingBinaryType = binaryWebSocketClient.readyState;
          binaryWebSocketClient.binaryType = 'arraybuffer';
          return { action: 'accept' };
        });

        await binaryInterceptor.message().respond((message) => message);

        expect(binaryWebSocketClient.binaryType).toBe('blob');

        const messageListener = vi.fn<WebSocketClient.EventListener<BinarySchema, 'message'>>();
        binaryWebSocketClient.addEventListener('message', messageListener);

        await binaryWebSocketClient.open();
        expect(readyStateWhileSettingBinaryType).toBe(binaryWebSocketClient.CONNECTING);
        expect(binaryWebSocketClient.binaryType).toBe('arraybuffer');

        binaryWebSocketClient.send(new Uint8Array([1, 2, 3]).buffer);

        await waitFor(() => {
          expect(messageListener).toHaveBeenCalledTimes(1);
        });

        const receivedData = messageListener.mock.calls[0][0].data;
        expect(receivedData).toBeInstanceOf(ArrayBuffer);
        expect(receivedData).toEqual(new Uint8Array([1, 2, 3]).buffer);
      } finally {
        await binaryWebSocketClient.close();
        await binaryInterceptor.stop();
      }
    });
  });

  describe('Messaging', () => {
    it('should throw an invalid state error if sending before opened', () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);
      expect(webSocketClient.readyState).toBe(webSocketClient.CONNECTING);

      expect(() => {
        webSocketClient!.send(JSON.stringify({ type: 'message', data: 'test' }));
      }).toThrow(new DOMException('Still in CONNECTING state.', 'InvalidStateError'));
    });

    it('should throw an invalid state error if sending while connecting', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      let readyStateWhileSending: WebSocketClient.ReadyState | undefined;
      let sendError: unknown;

      // The interceptor decides the connection before finishing its handshake, so the client is still connecting.
      await interceptor.connection().respond(() => {
        readyStateWhileSending = webSocketClient!.readyState;

        try {
          webSocketClient!.send(JSON.stringify({ type: 'message', data: 'test' }));
        } catch (error) {
          sendError = error;
        }

        return { action: 'accept' };
      });

      await webSocketClient.open();

      expect(readyStateWhileSending).toBe(webSocketClient.CONNECTING);
      expect(sendError).toBeInstanceOf(DOMException);
      expect(sendError).toHaveProperty('name', 'InvalidStateError');
    });

    it('should not throw if sending while closing', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);
      await webSocketClient.open();

      const closePromise = webSocketClient.close();
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSING);

      expect(() => {
        webSocketClient!.send(JSON.stringify({ type: 'message', data: 'test' }));
      }).not.toThrow();

      await closePromise;
    });

    it('should not throw if sending after closed', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);
      await webSocketClient.open();

      await webSocketClient.close();
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);

      expect(() => {
        webSocketClient!.send(JSON.stringify({ type: 'message', data: 'test' }));
      }).not.toThrow();
    });

    it('should not throw if sending after closed before opened', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      await webSocketClient.close();
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);

      expect(() => {
        webSocketClient!.send(JSON.stringify({ type: 'message', data: 'test' }));
      }).not.toThrow();
    });

    it('should send and receive messages', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      await interceptor
        .message()
        .with({ type: 'message' })
        .respond((message) => ({ type: 'message', data: `response: ${message.data}` }));

      const receivedMessages: WebSocketSchemaMessage<Schema>[] = [];

      webSocketClient.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);

        expectTypeOf(message).toEqualTypeOf<WebSocketSchemaMessage<Schema>>();
        expectTypeOf(message.type).toEqualTypeOf<'message' | 'count'>();
        expectTypeOf(message.data).toEqualTypeOf<string | number>();

        receivedMessages.push(message);
      });

      const messageListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'message'>>();
      webSocketClient.addEventListener('message', messageListener);

      await webSocketClient.open();
      webSocketClient.send(
        JSON.stringify({
          type: 'message',
          data: 'hello',
        }),
      );

      await waitFor(() => {
        expect(messageListener).toHaveBeenCalledTimes(1);
        expect(messageListener).toHaveBeenCalledWith(
          expect.objectContaining({
            data: JSON.stringify({
              type: 'message',
              data: 'response: hello',
            }),
          }),
        );
      });

      expect(receivedMessages).toEqual([{ type: 'message', data: 'response: hello' }]);
    });

    it('should send messages from an open listener', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const serverMessageListener = vi.fn();
      await interceptor.message().effect(serverMessageListener);

      let readyStateWhileSending: WebSocketClient.ReadyState | undefined;

      webSocketClient.addEventListener('open', () => {
        readyStateWhileSending = webSocketClient!.readyState;
        webSocketClient!.send(JSON.stringify({ type: 'message', data: 'hello' }));
      });

      await webSocketClient.open();
      expect(readyStateWhileSending).toBe(webSocketClient.OPEN);

      await waitFor(() => {
        expect(serverMessageListener).toHaveBeenCalledTimes(1);
      });
      expect(serverMessageListener).toHaveBeenCalledWith({ type: 'message', data: 'hello' }, expect.anything());
    });
  });

  describe('Listeners', () => {
    it('should support adding and removing non-unitary listeners', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const onOpen = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();
      const onMessage = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'message'>>();
      const onClose = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'close'>>();
      const onError = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'error'>>();

      await interceptor.connection().effect((serverClient) => {
        serverClient.send(
          JSON.stringify({
            type: 'message',
            data: 'hello',
          }),
        );
      });

      webSocketClient.addEventListener('open', onOpen);
      webSocketClient.addEventListener('message', onMessage);
      webSocketClient.addEventListener('close', onClose);
      webSocketClient.addEventListener('error', onError);

      expect(webSocketClient.onopen).toBe(null);
      expect(webSocketClient.onmessage).toBe(null);
      expect(webSocketClient.onclose).toBe(null);
      expect(webSocketClient.onerror).toBe(null);

      await webSocketClient.open();

      await waitFor(() => {
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onMessage).toHaveBeenCalledTimes(1);
      });
      expect(onError).toHaveBeenCalledTimes(0);
      expect(onClose).toHaveBeenCalledTimes(0);

      webSocketClient.dispatchEvent(new Event('error'));

      await waitFor(() => {
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onMessage).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(onClose).toHaveBeenCalledTimes(0);

      await webSocketClient.close();

      await waitFor(() => {
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onMessage).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
      });

      webSocketClient.removeEventListener('open', onOpen);
      webSocketClient.removeEventListener('message', onMessage);
      webSocketClient.removeEventListener('close', onClose);
      webSocketClient.removeEventListener('error', onError);

      expect(webSocketClient.onopen).toBe(null);
      expect(webSocketClient.onmessage).toBe(null);
      expect(webSocketClient.onclose).toBe(null);
      expect(webSocketClient.onerror).toBe(null);

      await webSocketClient.open();
      webSocketClient.dispatchEvent(new Event('error'));
      await webSocketClient.close();

      await waitForNot(() => {
        expect(onOpen.mock.calls.length).toBeGreaterThan(1);
      });
      await waitForNot(() => {
        expect(onMessage.mock.calls.length).toBeGreaterThan(1);
      });
      await waitForNot(() => {
        expect(onError.mock.calls.length).toBeGreaterThan(1);
      });
      await waitForNot(() => {
        expect(onClose.mock.calls.length).toBeGreaterThan(1);
      });
    });

    it('should support setting and removing unitary listeners', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const onOpen = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();
      const onMessage = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'message'>>();
      const onClose = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'close'>>();
      const onError = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'error'>>();

      await interceptor.connection().effect((serverClient) => {
        serverClient.send(
          JSON.stringify({
            type: 'message',
            data: 'hello',
          }),
        );
      });

      webSocketClient.onopen = onOpen;
      webSocketClient.onmessage = onMessage;
      webSocketClient.onclose = onClose;
      webSocketClient.onerror = onError;

      expect(webSocketClient.onopen).toBe(onOpen);
      expect(webSocketClient.onmessage).toBe(onMessage);
      expect(webSocketClient.onclose).toBe(onClose);
      expect(webSocketClient.onerror).toBe(onError);

      await webSocketClient.open();

      await waitFor(() => {
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onMessage).toHaveBeenCalledTimes(1);
      });
      expect(onError).toHaveBeenCalledTimes(0);
      expect(onClose).toHaveBeenCalledTimes(0);

      webSocketClient.dispatchEvent(new Event('error'));

      await waitFor(() => {
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onMessage).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(onClose).toHaveBeenCalledTimes(0);

      await webSocketClient.close();

      await waitFor(() => {
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onMessage).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
      });

      await webSocketClient.open();

      expect(onOpen).toHaveBeenCalledTimes(2);
      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);

      webSocketClient.onopen = null;
      webSocketClient.onmessage = null;
      webSocketClient.onclose = null;
      webSocketClient.onerror = null;

      expect(webSocketClient.onopen).toBe(null);
      expect(webSocketClient.onmessage).toBe(null);
      expect(webSocketClient.onclose).toBe(null);
      expect(webSocketClient.onerror).toBe(null);

      webSocketClient.dispatchEvent(new Event('error'));
      await webSocketClient.close();

      expect(onOpen).toHaveBeenCalledTimes(2);
      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should replace previous unitary listeners if reassigned', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const openListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();
      const otherOpenListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();

      webSocketClient.onopen = openListener;
      webSocketClient.onopen = otherOpenListener;

      await webSocketClient.open();

      expect(openListener).not.toHaveBeenCalled();
      expect(otherOpenListener).toHaveBeenCalledTimes(1);

      const closeListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'close'>>();
      const otherCloseListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'close'>>();

      webSocketClient.onclose = closeListener;
      webSocketClient.onclose = otherCloseListener;

      await webSocketClient.close();

      expect(closeListener).not.toHaveBeenCalled();
      expect(otherCloseListener).toHaveBeenCalledTimes(1);
    });

    it('should not replace non-unitary listeners when assigning unitary listeners', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const onOpen = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();
      const openListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();

      webSocketClient.onopen = onOpen;
      webSocketClient.addEventListener('open', openListener);

      await webSocketClient.open();

      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(openListener).toHaveBeenCalledTimes(1);
    });

    it('should not replace non-unitary listeners when multiple are added', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const openListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();
      const otherOpenListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();

      webSocketClient.addEventListener('open', openListener);
      webSocketClient.addEventListener('open', otherOpenListener);

      await webSocketClient.open();

      expect(openListener).toHaveBeenCalledTimes(1);
      expect(otherOpenListener).toHaveBeenCalledTimes(1);
    });

    it('should not throw when removing non-unitary listeners multiple times', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const openListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();

      webSocketClient.addEventListener('open', openListener);

      webSocketClient.removeEventListener('open', openListener);
      webSocketClient.removeEventListener('open', openListener);
      webSocketClient.removeEventListener('open', openListener);

      await webSocketClient.open();

      expect(openListener).not.toHaveBeenCalled();
    });

    it('should not throw when clearing unitary listeners multiple times', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const onOpen = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();

      webSocketClient.onopen = onOpen;
      webSocketClient.onopen = null;
      webSocketClient.onopen = null;
      webSocketClient.onopen = null;

      await webSocketClient.open();

      expect(onOpen).not.toHaveBeenCalled();
    });

    it('should allow non-unitary listeners added after opened', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      await webSocketClient.open();

      const closeListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'close'>>();
      webSocketClient.addEventListener('close', closeListener);

      await webSocketClient.close();

      expect(closeListener).toHaveBeenCalledTimes(1);
    });

    it('should allow unitary listeners added after opened', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      await webSocketClient.open();

      const onClose = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'close'>>();
      webSocketClient.onclose = onClose;

      await webSocketClient.close();

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should apply listener changes made while connecting', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const message = JSON.stringify({ type: 'message' as const, data: 'hello' });

      await interceptor.connection().effect((serverClient) => {
        serverClient.send(message);
      });

      const openPromise = webSocketClient.open();
      expect(webSocketClient.readyState).toBe(webSocketClient.CONNECTING);

      const onMessage = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'message'>>();
      const messageListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'message'>>();
      const removedMessageListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'message'>>();

      webSocketClient.onmessage = onMessage;
      webSocketClient.addEventListener('message', messageListener);
      webSocketClient.addEventListener('message', removedMessageListener);
      webSocketClient.removeEventListener('message', removedMessageListener);

      await openPromise;

      await waitFor(() => {
        expect(onMessage).toHaveBeenCalledTimes(1);
        expect(messageListener).toHaveBeenCalledTimes(1);
      });

      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ data: message }));
      expect(messageListener).toHaveBeenCalledWith(expect.objectContaining({ data: message }));
      expect(removedMessageListener).not.toHaveBeenCalled();
    });
  });

  describe('Dispatch Event', () => {
    it('should return false when dispatching with no socket', () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const errorListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'error'>>();
      webSocketClient.addEventListener('error', errorListener);

      const dispatched = webSocketClient.dispatchEvent(new Event('error'));
      expect(dispatched).toBe(false);

      expect(errorListener).toHaveBeenCalledTimes(0);
    });

    it('should dispatch events through the underlying socket when open', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const errorListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'error'>>();
      webSocketClient.addEventListener('error', errorListener);

      await webSocketClient.open();

      const dispatched = webSocketClient.dispatchEvent(new Event('error'));
      expect(dispatched).toBe(true);

      expect(errorListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Timeouts', () => {
    it('should throw an open timeout error if opening times out', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const delayedListenerTrigger = delayWebSocketListenerTrigger();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      try {
        const timeoutDuration = 5;

        const openPromise = webSocketClient.open({ timeout: timeoutDuration });
        const openExpectation = expect(openPromise).rejects.toThrow(new WebSocketOpenTimeoutError(timeoutDuration));

        await vi.advanceTimersByTimeAsync(timeoutDuration);
        await openExpectation;

        delayedListenerTrigger.release();
        vi.useRealTimers();

        await waitFor(() => {
          expect(webSocketClient!.readyState).toBe(webSocketClient!.CLOSED);
        });
      } finally {
        delayedListenerTrigger.restore();
      }
    });

    it('should throw an open timeout error if a joined open times out', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const connectionReleasedPromise = createPromiseWithResolvers<void>();

      // The interceptor decides the connection before finishing its handshake, so the client keeps connecting until
      // the connection is released.
      await interceptor.connection().respond(async () => {
        await connectionReleasedPromise;
        return { action: 'accept' };
      });

      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      const openPromise = webSocketClient.open();

      const timeoutDuration = 5;

      const joinedOpenPromise = webSocketClient.open({ timeout: timeoutDuration });
      const joinedOpenExpectation = expect(joinedOpenPromise).rejects.toThrow(
        new WebSocketOpenTimeoutError(timeoutDuration),
      );

      await vi.advanceTimersByTimeAsync(timeoutDuration);
      await joinedOpenExpectation;

      expect(webSocketClient.readyState).toBe(webSocketClient.CONNECTING);

      connectionReleasedPromise.resolve();

      await openPromise;
      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
    });

    it('should open a new socket if opened after opening timed out', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const delayedListenerTrigger = delayWebSocketListenerTrigger();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      try {
        const timeoutDuration = 5;

        const openPromise = webSocketClient.open({ timeout: timeoutDuration });
        const openExpectation = expect(openPromise).rejects.toThrow(new WebSocketOpenTimeoutError(timeoutDuration));

        await vi.advanceTimersByTimeAsync(timeoutDuration);
        await openExpectation;

        delayedListenerTrigger.release();

        await webSocketClient.open();
        expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
      } finally {
        delayedListenerTrigger.restore();
      }
    });

    it('should throw an open timeout error if reopening while closing does not close the previous socket before the timeout', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);
      await webSocketClient.open();

      const closePromise = webSocketClient.close();

      const originalWebSocketAddEventListener = WebSocket.prototype.addEventListener;

      // Dropping the close listeners of the closing socket keeps its close from ever finishing for the reopen.
      const addEventListenerSpy = vi.spyOn(WebSocket.prototype, 'addEventListener').mockImplementation(function (
        this: WebSocket,
        type,
        listener,
        options,
      ) {
        if (type === 'close' && this.readyState === WebSocket.CLOSING) {
          return;
        }

        originalWebSocketAddEventListener.call(this, type, listener, options);
      });

      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      try {
        const timeoutDuration = 5;

        const openPromise = webSocketClient.open({ timeout: timeoutDuration });
        const openExpectation = expect(openPromise).rejects.toThrow(new WebSocketOpenTimeoutError(timeoutDuration));

        await vi.advanceTimersByTimeAsync(timeoutDuration);
        await openExpectation;

        vi.useRealTimers();

        await closePromise;

        await waitFor(() => {
          expect(webSocketClient!.readyState).toBe(webSocketClient!.CLOSED);
        });
      } finally {
        addEventListenerSpy.mockRestore();
      }
    });

    it('should open a new socket if opened as soon as opening timed out', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const delayedListenerTrigger = delayWebSocketListenerTrigger();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      try {
        const timeoutDuration = 5;
        let openError: unknown;

        // Reopening in the rejection handler runs before the socket of the timed out open emits its close event.
        const reopenPromise = webSocketClient.open({ timeout: timeoutDuration }).catch((error: unknown) => {
          openError = error;
          return webSocketClient!.open();
        });

        await vi.advanceTimersByTimeAsync(timeoutDuration);
        await reopenPromise;

        expect(openError).toEqual(new WebSocketOpenTimeoutError(timeoutDuration));
        expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);

        delayedListenerTrigger.release();
      } finally {
        delayedListenerTrigger.restore();
      }
    });

    it('should throw a close timeout error if closing times out', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      await webSocketClient.open();

      const delayedWebSocketClose = delayWebSocketClose();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      try {
        const timeoutDuration = 5;

        const closePromise = webSocketClient.close(undefined, undefined, { timeout: timeoutDuration });
        const closeExpectation = expect(closePromise).rejects.toThrow(new WebSocketCloseTimeoutError(timeoutDuration));

        await vi.advanceTimersByTimeAsync(timeoutDuration);
        await closeExpectation;

        expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);

        delayedWebSocketClose.release();
      } finally {
        delayedWebSocketClose.restore();
      }
    });

    it('should throw a close timeout error if closing while opening times out', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const timeoutDuration = 5;
      const socketOpenedPromise = createPromiseWithResolvers<void>();
      let closePromise: Promise<void> | undefined;

      // An open listener closes the client before `open()` takes over its socket.
      webSocketClient.addEventListener('open', () => {
        closePromise = webSocketClient!.close(undefined, undefined, { timeout: timeoutDuration });
        socketOpenedPromise.resolve();
      });

      const delayedWebSocketClose = delayWebSocketClose();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      try {
        const openPromise = webSocketClient.open();
        const openExpectation = expect(openPromise).rejects.toHaveProperty('type', 'close');

        await socketOpenedPromise;

        const closeExpectation = expect(closePromise).rejects.toThrow(new WebSocketCloseTimeoutError(timeoutDuration));

        await vi.advanceTimersByTimeAsync(timeoutDuration);
        await closeExpectation;

        delayedWebSocketClose.release();

        await openExpectation;
        expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);
      } finally {
        delayedWebSocketClose.restore();
      }
    });

    it('should throw an open timeout error if a socket closed while opening does not close before the timeout', async () => {
      webSocketClient = new WebSocketClient<Schema>(baseURL);

      const socketOpenedPromise = createPromiseWithResolvers<void>();
      let closePromise: Promise<void> | undefined;

      // An open listener closes the client before `open()` takes over its socket.
      webSocketClient.addEventListener('open', () => {
        closePromise = webSocketClient!.close();
        socketOpenedPromise.resolve();
      });

      const delayedWebSocketClose = delayWebSocketClose();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      try {
        const timeoutDuration = 5;

        const openPromise = webSocketClient.open({ timeout: timeoutDuration });
        const openExpectation = expect(openPromise).rejects.toThrow(new WebSocketOpenTimeoutError(timeoutDuration));

        await socketOpenedPromise;

        await vi.advanceTimersByTimeAsync(timeoutDuration);
        await openExpectation;

        delayedWebSocketClose.release();

        await closePromise;
        expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);
      } finally {
        delayedWebSocketClose.restore();
      }
    });
  });

  describe('Types', () => {
    type MultiPathSchema = WebSocketSchema<{
      '/rooms/:roomId': {
        message: { type: 'chat'; text: string };
      };
      '/users/:userId': {
        message: { type: 'presence'; online: boolean };
      };
    }>;

    type UserMessage = WebSocketSchemaMessage<MultiPathSchema, '/users/:userId'>;

    it('should not require a path type argument if the schema has a single path', () => {
      function declareClient(url: string, socket: WebSocket) {
        const client = new WebSocketClient<Schema>(url);
        new WebSocketClient<Schema>(socket);

        client.send(JSON.stringify({ type: 'count', data: 1 }));

        // @ts-expect-error The message is not declared in the schema.
        client.send(JSON.stringify({ type: 'unknown' }) as JSONStringified<{ type: 'unknown' }>);
      }

      expectTypeOf(declareClient).toBeFunction();
    });

    it('should require a path type argument if the schema has multiple paths', () => {
      function declareClient(url: string, socket: WebSocket) {
        // @ts-expect-error The schema has multiple paths, so the client must declare its path.
        new WebSocketClient<MultiPathSchema>(url);

        // @ts-expect-error The schema has multiple paths, so the client must declare its path.
        new WebSocketClient<MultiPathSchema>(socket);
      }

      expectTypeOf(declareClient).toBeFunction();
    });

    it('should type messages from the declared path', () => {
      function declareClient(url: string) {
        const client = new WebSocketClient<MultiPathSchema, '/rooms/:roomId'>(url);

        client.send(JSON.stringify({ type: 'chat', text: 'hello' }));

        // @ts-expect-error The message belongs to another path.
        client.send(JSON.stringify({ type: 'presence', online: true }) as JSONStringified<UserMessage>);
      }

      expectTypeOf(declareClient).toBeFunction();
    });

    it('should not accept undeclared paths', () => {
      // @ts-expect-error The path is not declared in the schema.
      expectTypeOf<WebSocketClient<MultiPathSchema, '/unknown'>>().not.toBeAny();
    });

    type DirectionalSchema = WebSocketSchema<{
      '/rooms/:roomId': {
        message: { type: 'ping' };
        serverMessage: { type: 'chat:received'; text: string };
        clientMessage: { type: 'chat:send'; text: string };
      };
    }>;

    type DirectionalServerMessage = WebSocketSchemaMessage.Server<DirectionalSchema>;
    type DirectionalClientMessage = WebSocketSchemaMessage.Client<DirectionalSchema>;

    it('should send the client messages on the client side', () => {
      function declareClient(client: WebSocketClient<DirectionalSchema>) {
        client.send(JSON.stringify({ type: 'ping' }));
        client.send(JSON.stringify({ type: 'chat:send', text: 'hello' }));

        const serverOnlyMessage = JSON.stringify({ type: 'chat:received', text: 'hello' }) as JSONStringified<{
          type: 'chat:received';
          text: string;
        }>;

        // @ts-expect-error Only the server sends this message.
        client.send(serverOnlyMessage);
      }

      expectTypeOf(declareClient).toBeFunction();
    });

    it('should receive the server messages on the client side', () => {
      expectTypeOf<WebSocketClient.MessageEvent<DirectionalSchema>['data']>().toEqualTypeOf<
        WebSocketMessageData<DirectionalServerMessage>
      >();

      function declareClient(client: WebSocketClient<DirectionalSchema>) {
        client.onmessage = (event) => {
          expectTypeOf(event.data).toEqualTypeOf<WebSocketMessageData<DirectionalServerMessage>>();
        };

        client.addEventListener('message', (event) => {
          expectTypeOf(event.data).toEqualTypeOf<WebSocketMessageData<DirectionalServerMessage>>();
        });
      }

      expectTypeOf(declareClient).toBeFunction();
    });

    it('should send the server messages on the server side', () => {
      function declareClient(client: WebSocketClient<DirectionalSchema, '/rooms/:roomId', 'server'>) {
        client.send(JSON.stringify({ type: 'ping' }));
        client.send(JSON.stringify({ type: 'chat:received', text: 'hello' }));

        const clientOnlyMessage = JSON.stringify({ type: 'chat:send', text: 'hello' }) as JSONStringified<{
          type: 'chat:send';
          text: string;
        }>;

        // @ts-expect-error Only the client sends this message.
        client.send(clientOnlyMessage);
      }

      expectTypeOf(declareClient).toBeFunction();
    });

    it('should receive the client messages on the server side', () => {
      expectTypeOf<WebSocketClient.MessageEvent<DirectionalSchema, '/rooms/:roomId', 'server'>['data']>().toEqualTypeOf<
        WebSocketMessageData<DirectionalClientMessage>
      >();

      function declareClient(client: WebSocketClient<DirectionalSchema, '/rooms/:roomId', 'server'>) {
        client.onmessage = (event) => {
          expectTypeOf(event.data).toEqualTypeOf<WebSocketMessageData<DirectionalClientMessage>>();
        };

        client.addEventListener('message', (event) => {
          expectTypeOf(event.data).toEqualTypeOf<WebSocketMessageData<DirectionalClientMessage>>();
        });
      }

      expectTypeOf(declareClient).toBeFunction();
    });
  });
});
