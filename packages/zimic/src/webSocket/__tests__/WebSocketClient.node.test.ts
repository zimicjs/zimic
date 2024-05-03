import { createServer } from 'http';
import ClientSocket from 'isomorphic-ws';
import { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startHttpServer, stopHttpServer } from '@/utils/http';
import { closeServerSocket } from '@/utils/webSocket';
import { usingIgnoredConsole } from '@tests/utils/console';
import { waitFor } from '@tests/utils/time';

import InvalidWebSocketMessage from '../errors/InvalidWebSocketMessage';
import NotStartedWebSocketHandlerError from '../errors/NotStartedWebSocketHandlerError';
import { WebSocket } from '../types';
import WebSocketClient from '../WebSocketClient';

const { WebSocketServer: ServerSocket } = ClientSocket;

// These are integration tests for the web socket client. Only features not easily reproducible by the remote
// interceptor tests are covered here. The main aspects of this class should be tested in the remote interceptor tests.
describe('Web socket client', () => {
  const httpServer = createServer();
  let httpServerPort: number;

  type Schema = WebSocket.ServiceSchema<{
    'my-channel': {
      event: { message: string };
      reply: {};
    };
  }>;

  let rawServer: InstanceType<typeof ServerSocket> | undefined;
  let client: WebSocketClient<Schema> | undefined;

  beforeEach(async () => {
    await startHttpServer(httpServer);
    const httpServerAddress = httpServer.address() as AddressInfo;
    httpServerPort = httpServerAddress.port;

    rawServer = new ServerSocket({ server: httpServer });
  });

  afterEach(async () => {
    await client?.stop();
    client = undefined;

    if (rawServer) {
      await closeServerSocket(rawServer);
      rawServer = undefined;
    }

    await stopHttpServer(httpServer);
  });

  it('should support being started', async () => {
    client = new WebSocketClient({ url: `ws://localhost:${httpServerPort}` });

    expect(client.isRunning()).toBe(false);

    await client.start();

    expect(client.isRunning()).toBe(true);
  });

  it('should not throw an error if being started multiple times', async () => {
    client = new WebSocketClient({ url: `ws://localhost:${httpServerPort}` });

    expect(client.isRunning()).toBe(false);

    await client.start();
    await client.start();
    await client.start();

    expect(client.isRunning()).toBe(true);
  });

  it('should support being stopped', async () => {
    client = new WebSocketClient({ url: `ws://localhost:${httpServerPort}` });

    await client.start();
    expect(client.isRunning()).toBe(true);

    await client.stop();

    expect(client.isRunning()).toBe(false);
  });

  it('should not throw an error if being stopped multiple times', async () => {
    client = new WebSocketClient({ url: `ws://localhost:${httpServerPort}` });

    await client.start();
    expect(client.isRunning()).toBe(true);

    await client.stop();
    await client.stop();
    await client.stop();

    expect(client.isRunning()).toBe(false);
  });

  it('should log an error after receiving a message that is not JSON-compatible', async () => {
    const rawServerSockets: ClientSocket[] = [];
    rawServer?.on('connection', (socket) => rawServerSockets.push(socket));

    client = new WebSocketClient({ url: `ws://localhost:${httpServerPort}` });

    expect(rawServerSockets).toHaveLength(0);
    await client.start();
    expect(rawServerSockets).toHaveLength(1);

    await usingIgnoredConsole(['error'], async (spies) => {
      const invalidMessage = 'invalid-message';
      rawServerSockets[0].send(invalidMessage);

      await waitFor(() => {
        expect(spies.error).toHaveBeenCalledWith(new InvalidWebSocketMessage(invalidMessage));
      });
    });
  });

  it('should log an error after receiving a JSON message not following the expected structure', async () => {
    const rawServerSockets: ClientSocket[] = [];
    rawServer?.on('connection', (socket) => rawServerSockets.push(socket));

    client = new WebSocketClient({ url: `ws://localhost:${httpServerPort}` });

    expect(rawServerSockets).toHaveLength(0);
    await client.start();
    expect(rawServerSockets).toHaveLength(1);

    await usingIgnoredConsole(['error'], async (spies) => {
      const invalidMessage = JSON.stringify({ type: 'invalid-message' });
      rawServerSockets[0].send(invalidMessage);

      await waitFor(() => {
        expect(spies.error).toHaveBeenCalledWith(new InvalidWebSocketMessage(invalidMessage));
      });
    });
  });

  it('should throw an error if trying to send a message not running', async () => {
    client = new WebSocketClient({ url: `ws://localhost:${httpServerPort}` });

    await expect(async () => {
      await client?.request('my-channel', { message: 'test' });
    }).rejects.toThrowError(new NotStartedWebSocketHandlerError());
  });
});
