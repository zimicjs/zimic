import { startHttpServer, stopHttpServer } from '@zimic/utils/server';
import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketCloseTimeoutError, WebSocketOpenTimeoutError } from '@zimic/utils/ws';
import { createServer as createHttpServer, Server as HttpServer } from 'http';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { WebSocketServer } from '@/server';
import { JSONStringified } from '@/types/json';
import { WebSocketSchema, WebSocketSchemaMessage } from '@/types/schema';

import { openWebSocketClient } from '../utils/lifecycle';
import { WebSocketClient } from '../WebSocketClient';
import { delayWebSocketClose, delayWebSocketListenerTrigger } from './utils';

describe('WebSocketClient', () => {
  let httpServer: HttpServer;

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

  let webSocketServer: WebSocketServer<Schema>;
  let webSocketClient: WebSocketClient<Schema> | undefined;

  beforeEach(async () => {
    httpServer = createHttpServer();
    webSocketServer = new WebSocketServer({ httpServer });

    await startHttpServer(httpServer, { hostname: '127.0.0.1' });
    await webSocketServer.open();

    expect(webSocketServer.isOpen).toBe(true);
  });

  afterEach(async () => {
    await webSocketClient?.close();
    webSocketClient = undefined;

    await webSocketServer.close();
    await stopHttpServer(httpServer);
  });

  describe('Lifecycle', () => {
    it('should open and close correctly', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);
      expect(webSocketClient.readyState).toBe(webSocketClient.CONNECTING);

      await webSocketClient.open();
      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);

      await webSocketClient.close();
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);
    });

    it('should not throw an error if opened multiple times', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);
      expect(webSocketClient.readyState).toBe(webSocketClient.CONNECTING);

      await webSocketClient.open();
      await webSocketClient.open();
      await webSocketClient.open();

      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
    });

    it('should open one socket if opened concurrently', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      const connectionListener = vi.fn();
      webSocketServer.addEventListener('connection', connectionListener);

      await Promise.all([webSocketClient.open(), webSocketClient.open()]);

      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
      expect(connectionListener).toHaveBeenCalledTimes(1);
    });

    it('should fail opening if closed while connecting', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      const openPromise = webSocketClient.open();
      expect(webSocketClient.readyState).toBe(webSocketClient.CONNECTING);

      await webSocketClient.close();
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);

      await expect(openPromise).rejects.toHaveProperty('type', 'error');
    });

    it('should open a new socket if opened after closed while connecting', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      const openPromise = webSocketClient.open();
      await webSocketClient.close();
      await expect(openPromise).rejects.toHaveProperty('type', 'error');

      await webSocketClient.open();
      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
    });

    it('should open a new socket if opened after the server closed the connection', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      const serverWebSocketClients: WebSocketClient<Schema>[] = [];

      webSocketServer.addEventListener('connection', (serverWebSocketClient) => {
        serverWebSocketClients.push(serverWebSocketClient);
      });

      await webSocketClient.open();
      expect(serverWebSocketClients).toHaveLength(1);

      await serverWebSocketClients[0].close();

      await waitFor(() => {
        expect(webSocketClient!.readyState).toBe(webSocketClient!.CLOSED);
      });

      await webSocketClient.open();

      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
      expect(serverWebSocketClients).toHaveLength(2);
    });

    it('should not throw an error if closed multiple times', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);
      expect(webSocketClient.readyState).toBe(webSocketClient.CONNECTING);

      await webSocketClient.open();
      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);

      await webSocketClient.close();
      await webSocketClient.close();
      await webSocketClient.close();

      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);
    });

    it('should close with code and reason', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

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

    it('should support construction from a native socket', async () => {
      const protocols = ['protocol1'];

      const nativeWebSocketClient = new WebSocket(webSocketServer.baseURL, protocols);
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

      const nativeWebSocketClient = new WebSocket(webSocketServer.baseURL, protocols);
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

      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      expect(webSocketClient.CONNECTING).toBe(WebSocket.CONNECTING);
      expect(webSocketClient.OPEN).toBe(WebSocket.OPEN);
      expect(webSocketClient.CLOSING).toBe(WebSocket.CLOSING);
      expect(webSocketClient.CLOSED).toBe(WebSocket.CLOSED);
    });

    it('should expose URL, protocol, extensions, state, and buffer correctly', async () => {
      const protocols = ['protocol1', 'protocol2'];
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL, protocols);

      expect(webSocketClient.url).toBe(webSocketServer.baseURL);
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
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      expect(webSocketClient.binaryType).toBe('blob');

      webSocketClient.binaryType = 'arraybuffer';
      expect(webSocketClient.binaryType).toBe('arraybuffer');

      await webSocketClient.open();
      expect(webSocketClient.binaryType).toBe('arraybuffer');

      webSocketClient.binaryType = 'blob';
      expect(webSocketClient.binaryType).toBe('blob');
    });

    it('should apply the binary type set in an open listener to received messages', async () => {
      webSocketServer.addEventListener('connection', (serverWebSocketClient) => {
        serverWebSocketClient.addEventListener('message', (event) => {
          serverWebSocketClient.send(event.data);
        });
      });

      const binaryWebSocketClient = new WebSocketClient<BinarySchema>(webSocketServer.baseURL);

      try {
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
      }
    });

    it('should apply the binary type set while opening to received messages', async () => {
      const binaryWebSocketClient = new WebSocketClient<BinarySchema>(webSocketServer.baseURL);

      let readyStateWhileSettingBinaryType: WebSocketClient.ReadyState | undefined;

      // The server accepts the connection only after the client created its socket, so this sets the binary type
      // while the client is still opening.
      webSocketServer.addEventListener('connection', (serverWebSocketClient) => {
        readyStateWhileSettingBinaryType = binaryWebSocketClient.readyState;
        binaryWebSocketClient.binaryType = 'arraybuffer';

        serverWebSocketClient.addEventListener('message', (event) => {
          serverWebSocketClient.send(event.data);
        });
      });

      try {
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
      }
    });
  });

  describe('Messaging', () => {
    it('should throw an invalid state error if sending before opened', () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);
      expect(webSocketClient.readyState).toBe(webSocketClient.CONNECTING);

      expect(() => {
        webSocketClient!.send(JSON.stringify({ type: 'message', data: 'test' }));
      }).toThrow(new DOMException('Still in CONNECTING state.', 'InvalidStateError'));
    });

    it('should throw an invalid state error if sending while connecting', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      let readyStateWhileSending: WebSocketClient.ReadyState | undefined;
      let sendError: unknown;

      // The server accepts the connection before the client receives the handshake, so the client is still connecting.
      webSocketServer.addEventListener('connection', () => {
        readyStateWhileSending = webSocketClient!.readyState;

        try {
          webSocketClient!.send(JSON.stringify({ type: 'message', data: 'test' }));
        } catch (error) {
          sendError = error;
        }
      });

      await webSocketClient.open();

      expect(readyStateWhileSending).toBe(webSocketClient.CONNECTING);
      expect(sendError).toBeInstanceOf(DOMException);
      expect(sendError).toHaveProperty('name', 'InvalidStateError');
    });

    it('should not throw if sending while closing', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);
      await webSocketClient.open();

      const closePromise = webSocketClient.close();
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSING);

      expect(() => {
        webSocketClient!.send(JSON.stringify({ type: 'message', data: 'test' }));
      }).not.toThrow();

      await closePromise;
    });

    it('should not throw if sending after closed', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);
      await webSocketClient.open();

      await webSocketClient.close();
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);

      expect(() => {
        webSocketClient!.send(JSON.stringify({ type: 'message', data: 'test' }));
      }).not.toThrow();
    });

    it('should send and receive messages', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      webSocketServer.addEventListener('connection', (serverWebSocketClient) => {
        serverWebSocketClient.addEventListener('message', (event) => {
          const message = JSON.parse(event.data);

          expectTypeOf(message).toEqualTypeOf<WebSocketSchemaMessage<Schema>>();
          expectTypeOf(message.type).toEqualTypeOf<'message' | 'count'>();
          expectTypeOf(message.data).toEqualTypeOf<string | number>();

          expect(message.type).toBe('message');

          serverWebSocketClient.send(
            JSON.stringify({
              type: 'message',
              data: `response: ${message.data}`,
            }),
          );
        });
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
    });

    it('should send messages from an open listener', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      const serverMessageListener = vi.fn<(data: string) => void>();

      webSocketServer.addEventListener('connection', (serverWebSocketClient) => {
        serverWebSocketClient.addEventListener('message', (event) => {
          serverMessageListener(event.data);
        });
      });

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
      expect(serverMessageListener).toHaveBeenCalledWith(JSON.stringify({ type: 'message', data: 'hello' }));
    });
  });

  describe('Listeners', () => {
    it('should support adding and removing non-unitary listeners', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      const onOpen = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();
      const onMessage = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'message'>>();
      const onClose = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'close'>>();
      const onError = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'error'>>();

      webSocketServer.addEventListener('connection', (serverClient) => {
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
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      const onOpen = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();
      const onMessage = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'message'>>();
      const onClose = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'close'>>();
      const onError = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'error'>>();

      webSocketServer.addEventListener('connection', (serverClient) => {
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
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

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
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      const onOpen = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();
      const openListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();

      webSocketClient.onopen = onOpen;
      webSocketClient.addEventListener('open', openListener);

      await webSocketClient.open();

      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(openListener).toHaveBeenCalledTimes(1);
    });

    it('should not replace non-unitary listeners when multiple are added', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      const openListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();
      const otherOpenListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();

      webSocketClient.addEventListener('open', openListener);
      webSocketClient.addEventListener('open', otherOpenListener);

      await webSocketClient.open();

      expect(openListener).toHaveBeenCalledTimes(1);
      expect(otherOpenListener).toHaveBeenCalledTimes(1);
    });

    it('should not throw when removing non-unitary listeners multiple times', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      const openListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();

      webSocketClient.addEventListener('open', openListener);

      webSocketClient.removeEventListener('open', openListener);
      webSocketClient.removeEventListener('open', openListener);
      webSocketClient.removeEventListener('open', openListener);

      await webSocketClient.open();

      expect(openListener).not.toHaveBeenCalled();
    });

    it('should not throw when clearing unitary listeners multiple times', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      const onOpen = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'open'>>();

      webSocketClient.onopen = onOpen;
      webSocketClient.onopen = null;
      webSocketClient.onopen = null;
      webSocketClient.onopen = null;

      await webSocketClient.open();

      expect(onOpen).not.toHaveBeenCalled();
    });

    it('should allow non-unitary listeners added after opened', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      await webSocketClient.open();

      const closeListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'close'>>();
      webSocketClient.addEventListener('close', closeListener);

      await webSocketClient.close();

      expect(closeListener).toHaveBeenCalledTimes(1);
    });

    it('should allow unitary listeners added after opened', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      await webSocketClient.open();

      const onClose = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'close'>>();
      webSocketClient.onclose = onClose;

      await webSocketClient.close();

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Dispatch Event', () => {
    it('should return false when dispatching with no socket', () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      const errorListener = vi.fn<WebSocketClient.EventListener<WebSocketSchema, 'error'>>();
      webSocketClient.addEventListener('error', errorListener);

      const dispatched = webSocketClient.dispatchEvent(new Event('error'));
      expect(dispatched).toBe(false);

      expect(errorListener).toHaveBeenCalledTimes(0);
    });

    it('should dispatch events through the underlying socket when open', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

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
      const delayedListenerTrigger = delayWebSocketListenerTrigger(100);

      try {
        webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

        const timeoutDuration = 5;

        const openPromise = webSocketClient.open({ timeout: timeoutDuration });
        await expect(openPromise).rejects.toThrow(new WebSocketOpenTimeoutError(timeoutDuration));

        await delayedListenerTrigger.asPromise();

        expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);
      } finally {
        delayedListenerTrigger.restore();
      }
    });

    it('should throw a close timeout error if closing times out', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      await webSocketClient.open();

      const delayedWebSocketClose = delayWebSocketClose(100);

      try {
        const timeoutDuration = 5;

        const closePromise = webSocketClient.close(undefined, undefined, { timeout: timeoutDuration });
        await expect(closePromise).rejects.toThrow(new WebSocketCloseTimeoutError(timeoutDuration));

        await delayedWebSocketClose.toPromise();

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
  });
});
