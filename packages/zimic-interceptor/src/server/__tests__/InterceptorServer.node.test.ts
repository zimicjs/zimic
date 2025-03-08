import { afterEach, describe, expect, it } from 'vitest';

import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import InterceptorServer from '../InterceptorServer';

// These are integration tests for the server. Only features not easily reproducible by the CLI and the remote
// interceptor tests are covered here. The main aspects of this class should be tested in the CLI and the remote
// interceptor tests.
describe('Interceptor server', () => {
  let server: InterceptorServer | undefined;

  afterEach(async () => {
    await server?.stop();
  });

  it('should start correctly with a defined port', async () => {
    server = createInternalInterceptorServer({ hostname: 'localhost', port: 8080 });

    expect(server.isRunning).toBe(false);
    expect(server.hostname).toBe('localhost');
    expect(server.port).toBe(8080);

    await server.start();

    expect(server.isRunning).toBe(true);
    expect(server.hostname).toBe('localhost');
    expect(server.port).toBe(8080);
  });

  it('should start correctly with an undefined port', async () => {
    server = createInternalInterceptorServer({ hostname: 'localhost' });

    expect(server.isRunning).toBe(false);
    expect(server.hostname).toBe('localhost');
    expect(server.port).toBe(undefined);

    await server.start();

    expect(server.isRunning).toBe(true);
    expect(server.hostname).toBe('localhost');
    expect(server.port).toEqual(expect.any(Number));
  });

  it('should not throw an error is started multiple times', async () => {
    server = createInternalInterceptorServer({ hostname: 'localhost' });

    expect(server.isRunning).toBe(false);

    await server.start();
    expect(server.isRunning).toBe(true);

    await server.start();
    expect(server.isRunning).toBe(true);

    await server.start();
    expect(server.isRunning).toBe(true);
  });

  it('should not throw an error if stopped multiple times', async () => {
    server = createInternalInterceptorServer({ hostname: 'localhost' });

    expect(server.isRunning).toBe(false);

    await server.start();
    expect(server.isRunning).toBe(true);

    await server.stop();
    expect(server.isRunning).toBe(false);

    await server.stop();
    expect(server.isRunning).toBe(false);

    await server.stop();
    expect(server.isRunning).toBe(false);
  });

  it('should use the default values for optional parameters if not provided', () => {
    server = createInternalInterceptorServer();

    expect(server.hostname).toBe('localhost');
    expect(server.port).toBe(undefined);
    expect(server.logUnhandledRequests).toBe(true);
    expect(server.httpURL).toBe(undefined);
  });
});
