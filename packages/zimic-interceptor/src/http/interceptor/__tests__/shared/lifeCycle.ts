import { HttpSchema } from '@zimic/http';
import { expectFetchError } from '@zimic/utils/fetch';
import { waitFor } from '@zimic/utils/time';
import { joinURL } from '@zimic/utils/url';
import { beforeEach, expect, it } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { expectBypassedResponse } from '@tests/utils/fetch';
import { createInternalHttpInterceptor, usingHttpInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';

import NotRunningHttpInterceptorError from '../../errors/NotRunningHttpInterceptorError';
import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareLifeCycleHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions, startServer, stopServer } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  type MethodSchema = HttpSchema.Method<{
    response: { 204: {} };
  }>;

  it('should ignore all handlers after restarted when intercepting requests', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      expect(interceptor.isRunning).toBe(true);
      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);

      let responsePromise = fetch(joinURL(baseURL, '/users'), {
        method: 'GET',
        signal: AbortSignal.timeout(500),
      });

      if (type === 'local') {
        await expectBypassedResponse(responsePromise, { canBeAborted: true });
      } else {
        await expectFetchError(responsePromise, { canBeAborted: true });
      }

      expect(handler.requests).toHaveLength(0);

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);

      responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(0);
    });
  });

  it('should ignore all handlers after restarted when intercepting requests, even if another interceptor is still running', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);
      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      await usingHttpInterceptor(interceptorOptions, async (otherInterceptor) => {
        expect(interceptor.isRunning).toBe(true);
        expect(otherInterceptor.isRunning).toBe(true);

        await interceptor.stop();
        expect(interceptor.isRunning).toBe(false);
        expect(otherInterceptor.isRunning).toBe(true);

        let responsePromise = fetch(joinURL(baseURL, '/users'), {
          method: 'GET',
          signal: AbortSignal.timeout(500),
        });
        await expectFetchError(responsePromise, { canBeAborted: true });

        expect(handler.requests).toHaveLength(0);

        await interceptor.start();
        expect(interceptor.isRunning).toBe(true);
        expect(otherInterceptor.isRunning).toBe(true);

        responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(0);
      });
    });
  });

  it('should intercept requests with the newest handler if a restarted interceptor with the same base URL declares an older one', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: { response: { 204: {} } } };
    }>(interceptorOptions, async (interceptor) => {
      await usingHttpInterceptor<{
        '/users': { GET: { response: { 200: {} } } };
      }>(interceptorOptions, async (otherInterceptor) => {
        await interceptor.stop();
        await interceptor.start();

        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);

        const otherHandler = await promiseIfRemote(
          otherInterceptor.get('/users').respond({ status: 200 }),
          otherInterceptor,
        );

        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(200);

        expect(handler.requests).toHaveLength(0);
        expect(otherHandler.requests).toHaveLength(1);
      });
    });
  });

  it('should not log a warning when stopped', async () => {
    await usingIgnoredConsole(['warn'], async (console) => {
      await usingHttpInterceptor(interceptorOptions, async (interceptor) => {
        await interceptor.stop();
        expect(interceptor.isRunning).toBe(false);
      });

      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  // Only remote interceptors connect to an interceptor server, and browser tests cannot stop their shared server.
  if (type === 'remote' && platform === 'node') {
    it('should log a warning once if the interceptor server stops while running', async () => {
      await usingIgnoredConsole(['warn'], async (console) => {
        // Interceptors with the same server share one connection, so they should log a single warning.
        await usingHttpInterceptor(interceptorOptions, async () => {
          await usingHttpInterceptor(interceptorOptions, async () => {
            await stopServer?.();

            try {
              await waitFor(() => {
                expect(console.warn).toHaveBeenCalledTimes(1);
              });

              expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('[@zimic/interceptor]'),
                `Warning: The connection to the interceptor server ${new URL(baseURL).origin} was closed. ` +
                  'Restart your interceptors to reconnect.',
              );
            } finally {
              await startServer?.();
            }
          });
        });
      });
    });
  }

  // No HTTP counterpart for "should not handle messages from existing clients after stopped": WebSocket connections are
  // long-lived, so a client can stay open after its interceptor stops.

  // No HTTP counterpart for "should not accept connections opened while stopping": HTTP interceptors have no connections
  // or connection listeners.

  // No HTTP counterpart for "should keep connections shared with another interceptor open after stopped": WebSocket
  // connections are long-lived, so one can outlive the stop of an interceptor holding it.

  // No HTTP counterpart for "should close connections shared with other interceptors after all of them are stopped":
  // WebSocket connections are long-lived, so one can outlive the stop of an interceptor holding it.

  it('should throw an error when trying to create a request handler if not running', async () => {
    const interceptor = createInternalHttpInterceptor(interceptorOptions);
    expect(interceptor.isRunning).toBe(false);

    await expect(async () => {
      await interceptor.get('/');
    }).rejects.toThrow(new NotRunningHttpInterceptorError());
  });

  it('should throw an error when trying to create a request handler while stopping', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const stopPromise = interceptor.stop();

      await expect(async () => {
        await interceptor.get('/users');
      }).rejects.toThrow(new NotRunningHttpInterceptorError());

      await stopPromise;
    });
  });

  it('should throw an error when trying to redeclare a request handler while stopping', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);

      const stopPromise = interceptor.stop();

      await expect(async () => {
        await handler.respond({ status: 204 });
      }).rejects.toThrow(new NotRunningHttpInterceptorError());

      await stopPromise;
    });
  });

  it('should throw an error when trying to redeclare a request handler after stopped', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);

      await interceptor.stop();

      await expect(async () => {
        await handler.respond({ status: 204 });
      }).rejects.toThrow(new NotRunningHttpInterceptorError());
    });
  });
}
