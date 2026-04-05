import { startHttpServer, stopHttpServer } from '@zimic/utils/server';
import { waitFor, waitForNot } from '@zimic/utils/time';
import { createServer as createHttpServer, Server as HttpServer } from 'http';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { WebSocketServer } from '@/server';
import { WebSocketSchema } from '@/types/schema';

import { openWebSocketClient } from '../utils/lifecycle';
import { WebSocketClient } from '../WebSocketClient';

describe('WebSocketClient', () => {
  let httpServer: HttpServer;

  type Schema = WebSocketSchema<{
    type: 'message';
    data: string;
  }>;

  let webSocketServer: WebSocketServer<Schema>;
  let webSocketClient: WebSocketClient<Schema> | undefined;

  beforeEach(async () => {
    httpServer = createHttpServer();
    webSocketServer = new WebSocketServer({ httpServer });

    await startHttpServer(httpServer, { hostname: 'localhost' });
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
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);

      await webSocketClient.open();
      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);

      await webSocketClient.close();
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);
    });

    it('should not throw an error if opened multiple times', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);

      await webSocketClient.open();
      await webSocketClient.open();
      await webSocketClient.open();

      expect(webSocketClient.readyState).toBe(webSocketClient.OPEN);
    });

    it('should not throw an error if closed multiple times', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);

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

    it('should support construction from an already-created native socket', async () => {
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
      expect(webSocketClient.readyState).toBe(webSocketClient.CLOSED);
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
  });

  describe('Messaging', () => {
    it('should not throw if sending while closed', () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      expect(() => {
        webSocketClient!.send(
          JSON.stringify({
            type: 'message',
            data: 'test',
          }),
        );
      }).not.toThrow();
    });

    it('should send and receive messages', async () => {
      webSocketClient = new WebSocketClient<Schema>(webSocketServer.baseURL);

      webSocketServer.addEventListener('connection', (serverWebSocketClient) => {
        serverWebSocketClient.addEventListener('message', (event) => {
          const message = JSON.parse(event.data);
          expectTypeOf(message).toEqualTypeOf<Schema>();

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
});
