import { startHttpServer, stopHttpServer } from '@zimic/utils/server';
import { createServer as createHttpServer } from 'http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WebSocketServer } from '../WebSocketServer';

describe('WebSocketServer', () => {
  const httpServer = createHttpServer();

  beforeEach(async () => {
    await startHttpServer(httpServer);
  });

  afterEach(async () => {
    await stopHttpServer(httpServer);
  });

  it('should be running if the underlying server is listening', async () => {
    expect(httpServer.listening).toBe(true);

    const server = new WebSocketServer({ server: httpServer });
    expect(server.isOpen).toBe(true);

    await stopHttpServer(httpServer);

    expect(httpServer.listening).toBe(false);
    expect(server.isOpen).toBe(false);
  });

  it('should start and stop the server socket correctly', async () => {
    const server = new WebSocketServer({ server: httpServer });

    expect(httpServer.listening).toBe(true);
    expect(server.isOpen).toBe(true);

    await server.open();

    expect(httpServer.listening).toBe(true);
    expect(server.isOpen).toBe(true);

    await server.close();

    expect(httpServer.listening).toBe(true);
    expect(server.isOpen).toBe(false);

    await stopHttpServer(httpServer);

    expect(httpServer.listening).toBe(false);
    expect(server.isOpen).toBe(false);
  });

  it('should not throw an error if started multiple times', async () => {
    const server = new WebSocketServer({ server: httpServer });

    expect(httpServer.listening).toBe(true);
    expect(server.isOpen).toBe(true);

    await server.open();
    await server.open();
    await server.open();

    expect(httpServer.listening).toBe(true);
    expect(server.isOpen).toBe(true);
  });

  it('should not throw an error if stopped multiple times', async () => {
    const server = new WebSocketServer({ server: httpServer });

    expect(httpServer.listening).toBe(true);
    expect(server.isOpen).toBe(true);

    await server.close();
    await server.close();
    await server.close();

    expect(httpServer.listening).toBe(true);
    expect(server.isOpen).toBe(false);

    await stopHttpServer(httpServer);

    expect(httpServer.listening).toBe(false);
    expect(server.isOpen).toBe(false);
  });

  it('should stop automatically when the underlying server is stopped', async () => {
    const server = new WebSocketServer({ server: httpServer });

    expect(httpServer.listening).toBe(true);
    expect(server.isOpen).toBe(true);

    await stopHttpServer(httpServer);

    expect(httpServer.listening).toBe(false);
    expect(server.isOpen).toBe(false);
  });
});
