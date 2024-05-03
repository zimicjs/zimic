import { createServer } from 'http';
import ClientSocket from 'isomorphic-ws';
import { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startHttpServer, stopHttpServer } from '@/utils/http';
import { closeClientSocket, waitForOpenClientSocket } from '@/utils/webSocket';
import { usingIgnoredConsole } from '@tests/utils/console';
import { waitFor } from '@tests/utils/time';

import InvalidWebSocketMessage from '../errors/InvalidWebSocketMessage';
import NotStartedWebSocketHandlerError from '../errors/NotStartedWebSocketHandlerError';
import { WebSocket } from '../types';
import WebSocketServer from '../WebSocketServer';

// These are integration tests for the web socket server. Only features not easily reproducible by the remote
// interceptor tests are covered here. The main aspects of this class should be tested in the remote interceptor tests.
describe('Web socket server', () => {
  const httpServer = createServer();
  let httpServerPort: number;

  type Schema = WebSocket.ServiceSchema<{
    'my-channel': {
      event: { message: string };
      reply: {};
    };
  }>;

  let server: WebSocketServer<Schema> | undefined;
  let rawClient: ClientSocket | undefined;

  beforeEach(async () => {
    await startHttpServer(httpServer);
    const httpServerAddress = httpServer.address() as AddressInfo;
    httpServerPort = httpServerAddress.port;
  });

  afterEach(async () => {
    if (rawClient) {
      await closeClientSocket(rawClient);
      rawClient = undefined;
    }

    await server?.stop();
    server = undefined;

    await stopHttpServer(httpServer);
  });

  it('should support being started', () => {
    server = new WebSocketServer({ httpServer });
    expect(server.isRunning()).toBe(false);

    server.start();

    expect(server.isRunning()).toBe(true);
  });

  it('should not throw an error if being started multiple times', () => {
    server = new WebSocketServer({ httpServer });
    expect(server.isRunning()).toBe(false);

    server.start();
    server.start();
    server.start();

    expect(server.isRunning()).toBe(true);
  });

  it('should support being stopped', async () => {
    server = new WebSocketServer({ httpServer });
    server.start();
    expect(server.isRunning()).toBe(true);

    await server.stop();

    expect(server.isRunning()).toBe(false);
  });

  it('should not throw an error if being stopped multiple times', async () => {
    server = new WebSocketServer({ httpServer });
    server.start();
    expect(server.isRunning()).toBe(true);

    await server.stop();
    await server.stop();
    await server.stop();

    expect(server.isRunning()).toBe(false);
  });

  it('should log http server errors to the console', async () => {
    server = new WebSocketServer({ httpServer });
    server.start();

    await usingIgnoredConsole(['error'], (spies) => {
      const error = new Error('Test error');
      httpServer.emit('error', error);

      expect(spies.error).toHaveBeenCalledWith(error);
    });
  });

  it('should log an error after receiving a message that is not JSON-compatible', async () => {
    server = new WebSocketServer({ httpServer });
    server.start();

    rawClient = new ClientSocket(`ws://localhost:${httpServerPort}`);
    await waitForOpenClientSocket(rawClient);

    await usingIgnoredConsole(['error'], async (spies) => {
      const invalidMessage = 'invalid-message';
      rawClient?.send(invalidMessage);

      await waitFor(() => {
        expect(spies.error).toHaveBeenCalledWith(new InvalidWebSocketMessage(invalidMessage));
      });
    });
  });

  it('should log an error after receiving a JSON message not following the expected structure', async () => {
    server = new WebSocketServer({ httpServer });
    server.start();

    rawClient = new ClientSocket(`ws://localhost:${httpServerPort}`);
    await waitForOpenClientSocket(rawClient);

    await usingIgnoredConsole(['error'], async (spies) => {
      const invalidMessage = JSON.stringify({ type: 'unknown' });
      rawClient?.send(invalidMessage);

      await waitFor(() => {
        expect(spies.error).toHaveBeenCalledWith(new InvalidWebSocketMessage(invalidMessage));
      });
    });
  });

  it('should throw an error if trying to send a message not running', async () => {
    server = new WebSocketServer({ httpServer });
    await server.stop();

    await expect(async () => {
      await server?.request('my-channel', { message: 'test' });
    }).rejects.toThrowError(new NotStartedWebSocketHandlerError());
  });
});
