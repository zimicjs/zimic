import { HttpSchema, HttpSearchParams } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, describe, expect, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import UnsupportedResponseBypassError from '@/server/errors/UnsupportedResponseBypassError';
import { usingElapsedTime } from '@/utils/time';
import {
  GLOBAL_FALLBACK_SERVER_RESPONSE_STATUS,
  GLOBAL_FALLBACK_SERVER_HEADERS,
  GLOBAL_FALLBACK_SERVER_PORT,
} from '@tests/setup/global/shared';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectBypassedResponse } from '@tests/utils/fetch';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareResponseActionsHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  type MethodSchema = HttpSchema.Method<{
    request: {
      searchParams: { value?: string };
    };
    response: {
      204: {};
    };
  }>;

  if (type === 'local') {
    it('should support bypassing requests', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);
        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);
        expect(handler.requests[0].response.status).toBe(204);

        await promiseIfRemote(handler.respond({ action: 'bypass' }), interceptor);

        const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectBypassedResponse(responsePromise);

        expect(handler.requests).toHaveLength(1);

        expect(handler.requests[0].response.status).toBe(GLOBAL_FALLBACK_SERVER_RESPONSE_STATUS);
        expect(Object.fromEntries(handler.requests[0].response.headers.entries())).toEqual(
          expect.objectContaining(GLOBAL_FALLBACK_SERVER_HEADERS),
        );
        expect(handler.requests[0].response.body).toBe(null);
      });
    });

    it('should not consider other suitable handlers after bypassing a request', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handlers = await Promise.all([
          promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor),
          promiseIfRemote(interceptor.get('/users').respond({ action: 'bypass' }), interceptor),
        ]);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(0);

        const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectBypassedResponse(responsePromise);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(1);

        expect(handlers[1].requests[0].response.status).toBe(GLOBAL_FALLBACK_SERVER_RESPONSE_STATUS);
        expect(Object.fromEntries(handlers[1].requests[0].response.headers.entries())).toEqual(
          expect.objectContaining(GLOBAL_FALLBACK_SERVER_HEADERS),
        );
        expect(handlers[1].requests[0].response.body).toBe(null);
      });
    });
  }

  if (type === 'remote') {
    it('should not support bypassing requests', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);
        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);
        expect(handler.requests[0].response.status).toBe(204);

        await promiseIfRemote(handler.respond({ action: 'bypass' }), interceptor);

        await usingIgnoredConsole(['error'], async (console) => {
          const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          await expectFetchError(responsePromise);

          expect(console.error).toHaveBeenCalledTimes(1);
          expect(console.error).toHaveBeenCalledWith(new UnsupportedResponseBypassError());
        });

        expect(handler.requests).toHaveLength(0);
      });
    });
  }

  it('should support rejecting requests', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);
      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);
      expect(handler.requests[0].response.status).toBe(204);

      await promiseIfRemote(handler.respond({ action: 'reject' }), interceptor);

      const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(0);
    });
  });

  it('should not consider other suitable handlers after rejecting a request', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handlers = await Promise.all([
        promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor),
        promiseIfRemote(interceptor.get('/users').respond({ action: 'reject' }), interceptor),
      ]);

      expect(handlers[0].requests).toHaveLength(0);
      expect(handlers[1].requests).toHaveLength(0);

      const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      await expectFetchError(responsePromise);

      expect(handlers[0].requests).toHaveLength(0);
      expect(handlers[1].requests).toHaveLength(0);
    });
  });

  if (type === 'local') {
    it('should consider failed bypassed requests as unhandled', async () => {
      const unusedPort = 9999;
      expect(unusedPort).not.toBe(GLOBAL_FALLBACK_SERVER_PORT);

      baseURL = `http://localhost:${unusedPort}`;

      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>({ ...interceptorOptions, baseURL }, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);
        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);
        expect(handler.requests[0].response.status).toBe(204);

        await promiseIfRemote(handler.respond({ action: 'bypass' }), interceptor);

        await usingIgnoredConsole(['error'], async () => {
          const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          await expectFetchError(responsePromise);
        });

        expect(handler.requests).toHaveLength(0);
      });
    });
  }

  if (type === 'local') {
    it('should not allow bypassing requests if defining a status response', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(
          // @ts-expect-error Forcing using both status and action
          interceptor.get('/users').respond({ action: 'bypass', status: 204 }),
          interceptor,
        );
      });
    });
  }

  it('should not allow rejecting requests if defining a status response', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(
        // @ts-expect-error Forcing using both status and action
        interceptor.get('/users').respond({ action: 'reject', status: 204 }),
        interceptor,
      );
    });
  });

  describe('Restrictions', () => {
    if (type === 'local') {
      it('should support bypassing requests with restrictions', async () => {
        await usingHttpInterceptor<{
          '/users': { GET: MethodSchema };
        }>(interceptorOptions, async (interceptor) => {
          const handlers = await Promise.all([
            promiseIfRemote(
              interceptor
                .get('/users')
                .with({ searchParams: { value: '1' } })
                .respond({ status: 204 }),
              interceptor,
            ),
            promiseIfRemote(
              interceptor
                .get('/users')
                .with({ searchParams: { value: '2' } })
                .respond({ action: 'bypass' }),
              interceptor,
            ),
          ]);

          expect(handlers[0].requests).toHaveLength(0);
          expect(handlers[1].requests).toHaveLength(0);

          const searchParams = new HttpSearchParams({ value: '1' });

          let response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
          expect(response.status).toBe(204);

          expect(handlers[0].requests).toHaveLength(1);
          expect(handlers[1].requests).toHaveLength(0);

          expect(handlers[0].requests[0].response.status).toBe(204);

          searchParams.set('value', '2');

          const responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
          await expectBypassedResponse(responsePromise);

          expect(handlers[0].requests).toHaveLength(1);
          expect(handlers[1].requests).toHaveLength(1);

          expect(handlers[1].requests[0].response.status).toBe(GLOBAL_FALLBACK_SERVER_RESPONSE_STATUS);
          expect(Object.fromEntries(handlers[1].requests[0].response.headers.entries())).toEqual(
            expect.objectContaining(GLOBAL_FALLBACK_SERVER_HEADERS),
          );
          expect(handlers[1].requests[0].response.body).toBe(null);

          searchParams.set('value', '1');

          response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
          expect(response.status).toBe(204);

          expect(handlers[0].requests).toHaveLength(2);
          expect(handlers[1].requests).toHaveLength(1);

          expect(handlers[0].requests[1].response.status).toBe(204);
        });
      });
    }

    it('should support rejecting requests with restrictions', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handlers = await Promise.all([
          promiseIfRemote(
            interceptor
              .get('/users')
              .with({ searchParams: { value: '1' } })
              .respond({ status: 204 }),
            interceptor,
          ),
          promiseIfRemote(
            interceptor
              .get('/users')
              .with({ searchParams: { value: '2' } })
              .respond({ action: 'reject' }),
            interceptor,
          ),
        ]);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(0);

        const searchParams = new HttpSearchParams({ value: '1' });

        let response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(1);
        expect(handlers[1].requests).toHaveLength(0);

        expect(handlers[0].requests[0].response.status).toBe(204);

        searchParams.set('value', '2');

        const responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handlers[0].requests).toHaveLength(1);
        expect(handlers[1].requests).toHaveLength(0);

        searchParams.set('value', '1');

        response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(2);
        expect(handlers[1].requests).toHaveLength(0);

        expect(handlers[0].requests[1].response.status).toBe(204);
      });
    });
  });

  describe('Times', () => {
    if (type === 'local') {
      it('should support bypassing requests with times', async () => {
        await usingHttpInterceptor<{
          '/users': { GET: MethodSchema };
        }>(interceptorOptions, async (interceptor) => {
          const handlers = await Promise.all([
            promiseIfRemote(interceptor.get('/users').respond({ status: 204 }).times(1), interceptor),
            promiseIfRemote(interceptor.get('/users').respond({ action: 'bypass' }).times(1), interceptor),
          ]);

          expect(handlers[0].requests).toHaveLength(0);
          expect(handlers[1].requests).toHaveLength(0);

          let responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          await expectBypassedResponse(responsePromise);

          expect(handlers[0].requests).toHaveLength(0);
          expect(handlers[1].requests).toHaveLength(1);

          expect(handlers[1].requests[0].response.status).toBe(GLOBAL_FALLBACK_SERVER_RESPONSE_STATUS);
          expect(Object.fromEntries(handlers[1].requests[0].response.headers.entries())).toEqual(
            expect.objectContaining(GLOBAL_FALLBACK_SERVER_HEADERS),
          );
          expect(handlers[1].requests[0].response.body).toBe(null);

          const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(response.status).toBe(204);

          expect(handlers[0].requests).toHaveLength(1);
          expect(handlers[1].requests).toHaveLength(1);

          expect(handlers[0].requests[0].response.status).toBe(204);

          responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          await expectFetchError(responsePromise);

          expect(handlers[0].requests).toHaveLength(1);
          expect(handlers[1].requests).toHaveLength(1);
        });
      });
    }

    it('should support rejecting requests with times', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handlers = await Promise.all([
          promiseIfRemote(interceptor.get('/users').respond({ status: 204 }).times(1), interceptor),
          promiseIfRemote(interceptor.get('/users').respond({ action: 'reject' }).times(1), interceptor),
        ]);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(0);

        let responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(1);
        expect(handlers[1].requests).toHaveLength(0);

        expect(handlers[0].requests[0].response.status).toBe(204);

        responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handlers[0].requests).toHaveLength(1);
        expect(handlers[1].requests).toHaveLength(0);
      });
    });
  });

  describe('Delay', () => {
    if (type === 'local') {
      it('should support bypassing requests with a delay', async () => {
        await usingHttpInterceptor<{
          '/users': { GET: MethodSchema };
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);
          expect(handler.requests).toHaveLength(0);

          const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(response.status).toBe(204);

          expect(handler.requests).toHaveLength(1);
          expect(handler.requests[0].response.status).toBe(204);

          const delay = 100;

          await promiseIfRemote(handler.respond({ action: 'bypass' }).delay(delay), interceptor);

          expect(handler.requests).toHaveLength(0);

          const { elapsedTime } = await usingElapsedTime(async () => {
            const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
            await expectBypassedResponse(responsePromise);
          });
          expect(elapsedTime).toBeGreaterThanOrEqual(delay);

          expect(handler.requests).toHaveLength(1);

          expect(handler.requests[0].response.status).toBe(GLOBAL_FALLBACK_SERVER_RESPONSE_STATUS);
          expect(Object.fromEntries(handler.requests[0].response.headers.entries())).toEqual(
            expect.objectContaining(GLOBAL_FALLBACK_SERVER_HEADERS),
          );
          expect(handler.requests[0].response.body).toBe(null);
        });
      });
    }

    it('should support rejecting requests with a delay', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);
        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);
        expect(handler.requests[0].response.status).toBe(204);

        const delay = 100;

        await promiseIfRemote(handler.respond({ action: 'reject' }).delay(delay), interceptor);

        expect(handler.requests).toHaveLength(0);

        const { elapsedTime } = await usingElapsedTime(async () => {
          const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          await expectFetchError(responsePromise);
        });
        expect(elapsedTime).toBeGreaterThanOrEqual(delay);

        expect(handler.requests).toHaveLength(0);
      });
    });
  });
}
