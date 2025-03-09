import { afterEach, describe, expect, it } from 'vitest';

import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { DEFAULT_HOSTNAME, DEFAULT_LOG_UNHANDLED_REQUESTS } from '../constants';
import InterceptorServer from '../InterceptorServer';

// These are integration tests for the server. Only features not easily reproducible by the CLI and the remote
// interceptor tests are covered here. The main aspects of this class should be tested in the CLI and the remote
// interceptor tests.
describe('Interceptor server', () => {
  let server: InterceptorServer | undefined;

  afterEach(async () => {
    await server?.stop();
  });

  it('should not throw an error is started multiple times', async () => {
    server = createInternalInterceptorServer();

    expect(server.isRunning).toBe(false);

    await server.start();
    expect(server.isRunning).toBe(true);

    await server.start();
    expect(server.isRunning).toBe(true);

    await server.start();
    expect(server.isRunning).toBe(true);
  });

  it('should not throw an error if stopped multiple times', async () => {
    server = createInternalInterceptorServer();

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

  describe('Hostname', () => {
    it('should start correctly with a defined hostname', async () => {
      server = createInternalInterceptorServer({ hostname: '0.0.0.0', port: 8080 });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe('0.0.0.0');
      expect(server.port).toBe(8080);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe('0.0.0.0');
      expect(server.port).toBe(8080);
    });

    it('should start correctly with an undefined hostname', async () => {
      server = createInternalInterceptorServer();

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(undefined);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toEqual(expect.any(Number));
    });

    it('should support changing the hostname after created', async () => {
      server = createInternalInterceptorServer({ port: 8080 });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(8080);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(8080);

      const newHostname = '0.0.0.0';
      expect(newHostname).not.toBe(server.hostname);

      server.hostname = newHostname;
      expect(server.hostname).toBe(newHostname);

      await server.stop();
      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(newHostname);
      expect(server.port).toBe(8080);
    });
  });

  describe('Port', () => {
    it('should start correctly with a defined port', async () => {
      server = createInternalInterceptorServer({ port: 8080 });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(8080);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(8080);
    });

    it('should start correctly with an undefined port', async () => {
      server = createInternalInterceptorServer();

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(undefined);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toEqual(expect.any(Number));
    });

    it('should support changing the port after created', async () => {
      server = createInternalInterceptorServer({ port: 3000 });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(3000);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(3000);

      const newPort = 8080;
      expect(newPort).not.toBe(server.port);

      server.port = newPort;
      expect(server.port).toBe(newPort);

      await server.stop();
      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(newPort);
    });
  });

  describe('Log unhandled requests', () => {
    it('should start correctly with a defined log unhandled requests setting', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: true });

      expect(server.isRunning).toBe(false);
      expect(server.logUnhandledRequests).toBe(true);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.logUnhandledRequests).toBe(true);
    });

    it('should start correctly with an undefined log unhandled requests setting', async () => {
      server = createInternalInterceptorServer();

      expect(server.isRunning).toBe(false);
      expect(server.logUnhandledRequests).toBe(DEFAULT_LOG_UNHANDLED_REQUESTS);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.logUnhandledRequests).toBe(DEFAULT_LOG_UNHANDLED_REQUESTS);
    });

    it('should support changing the log unhandled requests setting after created', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: true });

      expect(server.isRunning).toBe(false);
      expect(server.logUnhandledRequests).toBe(true);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.logUnhandledRequests).toBe(true);

      const newLogUnhandledRequests = false;
      expect(newLogUnhandledRequests).not.toBe(server.logUnhandledRequests);

      server.logUnhandledRequests = newLogUnhandledRequests;
      expect(server.logUnhandledRequests).toBe(newLogUnhandledRequests);

      await server.stop();
      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.logUnhandledRequests).toBe(newLogUnhandledRequests);
    });
  });
});
