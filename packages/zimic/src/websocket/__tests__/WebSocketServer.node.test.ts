import { createServer } from 'http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startHttpServer, stopHttpServer } from '@/utils/http';
import { usingIgnoredConsole } from '@tests/utils/console';

import WebSocketServer from '../WebSocketServer';

describe('Web socket server', () => {
  const httpServer = createServer();
  let websocketServer: WebSocketServer<{}> | undefined;

  beforeEach(async () => {
    await startHttpServer(httpServer);
  });

  afterEach(async () => {
    await websocketServer?.stop();
    await stopHttpServer(httpServer);
  });

  it('should support being started', () => {
    websocketServer = new WebSocketServer({ httpServer });
    expect(websocketServer.isRunning()).toBe(false);

    websocketServer.start();

    expect(websocketServer.isRunning()).toBe(true);
  });

  it('should not throw an error if being started multiple times', () => {
    websocketServer = new WebSocketServer({ httpServer });
    expect(websocketServer.isRunning()).toBe(false);

    websocketServer.start();
    websocketServer.start();
    websocketServer.start();

    expect(websocketServer.isRunning()).toBe(true);
  });

  it('should support being stopped', async () => {
    websocketServer = new WebSocketServer({ httpServer });
    websocketServer.start();
    expect(websocketServer.isRunning()).toBe(true);

    await websocketServer.stop();

    expect(websocketServer.isRunning()).toBe(false);
  });

  it('should not throw an error if being stopped multiple times', async () => {
    websocketServer = new WebSocketServer({ httpServer });
    websocketServer.start();
    expect(websocketServer.isRunning()).toBe(true);

    await websocketServer.stop();
    await websocketServer.stop();
    await websocketServer.stop();

    expect(websocketServer.isRunning()).toBe(false);
  });

  it('should log errors to the console', async () => {
    websocketServer = new WebSocketServer({ httpServer });
    websocketServer.start();

    await usingIgnoredConsole(['error'], (spies) => {
      const error = new Error('Test error');
      httpServer.emit('error', error);

      expect(spies.error).toHaveBeenCalledWith(error);
    });
  });
});
