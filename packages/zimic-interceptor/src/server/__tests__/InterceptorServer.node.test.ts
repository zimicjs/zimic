import { afterEach, describe, expect, it } from 'vitest';

import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { DEFAULT_HOSTNAME, DEFAULT_LOG_UNHANDLED_REQUESTS } from '../constants';
import RunningInterceptorServerError from '../errors/RunningInterceptorServerError';
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
      server = createInternalInterceptorServer({ hostname: undefined });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(undefined);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toEqual(expect.any(Number));
    });

    it('should support changing the hostname after created', async () => {
      server = createInternalInterceptorServer({ hostname: undefined, port: 8080 });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(8080);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(8080);

      const newHostname = '0.0.0.0';
      expect(newHostname).not.toBe(server.hostname);

      await server.stop();
      expect(server.isRunning).toBe(false);

      server.hostname = newHostname;

      await server.start();
      expect(server.isRunning).toBe(true);

      expect(server.hostname).toBe(newHostname);

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(newHostname);
      expect(server.port).toBe(8080);
    });

    it('should not support changing the hostname after created if the server is running', async () => {
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

      expect(server.isRunning).toBe(true);

      expect(() => {
        server!.hostname = newHostname;
      }).toThrowError(new RunningInterceptorServerError('Did you forget to stop it before changing the hostname?'));

      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.hostname).not.toBe(newHostname);
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
      server = createInternalInterceptorServer({ port: undefined });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(undefined);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toEqual(expect.any(Number));
    });

    it('should support changing the port after created', async () => {
      server = createInternalInterceptorServer({ port: 5002 });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(5002);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(5002);

      const newPort = 5003;
      expect(newPort).not.toBe(server.port);

      await server.stop();
      expect(server.isRunning).toBe(false);

      server.port = newPort;

      await server.start();
      expect(server.isRunning).toBe(true);

      expect(server.port).toBe(newPort);

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(newPort);
    });

    it('should not support changing the port after created if the server is running', async () => {
      server = createInternalInterceptorServer({ port: 5004 });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(5004);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(5004);

      const newPort = 5005;
      expect(newPort).not.toBe(server.port);

      expect(server.isRunning).toBe(true);

      expect(() => {
        server!.port = newPort;
      }).toThrowError(new RunningInterceptorServerError('Did you forget to stop it before changing the port?'));

      expect(server.port).toBe(5004);
      expect(server.port).not.toBe(newPort);
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
      server = createInternalInterceptorServer({ logUnhandledRequests: undefined });

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
