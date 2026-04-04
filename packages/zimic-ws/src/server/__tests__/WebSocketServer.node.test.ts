import { getHttpServerPort, startHttpServer, stopHttpServer } from '@zimic/utils/server';
import { createServer as createHttpServer, Server as HttpServer, IncomingMessage } from 'http';
import { createServer as createHttpsServer } from 'https';
import { Socket } from 'net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebSocketClient } from '@/client/WebSocketClient';

import ClosedWebSocketServerError from '../errors/ClosedWebSocketServerError';
import { WebSocketServer } from '../WebSocketServer';

describe('WebSocketServer', () => {
  let httpServer: HttpServer;
  let webSocketServer: WebSocketServer<{}> | undefined;
  let webSocketClient: WebSocketClient<{}> | undefined;

  beforeEach(async () => {
    httpServer = createHttpServer();
    await startHttpServer(httpServer, { hostname: 'localhost' });
  });

  afterEach(async () => {
    await webSocketServer?.close();
    webSocketServer = undefined;

    await webSocketClient?.close();
    webSocketClient = undefined;

    await stopHttpServer(httpServer);
  });

  describe('Lifecycle', () => {
    it('should start and stop the server socket correctly', async () => {
      webSocketServer = new WebSocketServer({ httpServer });

      expect(httpServer.listening).toBe(true);
      expect(webSocketServer.isOpen).toBe(false);

      await webSocketServer.open();

      expect(httpServer.listening).toBe(true);
      expect(webSocketServer.isOpen).toBe(true);

      await webSocketServer.close();

      expect(httpServer.listening).toBe(true);
      expect(webSocketServer.isOpen).toBe(false);

      await stopHttpServer(httpServer);

      expect(httpServer.listening).toBe(false);
      expect(webSocketServer.isOpen).toBe(false);
    });

    it('should not be open even if the underlying server is listening if not explicitly opened', async () => {
      expect(httpServer.listening).toBe(true);

      webSocketServer = new WebSocketServer({ httpServer });
      expect(webSocketServer.isOpen).toBe(false);

      await stopHttpServer(httpServer);

      expect(httpServer.listening).toBe(false);
      expect(webSocketServer.isOpen).toBe(false);
    });

    it('should not throw an error if opened multiple times', async () => {
      webSocketServer = new WebSocketServer({ httpServer });

      expect(httpServer.listening).toBe(true);
      expect(webSocketServer.isOpen).toBe(false);

      await webSocketServer.open();
      await webSocketServer.open();
      await webSocketServer.open();

      expect(httpServer.listening).toBe(true);
      expect(webSocketServer.isOpen).toBe(true);
    });

    it('should not throw an error if closed multiple times', async () => {
      webSocketServer = new WebSocketServer({ httpServer });

      expect(httpServer.listening).toBe(true);
      expect(webSocketServer.isOpen).toBe(false);

      await webSocketServer.open();

      expect(httpServer.listening).toBe(true);
      expect(webSocketServer.isOpen).toBe(true);

      await webSocketServer.close();
      await webSocketServer.close();
      await webSocketServer.close();

      expect(httpServer.listening).toBe(true);
      expect(webSocketServer.isOpen).toBe(false);

      await stopHttpServer(httpServer);

      expect(httpServer.listening).toBe(false);
      expect(webSocketServer.isOpen).toBe(false);
    });

    it('should close automatically when the underlying server is closed', async () => {
      webSocketServer = new WebSocketServer({ httpServer });

      expect(httpServer.listening).toBe(true);
      expect(webSocketServer.isOpen).toBe(false);

      await webSocketServer.open();

      expect(httpServer.listening).toBe(true);
      expect(webSocketServer.isOpen).toBe(true);

      await stopHttpServer(httpServer);

      expect(httpServer.listening).toBe(false);
      expect(webSocketServer.isOpen).toBe(false);
    });
  });

  describe('Base URL', () => {
    it('should have the correct base URL if open with an underlying HTTP server', async () => {
      webSocketServer = new WebSocketServer({ httpServer });

      await webSocketServer.open();

      expect(webSocketServer.isOpen).toBe(true);
      expect(webSocketServer.baseURL).toBe(`ws://127.0.0.1:${webSocketServer.port}`);
    });

    it('should have the correct base URL if open with an underlying HTTPS server', async () => {
      const httpsServer = createHttpsServer();

      try {
        await startHttpServer(httpsServer, { hostname: 'localhost' });

        webSocketServer = new WebSocketServer({ httpServer: httpsServer });
        await webSocketServer.open();

        expect(webSocketServer.isOpen).toBe(true);
        expect(webSocketServer.baseURL).toBe(`wss://127.0.0.1:${webSocketServer.port}`);
      } finally {
        await stopHttpServer(httpsServer);
      }
    });

    it('should not have a base URL if underlying server is not listening', async () => {
      await stopHttpServer(httpServer);
      expect(httpServer.listening).toBe(false);

      webSocketServer = new WebSocketServer({ httpServer });

      expect(webSocketServer.isOpen).toBe(false);
      expect(() => webSocketServer!.baseURL).toThrow(ClosedWebSocketServerError);
    });

    it('should not have a base URL if not open, even if underlying server is listening', () => {
      expect(httpServer.listening).toBe(true);

      webSocketServer = new WebSocketServer({ httpServer });

      expect(webSocketServer.isOpen).toBe(false);
      expect(() => webSocketServer!.baseURL).toThrow(ClosedWebSocketServerError);
    });
  });

  describe('Hostname', () => {
    it('should have the correct hostname if open', async () => {
      webSocketServer = new WebSocketServer({ httpServer });

      await webSocketServer.open();

      expect(webSocketServer.isOpen).toBe(true);
      expect(webSocketServer.hostname).toBe('127.0.0.1');
    });

    it('should not have a hostname if underlying server is not listening', async () => {
      await stopHttpServer(httpServer);
      expect(httpServer.listening).toBe(false);

      webSocketServer = new WebSocketServer({ httpServer });

      expect(webSocketServer.isOpen).toBe(false);
      expect(() => webSocketServer!.hostname).toThrow(ClosedWebSocketServerError);
    });

    it('should not have a hostname if not open, even if underlying server is listening', () => {
      expect(httpServer.listening).toBe(true);

      webSocketServer = new WebSocketServer({ httpServer });

      expect(webSocketServer.isOpen).toBe(false);
      expect(() => webSocketServer!.hostname).toThrow(ClosedWebSocketServerError);
    });
  });

  describe('Port', () => {
    it('should have the correct port if open', async () => {
      webSocketServer = new WebSocketServer({ httpServer });

      await webSocketServer.open();

      expect(webSocketServer.isOpen).toBe(true);
      expect(webSocketServer.port).toBe(getHttpServerPort(httpServer));
    });

    it('should not have a port if underlying server is not listening', async () => {
      await stopHttpServer(httpServer);
      expect(httpServer.listening).toBe(false);

      webSocketServer = new WebSocketServer({ httpServer });

      expect(webSocketServer.isOpen).toBe(false);
      expect(() => webSocketServer!.port).toThrow(ClosedWebSocketServerError);
    });

    it('should not have a port if not open, even if underlying server is listening', () => {
      expect(httpServer.listening).toBe(true);

      webSocketServer = new WebSocketServer({ httpServer });

      expect(webSocketServer.isOpen).toBe(false);
      expect(() => webSocketServer!.port).toThrow(ClosedWebSocketServerError);
    });
  });

  describe('Listeners', () => {
    it('should trigger connection listeners', async () => {
      webSocketServer = new WebSocketServer({ httpServer });

      const connectionListener = vi.fn();
      webSocketServer.addEventListener('connection', connectionListener);

      await webSocketServer.open();

      webSocketClient = new WebSocketClient(webSocketServer.baseURL);

      expect(connectionListener).toHaveBeenCalledTimes(0);

      await webSocketClient.open();

      expect(connectionListener).toHaveBeenCalledTimes(1);
      expect(connectionListener).toHaveBeenCalledWith(
        expect.any(WebSocketClient),
        expect.objectContaining({ url: '/' }),
      );

      const otherWebSocketClient = new WebSocketClient(webSocketServer.baseURL);

      try {
        await otherWebSocketClient.open();

        expect(connectionListener).toHaveBeenCalledTimes(2);
        expect(connectionListener).toHaveBeenNthCalledWith(
          2,
          expect.any(WebSocketClient),
          expect.objectContaining({ url: '/' }),
        );
      } finally {
        await otherWebSocketClient.close();
      }
    });

    it('should trigger error listeners', async () => {
      webSocketServer = new WebSocketServer({ httpServer });
      await webSocketServer.open();

      const errorListener = vi.fn();
      webSocketServer.addEventListener('error', errorListener);

      const error = new Error();
      webSocketServer.emit('error', error);

      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(errorListener).toHaveBeenCalledWith(error);
    });

    it('should trigger listening listeners', async () => {
      await stopHttpServer(httpServer);

      webSocketServer = new WebSocketServer({ httpServer });

      const listeningListener = vi.fn();
      webSocketServer.addEventListener('listening', listeningListener);

      expect(listeningListener).toHaveBeenCalledTimes(0);

      const openPromise = webSocketServer.open();
      await startHttpServer(httpServer, { hostname: 'localhost' });

      await openPromise;

      expect(listeningListener).toHaveBeenCalledTimes(1);
    });

    it('should trigger close listeners', async () => {
      webSocketServer = new WebSocketServer({ httpServer });

      const closeListener = vi.fn();
      webSocketServer.addEventListener('close', closeListener);

      await webSocketServer.open();

      expect(closeListener).toHaveBeenCalledTimes(0);

      await webSocketServer.close();

      expect(closeListener).toHaveBeenCalledTimes(1);
    });

    it('should support triggering listeners directly with emit without opening the server', () => {
      webSocketServer = new WebSocketServer({ httpServer });

      const connectionListener = vi.fn();
      webSocketServer.addEventListener('connection', connectionListener);

      const webSocketClient = new WebSocketClient('');
      const request = new IncomingMessage(new Socket());
      webSocketServer.emit('connection', webSocketClient, request);
      expect(connectionListener).toHaveBeenCalledTimes(1);
      expect(connectionListener).toHaveBeenCalledWith(webSocketClient, request);

      const errorListener = vi.fn();
      webSocketServer.addEventListener('error', errorListener);

      const error = new Error();
      webSocketServer.emit('error', error);
      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(errorListener).toHaveBeenCalledWith(error);

      const listeningListener = vi.fn();
      webSocketServer.addEventListener('listening', listeningListener);

      webSocketServer.emit('listening');
      expect(listeningListener).toHaveBeenCalledTimes(1);

      const closeListener = vi.fn();
      webSocketServer.addEventListener('close', closeListener);

      webSocketServer.emit('close');
      expect(closeListener).toHaveBeenCalledTimes(1);
    });

    it('should support triggering listeners directly with emit after opening the server', async () => {
      webSocketServer = new WebSocketServer({ httpServer });
      await webSocketServer.open();

      const connectionListener = vi.fn();
      webSocketServer.addEventListener('connection', connectionListener);

      const webSocketClient = new WebSocketClient('');
      const request = new IncomingMessage(new Socket());
      webSocketServer.emit('connection', webSocketClient, request);

      expect(connectionListener).toHaveBeenCalledTimes(1);
      expect(connectionListener).toHaveBeenCalledWith(webSocketClient, request);

      const errorListener = vi.fn();
      webSocketServer.addEventListener('error', errorListener);

      const error = new Error();
      webSocketServer.emit('error', error);
      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(errorListener).toHaveBeenCalledWith(error);

      const listeningListener = vi.fn();
      webSocketServer.addEventListener('listening', listeningListener);

      webSocketServer.emit('listening');
      expect(listeningListener).toHaveBeenCalledTimes(1);

      const closeListener = vi.fn();
      webSocketServer.addEventListener('close', closeListener);

      webSocketServer.emit('close');
      expect(closeListener).toHaveBeenCalledTimes(1);
    });

    it('should not trigger removed listeners', async () => {
      webSocketServer = new WebSocketServer({ httpServer });

      const closeListener = vi.fn();
      webSocketServer.addEventListener('close', closeListener);
      webSocketServer.removeEventListener('close', closeListener);

      await webSocketServer.open();
      await webSocketServer.close();

      expect(closeListener).not.toHaveBeenCalled();
    });

    it('should not throw error if a listener is removed multiple times', async () => {
      webSocketServer = new WebSocketServer({ httpServer });

      const closeListener = vi.fn();
      webSocketServer.addEventListener('close', closeListener);

      webSocketServer.removeEventListener('close', closeListener);
      webSocketServer.removeEventListener('close', closeListener);
      webSocketServer.removeEventListener('close', closeListener);

      await webSocketServer.open();
      await webSocketServer.close();

      expect(closeListener).not.toHaveBeenCalled();
    });

    it('should not duplicate listeners after opening repeatedly', async () => {
      webSocketServer = new WebSocketServer({ httpServer });

      const connectionListener = vi.fn();
      webSocketServer.addEventListener('connection', connectionListener);

      await webSocketServer.open();
      await webSocketServer.open();
      await webSocketServer.open();

      webSocketClient = new WebSocketClient(webSocketServer.baseURL);
      await webSocketClient.open();

      expect(connectionListener).toHaveBeenCalledTimes(1);
    });

    it('should preserve listeners after closing and reopening', async () => {
      webSocketServer = new WebSocketServer({ httpServer });

      const connectionListener = vi.fn();
      webSocketServer.addEventListener('connection', connectionListener);

      const closeListener = vi.fn();
      webSocketServer.addEventListener('close', closeListener);

      await webSocketServer.open();

      webSocketClient = new WebSocketClient(webSocketServer.baseURL);
      await webSocketClient.open();

      expect(connectionListener).toHaveBeenCalledTimes(1);
      expect(closeListener).toHaveBeenCalledTimes(0);

      await webSocketServer.close();

      expect(connectionListener).toHaveBeenCalledTimes(1);
      expect(closeListener).toHaveBeenCalledTimes(1);

      await webSocketServer.open();

      expect(connectionListener).toHaveBeenCalledTimes(1);
      expect(closeListener).toHaveBeenCalledTimes(1);

      await webSocketClient.open();

      expect(connectionListener).toHaveBeenCalledTimes(2);
      expect(closeListener).toHaveBeenCalledTimes(1);
    });
  });
});
