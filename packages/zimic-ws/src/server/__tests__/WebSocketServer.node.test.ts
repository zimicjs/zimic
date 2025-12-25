import { startHttpServer, stopHttpServer } from '@zimic/utils/server/lifecycle';
import { createServer as createHttpServer } from 'http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import WebSocketServer from '../WebSocketServer';

describe('WebSocketServer', () => {
  const httpServer = createHttpServer();

  beforeEach(async () => {
    await startHttpServer(httpServer);
  });

  afterEach(async () => {
    await stopHttpServer(httpServer);
  });

  it('should be listening if the underlying server is listening', async () => {
    expect(httpServer.listening).toBe(true);

    const server = new WebSocketServer({ server: httpServer });
    expect(server.isRunning).toBe(true);

    await stopHttpServer(httpServer);

    expect(httpServer.listening).toBe(false);
    expect(server.isRunning).toBe(false);
  });

  it('should start and stop the server socket correctly', async () => {
    const server = new WebSocketServer({ server: httpServer });

    expect(httpServer.listening).toBe(true);
    expect(server.isRunning).toBe(true);

    await server.start();

    expect(httpServer.listening).toBe(true);
    expect(server.isRunning).toBe(true);

    await server.stop();

    expect(httpServer.listening).toBe(true);
    expect(server.isRunning).toBe(false);

    await stopHttpServer(httpServer);

    expect(httpServer.listening).toBe(false);
    expect(server.isRunning).toBe(false);
  });

  it('should not throw an error if started multiple times', async () => {
    const server = new WebSocketServer({ server: httpServer });

    expect(httpServer.listening).toBe(true);
    expect(server.isRunning).toBe(true);

    await server.start();
    await server.start();
    await server.start();

    expect(httpServer.listening).toBe(true);
    expect(server.isRunning).toBe(true);
  });

  it('should not throw an error if stopped multiple times', async () => {
    const server = new WebSocketServer({ server: httpServer });

    expect(httpServer.listening).toBe(true);
    expect(server.isRunning).toBe(true);

    await server.stop();
    await server.stop();
    await server.stop();

    expect(httpServer.listening).toBe(true);
    expect(server.isRunning).toBe(false);

    await stopHttpServer(httpServer);

    expect(httpServer.listening).toBe(false);
    expect(server.isRunning).toBe(false);
  });

  it('should stop automatically when the underlying server is stopped', async () => {
    const server = new WebSocketServer({ server: httpServer });

    expect(httpServer.listening).toBe(true);
    expect(server.isRunning).toBe(true);

    await stopHttpServer(httpServer);

    expect(httpServer.listening).toBe(false);
    expect(server.isRunning).toBe(false);
  });
});
