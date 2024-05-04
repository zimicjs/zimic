import { Server as HttpServer } from 'http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpServerStartTimeoutError, HttpServerStopTimeoutError } from '@/utils/http';
import { waitForDelay } from '@/utils/time';

import Server from '../Server';

// These are integration tests for the server. Only features not easily reproducible by the CLI and the remote
// interceptor tests are covered here. The main aspects of this class should be tested in the CLI and the remote
// interceptor tests.
describe('Server', () => {
  let server: Server | undefined;

  afterEach(async () => {
    await server?.stop();
  });

  it('should start correctly with a defined port', async () => {
    server = new Server({ hostname: 'localhost', port: 8080 });

    expect(server.isRunning()).toBe(false);
    expect(server.hostname()).toBe('localhost');
    expect(server.port()).toBe(8080);
    expect(server.httpURL()).toBe('http://localhost:8080');

    await server.start();

    expect(server.isRunning()).toBe(true);
    expect(server.hostname()).toBe('localhost');
    expect(server.port()).toBe(8080);
    expect(server.httpURL()).toBe('http://localhost:8080');
  });

  it('should start correctly with an undefined port', async () => {
    server = new Server({ hostname: 'localhost' });

    expect(server.isRunning()).toBe(false);
    expect(server.hostname()).toBe('localhost');
    expect(server.port()).toBe(undefined);
    expect(server.httpURL()).toBe(undefined);

    await server.start();

    expect(server.isRunning()).toBe(true);
    expect(server.hostname()).toBe('localhost');
    expect(server.port()).toEqual(expect.any(Number));
    expect(server.httpURL()).toBe(`http://localhost:${server.port()}`);
  });

  it('should not throw an error is started multiple times', async () => {
    server = new Server({ hostname: 'localhost' });

    expect(server.isRunning()).toBe(false);

    await server.start();
    expect(server.isRunning()).toBe(true);

    await server.start();
    expect(server.isRunning()).toBe(true);

    await server.start();
    expect(server.isRunning()).toBe(true);
  });

  it('should not throw an error if stopped multiple times', async () => {
    server = new Server({ hostname: 'localhost' });

    expect(server.isRunning()).toBe(false);

    await server.start();
    expect(server.isRunning()).toBe(true);

    await server.stop();
    expect(server.isRunning()).toBe(false);

    await server.stop();
    expect(server.isRunning()).toBe(false);

    await server.stop();
    expect(server.isRunning()).toBe(false);
  });

  it('should support having a start timeout', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalListen = HttpServer.prototype.listen;

    vi.spyOn(HttpServer.prototype, 'listen').mockImplementationOnce(function (this: HttpServer, ...args) {
      void waitForDelay(100).then(() => {
        originalListen.apply(this, args);
      });
      return this;
    });

    const lifeCycleTimeout = 0;

    server = new Server({ hostname: 'localhost', lifeCycleTimeout });
    expect(server.isRunning()).toBe(false);

    await expect(async () => {
      await server!.start();
    }).rejects.toThrowError(new HttpServerStartTimeoutError(lifeCycleTimeout));

    expect(server.isRunning()).toBe(false);
  });

  it('should support having a stop timeout', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalClose = HttpServer.prototype.close;

    vi.spyOn(HttpServer.prototype, 'close').mockImplementationOnce(function (this: HttpServer, ...args) {
      void waitForDelay(100).then(() => {
        originalClose.apply(this, args);
      });
      return this;
    });

    const lifeCycleTimeout = 0;

    server = new Server({ hostname: 'localhost', lifeCycleTimeout });

    expect(server.isRunning()).toBe(false);
    await server.start();
    expect(server.isRunning()).toBe(true);

    await expect(async () => {
      await server!.stop();
    }).rejects.toThrowError(new HttpServerStopTimeoutError(lifeCycleTimeout));

    expect(server.isRunning()).toBe(true);
  });
});
