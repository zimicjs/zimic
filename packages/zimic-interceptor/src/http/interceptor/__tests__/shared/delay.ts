import { HttpSchema } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import waitFor from '@zimic/utils/time/waitFor';
import waitForDelay from '@zimic/utils/time/waitForDelay';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingElapsedTime } from '@/utils/time';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

const waitForDelaySpy = vi.mocked(waitForDelay);

export function declareDelayHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  type MethodSchema = HttpSchema.Method<{
    response: {
      204: {};
    };
  }>;

  type Schema = HttpSchema<{
    '/users': { GET: MethodSchema };
  }>;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  describe('Exact delay', () => {
    it('should apply an exact delay before responding', async () => {
      await usingHttpInterceptor<Schema>(interceptorOptions, async (interceptor) => {
        const delay = 100;

        const handler = await promiseIfRemote(
          interceptor.get('/users').delay(delay).respond({ status: 204 }),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        const { result: response, elapsedTime } = await usingElapsedTime(async () => {
          return fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        });
        expect(response.status).toBe(204);
        expect(elapsedTime).toBeGreaterThanOrEqual(delay);

        expect(handler.requests).toHaveLength(1);

        expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
        expect(waitForDelaySpy).toHaveBeenCalledWith(delay);
      });
    });

    it('should not apply delay when set to zero', async () => {
      await usingHttpInterceptor<Schema>(interceptorOptions, async (interceptor) => {
        const delay = 0;

        const handler = await promiseIfRemote(
          interceptor.get('/users').delay(delay).respond({ status: 204 }),
          interceptor,
        );

        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);

        expect(waitForDelaySpy).not.toHaveBeenCalled();
      });
    });

    it('should not apply delay when set to negative', async () => {
      await usingHttpInterceptor<Schema>(interceptorOptions, async (interceptor) => {
        const delay = -10;

        const handler = await promiseIfRemote(
          interceptor.get('/users').delay(delay).respond({ status: 204 }),
          interceptor,
        );

        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);

        expect(waitForDelaySpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Ranged delay', () => {
    it('should apply a random delay within the specified range', async () => {
      await usingHttpInterceptor<Schema>(interceptorOptions, async (interceptor) => {
        const minDelay = 100;
        const maxDelay = 200;

        const handler = await promiseIfRemote(
          interceptor.get('/users').delay(minDelay, maxDelay).respond({ status: 204 }),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        const { result: response, elapsedTime } = await usingElapsedTime(async () => {
          return fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        });
        expect(response.status).toBe(204);
        expect(elapsedTime).toBeGreaterThanOrEqual(minDelay);

        expect(handler.requests).toHaveLength(1);

        expect(waitForDelaySpy).toHaveBeenCalledTimes(1);

        const usedDelay = waitForDelaySpy.mock.calls[0][0];
        expect(usedDelay).toBeGreaterThanOrEqual(minDelay);
        expect(usedDelay).toBeLessThanOrEqual(maxDelay);
      });
    });

    it('should apply random delays for multiple responses within the specified range', async () => {
      await usingHttpInterceptor<Schema>(interceptorOptions, async (interceptor) => {
        const minDelay = 50;
        const maxDelay = 150;

        const numberOfRequests = 3;

        const handler = await promiseIfRemote(
          interceptor.get('/users').delay(minDelay, maxDelay).respond({ status: 204 }),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        for (let requestIndex = 0; requestIndex < numberOfRequests; requestIndex++) {
          const { result: response, elapsedTime } = await usingElapsedTime(async () => {
            return fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          });
          expect(response.status).toBe(204);
          expect(elapsedTime).toBeGreaterThanOrEqual(minDelay);
        }

        expect(handler.requests).toHaveLength(numberOfRequests);

        expect(waitForDelaySpy).toHaveBeenCalledTimes(numberOfRequests);

        for (let requestIndex = 0; requestIndex < numberOfRequests; requestIndex++) {
          const usedDelay = waitForDelaySpy.mock.calls[requestIndex][0];
          expect(usedDelay).toBeGreaterThanOrEqual(minDelay);
          expect(usedDelay).toBeLessThanOrEqual(maxDelay);
        }
      });
    });

    it('should apply an exact delay when the range limits are equal', async () => {
      await usingHttpInterceptor<Schema>(interceptorOptions, async (interceptor) => {
        const delay = 50;

        const handler = await promiseIfRemote(
          interceptor.get('/users').delay(delay, delay).respond({ status: 204 }),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        const { result: response, elapsedTime } = await usingElapsedTime(async () => {
          return fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        });
        expect(response.status).toBe(204);
        expect(elapsedTime).toBeGreaterThanOrEqual(delay);

        expect(handler.requests).toHaveLength(1);

        expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
        expect(waitForDelaySpy).toHaveBeenCalledWith(delay);
      });
    });

    it('should apply the highest delay when the minimum limit is higher than the maximum limit', async () => {
      await usingHttpInterceptor<Schema>(interceptorOptions, async (interceptor) => {
        const minDelay = 100;
        const maxDelay = 50;

        expect(minDelay).toBeGreaterThan(maxDelay);

        const handler = await promiseIfRemote(
          interceptor.get('/users').delay(minDelay, maxDelay).respond({ status: 204 }),
          interceptor,
        );

        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);

        expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
        expect(waitForDelaySpy).toHaveBeenCalledWith(minDelay);
      });
    });
  });

  describe('Computed delay', () => {
    it('should apply a computed synchronous delay', async () => {
      await usingHttpInterceptor<Schema>(interceptorOptions, async (interceptor) => {
        const delay = 100;

        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .delay(() => delay)
            .respond({ status: 204 }),
          interceptor,
        );

        const { result: response, elapsedTime } = await usingElapsedTime(async () => {
          return fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        });
        expect(response.status).toBe(204);
        expect(elapsedTime).toBeGreaterThanOrEqual(delay);

        expect(handler.requests).toHaveLength(1);

        expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
        expect(waitForDelaySpy).toHaveBeenCalledWith(delay);
      });
    });

    it('should apply a computed asynchronous delay', async () => {
      await usingHttpInterceptor<Schema>(interceptorOptions, async (interceptor) => {
        const delayOverhead = 30;
        const delay = 50;

        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .delay(async () => {
              await waitForDelay(delayOverhead);
              return delay;
            })
            .respond({ status: 204 }),
          interceptor,
        );

        const { result: response, elapsedTime } = await usingElapsedTime(async () => {
          return fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        });
        expect(response.status).toBe(204);
        expect(elapsedTime).toBeGreaterThanOrEqual(delayOverhead + delay);

        expect(handler.requests).toHaveLength(1);

        expect(waitForDelaySpy).toHaveBeenCalledTimes(2);
        expect(waitForDelaySpy).toHaveBeenNthCalledWith(1, delayOverhead);
        expect(waitForDelaySpy).toHaveBeenNthCalledWith(2, delay);
      });
    });
  });

  it('should reset delay when cleared', async () => {
    await usingHttpInterceptor<Schema>(interceptorOptions, async (interceptor) => {
      const delay = 100;

      const handler = await promiseIfRemote(
        interceptor.get('/users').delay(delay).respond({ status: 204 }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      await promiseIfRemote(handler.clear(), interceptor);

      await promiseIfRemote(handler.respond({ status: 204 }), handler);

      const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      expect(waitForDelaySpy).toHaveBeenCalledTimes(0);
    });
  });

  it('should consider only the last delay if multiple are declared', async () => {
    await usingHttpInterceptor<Schema>(interceptorOptions, async (interceptor) => {
      const firstDelay = 200;
      const secondDelay = 50;

      const handler = await promiseIfRemote(
        interceptor.get('/users').delay(firstDelay).delay(secondDelay).respond({ status: 204 }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const { result: response, elapsedTime } = await usingElapsedTime(async () => {
        return fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      });
      expect(response.status).toBe(204);
      expect(elapsedTime).toBeGreaterThanOrEqual(secondDelay);
      expect(elapsedTime).toBeLessThan(firstDelay);

      expect(handler.requests).toHaveLength(1);

      expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
      expect(waitForDelaySpy).toHaveBeenCalledWith(secondDelay);
    });
  });

  it('should not throw an error if the handler is cleared while the delay is being awaited', async () => {
    await usingHttpInterceptor<Schema>(interceptorOptions, async (interceptor) => {
      const delay = 200;

      const handler = await promiseIfRemote(
        interceptor.get('/users').delay(delay).respond({ status: 204 }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      await usingIgnoredConsole(['error'], async (console) => {
        const { elapsedTime } = await usingElapsedTime(async () => {
          const fetchPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });

          await waitFor(() => {
            expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
            expect(waitForDelaySpy).toHaveBeenCalledWith(delay);
          });

          await promiseIfRemote(handler.clear(), interceptor);

          await expectFetchError(fetchPromise);
        });

        expect(elapsedTime).toBeGreaterThanOrEqual(delay);
        expect(handler.requests).toHaveLength(0);

        expect(console.error).toHaveBeenCalledTimes(0);
      });
    });
  });
}
