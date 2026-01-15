import { HttpSchema } from '@zimic/http';
import { expectFetchError } from '@zimic/utils/fetch';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { createInternalHttpInterceptor } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { DEFAULT_HOSTNAME, DEFAULT_LOG_UNHANDLED_REQUESTS } from '../constants';
import RunningInterceptorServerError from '../errors/RunningInterceptorServerError';
import InterceptorServer from '../InterceptorServer';
import { DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY } from '../utils/auth';

// These are integration tests for the server. Only features not easily reproducible by the CLI and the remote
// interceptor tests are covered here. The main aspects of this class should be tested in the CLI and the remote
// interceptor tests.
describe('Interceptor server', () => {
  let server: InterceptorServer | undefined;

  afterEach(async () => {
    await server?.stop();
  });

  describe('Lifecycle', () => {
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

    it('should not throw an error if stopped at the same time a connected interceptor is stopped', async () => {
      server = createInternalInterceptorServer();

      await server.start();
      expect(server.isRunning).toBe(true);

      const interceptor = createInternalHttpInterceptor({
        type: 'remote',
        baseURL: `http://${server.hostname}:${server.port}`,
      });
      expect(interceptor.isRunning).toBe(false);

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);

      await Promise.all([server.stop(), interceptor.stop()]);

      expect(server.isRunning).toBe(false);
      expect(interceptor.isRunning).toBe(false);
    });

    it('should not throw an error if stopped at the same time a connected interceptor is cleared', async () => {
      server = createInternalInterceptorServer();

      await server.start();
      expect(server.isRunning).toBe(true);

      const interceptor = createInternalHttpInterceptor({
        type: 'remote',
        baseURL: `http://${server.hostname}:${server.port}`,
      });
      expect(interceptor.isRunning).toBe(false);

      try {
        await interceptor.start();

        expect(interceptor.isRunning).toBe(true);

        await Promise.all([server.stop(), interceptor.clear()]);

        expect(server.isRunning).toBe(false);
        expect(interceptor.isRunning).toBe(true);
      } finally {
        await interceptor.stop();

        expect(server.isRunning).toBe(false);
        expect(interceptor.isRunning).toBe(false);
      }
    });

    it('should only reset handlers of cleared interceptors, preserving handlers of other interceptors even if they share the same base URL', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });

      await server.start();
      expect(server.isRunning).toBe(true);

      type Schema = HttpSchema<{
        '/': {
          GET: {
            response: { 204: {} };
          };
        };
      }>;

      const interceptors = [
        createInternalHttpInterceptor<Schema>({
          type: 'remote',
          baseURL: `http://${server.hostname}:${server.port}/path`,
        }),
        createInternalHttpInterceptor<Schema>({
          type: 'remote',
          baseURL: `http://${server.hostname}:${server.port}/path`,
        }),
        createInternalHttpInterceptor<Schema>({
          type: 'remote',
          baseURL: `http://${server.hostname}:${server.port}/other-path`,
        }),
      ];

      expect(interceptors[0].baseURL).toBe(interceptors[1].baseURL);
      expect(interceptors[0].baseURL).not.toBe(interceptors[2].baseURL);

      for (const interceptor of interceptors) {
        expect(interceptor.isRunning).toBe(false);
      }

      try {
        await Promise.all(interceptors.map((interceptor) => interceptor.start()));

        for (const interceptor of interceptors) {
          expect(interceptor.isRunning).toBe(true);
        }

        const handlers = await Promise.all(
          interceptors.map((interceptor) => interceptor.get('/').respond({ status: 204 })),
        );

        let response = await fetch(interceptors[0].baseURL, { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(1);
        expect(handlers[2].requests).toHaveLength(0);

        let responsePromise = fetch(interceptors[1].baseURL, { method: 'GET' });
        await interceptors[1].clear();

        response = await responsePromise;
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(1); // Request was processed by the first handler
        expect(handlers[1].requests).toHaveLength(0);
        expect(handlers[2].requests).toHaveLength(0);

        responsePromise = fetch(interceptors[0].baseURL, { method: 'GET' });
        await interceptors[0].clear();
        await expectFetchError(responsePromise);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(0);
        expect(handlers[2].requests).toHaveLength(0);

        responsePromise = fetch(interceptors[2].baseURL, { method: 'GET' });
        await interceptors[2].clear();
        await expectFetchError(responsePromise);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(0);
        expect(handlers[2].requests).toHaveLength(0);
      } finally {
        await Promise.all(interceptors.map((interceptor) => interceptor.stop()));

        for (const interceptor of interceptors) {
          expect(interceptor.isRunning).toBe(false);
        }
      }
    });
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

  describe('Tokens directory', () => {
    it('should start correctly with a defined tokens directory', async () => {
      server = createInternalInterceptorServer({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });

      expect(server.isRunning).toBe(false);
      expect(server.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);
    });

    it('should start correctly with an undefined tokens directory', async () => {
      server = createInternalInterceptorServer({ tokensDirectory: undefined });

      expect(server.isRunning).toBe(false);
      expect(server.tokensDirectory).toBe(undefined);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.tokensDirectory).toBe(undefined);
    });

    it('should support changing the tokens directory after created', async () => {
      server = createInternalInterceptorServer({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });

      expect(server.isRunning).toBe(false);
      expect(server.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      const newTokensDirectory = path.join(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY, 'other');
      expect(newTokensDirectory).not.toBe(server.tokensDirectory);

      server.tokensDirectory = newTokensDirectory;
      expect(server.tokensDirectory).toBe(newTokensDirectory);

      await server.stop();
      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.tokensDirectory).toBe(newTokensDirectory);
    });
  });
});
