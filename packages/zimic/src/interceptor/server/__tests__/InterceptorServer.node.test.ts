import { afterEach, describe, expect, it } from 'vitest';

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
    server = new InterceptorServer({ hostname: 'localhost', port: 8080 });

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
    server = new InterceptorServer({ hostname: 'localhost' });

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
    server = new InterceptorServer({ hostname: 'localhost' });

    expect(server.isRunning()).toBe(false);

    await server.start();
    expect(server.isRunning()).toBe(true);

    await server.start();
    expect(server.isRunning()).toBe(true);

    await server.start();
    expect(server.isRunning()).toBe(true);
  });

  it('should not throw an error if stopped multiple times', async () => {
    server = new InterceptorServer({ hostname: 'localhost' });

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
});
