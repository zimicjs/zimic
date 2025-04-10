import { HttpSchema } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import DisabledRequestSavingError from '@/http/requestHandler/errors/DisabledRequestSavingError';
import { isClientSide } from '@/utils/environment';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import RequestSavingSafeLimitExceededError from '../../errors/RequestSavingSafeLimitExceededError';
import { DEFAULT_REQUEST_SAVING_SAFE_LIMIT } from '../../HttpInterceptorClient';
import { HttpInterceptorOptions } from '../../types/options';
import { HttpInterceptorRequestSaving } from '../../types/public';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareRequestSavingHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  type MethodSchema = HttpSchema.Method<{
    response: { 200: {} };
  }>;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  describe('Enabled', () => {
    it.each([{ NODE_ENV: 'development' }, { NODE_ENV: 'test' }, { NODE_ENV: 'production' }])(
      'should have the correct default request saving configuration if none is provided (NODE_ENV: %s)',
      async (environment) => {
        const processEnvSpy = vi.spyOn(process, 'env', 'get').mockReturnValue(environment);

        try {
          expect(process.env).toEqual(environment);

          await usingHttpInterceptor<{
            '/users': { GET: MethodSchema };
          }>({ ...interceptorOptions, requestSaving: undefined }, async (interceptor) => {
            const defaultRequestSaving = interceptor.requestSaving;

            if (isClientSide()) {
              expect(defaultRequestSaving).toEqual<HttpInterceptorRequestSaving>({
                enabled: false,
                safeLimit: DEFAULT_REQUEST_SAVING_SAFE_LIMIT,
              });
            } else {
              expect(defaultRequestSaving).toEqual<HttpInterceptorRequestSaving>({
                enabled: environment.NODE_ENV === 'test',
                safeLimit: DEFAULT_REQUEST_SAVING_SAFE_LIMIT,
              });
            }

            const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 200 }), interceptor);

            const numberOfRequests = 5;

            if (defaultRequestSaving.enabled) {
              expect(handler.requests).toHaveLength(0);

              for (let index = 0; index < numberOfRequests; index++) {
                const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
                expect(response.status).toBe(200);
              }

              expect(handler.requests).toHaveLength(numberOfRequests);
            } else {
              const error = new DisabledRequestSavingError();

              expect(() => {
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                handler.requests;
              }).toThrowError(error);

              // @ts-expect-error Checking that no intercepted requests are saved.
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              expect(handler.client._requests).toHaveLength(0);

              const numberOfRequests = 5;

              for (let index = 0; index < numberOfRequests; index++) {
                const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
                expect(response.status).toBe(200);
              }

              expect(() => {
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                handler.requests;
              }).toThrowError(error);

              // @ts-expect-error Checking that no intercepted requests are saved.
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              expect(handler.client._requests).toHaveLength(0);
            }
          });
        } finally {
          processEnvSpy.mockRestore();
        }
      },
    );

    it('should save intercepted requests if enabled', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
        };
      }>({ ...interceptorOptions, requestSaving: { enabled: true } }, async (interceptor) => {
        expect(interceptor.requestSaving.enabled).toBe(true);

        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 200 }), interceptor);
        expect(handler.requests).toHaveLength(0);

        const numberOfRequests = 5;

        for (let index = 0; index < numberOfRequests; index++) {
          const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(response.status).toBe(200);
        }

        expect(handler.requests).toHaveLength(numberOfRequests);
      });
    });

    it('should not save intercepted requests if disabled', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
        };
      }>({ ...interceptorOptions, requestSaving: { enabled: false } }, async (interceptor) => {
        expect(interceptor.requestSaving.enabled).toBe(false);

        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 200 }), interceptor);

        const error = new DisabledRequestSavingError();

        expect(() => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          handler.requests;
        }).toThrowError(error);

        // @ts-expect-error Checking that no intercepted requests are saved.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(handler.client._requests).toHaveLength(0);

        const numberOfRequests = 5;

        for (let index = 0; index < numberOfRequests; index++) {
          const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(response.status).toBe(200);
        }

        expect(() => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          handler.requests;
        }).toThrowError(error);

        // @ts-expect-error Checking that no intercepted requests are saved.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(handler.client._requests).toHaveLength(0);
      });
    });
  });

  describe('Safe limit', () => {
    const safeLimit = 5;

    it('should not show a warning if requests are not being saved, even if the safe limit would be exceeded if so', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
        };
      }>({ ...interceptorOptions, requestSaving: { enabled: false, safeLimit } }, async (interceptor) => {
        expect(interceptor.requestSaving.enabled).toBe(false);
        expect(interceptor.requestSaving.safeLimit).toBe(safeLimit);

        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 200 }), interceptor);

        await usingIgnoredConsole(['warn'], async (console) => {
          const numberOfRequests = safeLimit * 2;
          expect(numberOfRequests).toBeGreaterThan(safeLimit);

          for (let index = 0; index < numberOfRequests; index++) {
            const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
            expect(response.status).toBe(200);
          }

          const error = new DisabledRequestSavingError();

          expect(() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            handler.requests;
          }).toThrowError(error);

          // @ts-expect-error Checking that no intercepted requests are saved.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(handler.client._requests).toHaveLength(0);

          expect(console.warn).toHaveBeenCalledTimes(0);
        });
      });
    });

    it('should not show a warning if the number of saved requests is below the safe limit', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
        };
      }>({ ...interceptorOptions, requestSaving: { enabled: true, safeLimit } }, async (interceptor) => {
        expect(interceptor.requestSaving.enabled).toBe(true);
        expect(interceptor.requestSaving.safeLimit).toBe(safeLimit);

        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 200 }), interceptor);
        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['warn'], async (console) => {
          const numberOfRequests = safeLimit - 1;
          expect(numberOfRequests).toBeLessThan(safeLimit);

          for (let index = 0; index < numberOfRequests; index++) {
            const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
            expect(response.status).toBe(200);
          }

          expect(handler.requests).toHaveLength(numberOfRequests);

          expect(console.warn).toHaveBeenCalledTimes(0);
        });
      });
    });

    it('should not show a warning if the number of saved requests reaches the safe limit', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
        };
      }>({ ...interceptorOptions, requestSaving: { enabled: true, safeLimit } }, async (interceptor) => {
        expect(interceptor.requestSaving.enabled).toBe(true);
        expect(interceptor.requestSaving.safeLimit).toBe(safeLimit);

        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 200 }), interceptor);
        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['warn'], async (console) => {
          const numberOfRequests = safeLimit;
          expect(numberOfRequests).toBe(safeLimit);

          for (let index = 0; index < numberOfRequests; index++) {
            const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
            expect(response.status).toBe(200);
          }

          expect(handler.requests).toHaveLength(numberOfRequests);

          expect(console.warn).toHaveBeenCalledTimes(0);
        });
      });
    });

    it('should show a warning if the number of saved requests exceeds the safe limit', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
        };
      }>({ ...interceptorOptions, requestSaving: { enabled: true, safeLimit } }, async (interceptor) => {
        expect(interceptor.requestSaving.enabled).toBe(true);
        expect(interceptor.requestSaving.safeLimit).toBe(safeLimit);

        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 200 }), interceptor);
        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['warn'], async (console) => {
          const numberOfRequests = safeLimit * 2;
          expect(numberOfRequests).toBeGreaterThan(safeLimit);

          for (let index = 0; index < numberOfRequests; index++) {
            const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
            expect(response.status).toBe(200);
          }

          expect(handler.requests).toHaveLength(numberOfRequests);

          const numberOfExceedingRequests = numberOfRequests - safeLimit;
          expect(console.warn).toHaveBeenCalledTimes(numberOfExceedingRequests);

          for (const [index, call] of console.warn.mock.calls.entries()) {
            const numberOfSavedRequestsAtCall = safeLimit + index + 1;
            const error = new RequestSavingSafeLimitExceededError(numberOfSavedRequestsAtCall, safeLimit);
            expect(call).toEqual([error]);
          }
        });
      });
    });

    it('should show a warning if the number of saved requests exceeds the safe limit, considering the sum of all handlers', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
        };
        '/users/others': {
          GET: MethodSchema;
        };
      }>({ ...interceptorOptions, requestSaving: { enabled: true, safeLimit } }, async (interceptor) => {
        expect(interceptor.requestSaving.enabled).toBe(true);
        expect(interceptor.requestSaving.safeLimit).toBe(safeLimit);

        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 200 }), interceptor);
        expect(handler.requests).toHaveLength(0);

        const otherHandler = await promiseIfRemote(
          interceptor.get('/users/others').respond({ status: 200 }),
          interceptor,
        );
        expect(otherHandler.requests).toHaveLength(0);

        await usingIgnoredConsole(['warn'], async (console) => {
          const numberOfRequestsPerHandler = safeLimit - 1;
          expect(numberOfRequestsPerHandler).toBeLessThan(safeLimit);

          const numberOfRequests = numberOfRequestsPerHandler * 2;
          expect(numberOfRequests).toBeGreaterThan(safeLimit);

          for (let index = 0; index < numberOfRequestsPerHandler; index++) {
            const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
            expect(response.status).toBe(200);

            const otherResponse = await fetch(joinURL(baseURL, '/users/others'), { method: 'GET' });
            expect(otherResponse.status).toBe(200);
          }

          expect(handler.requests).toHaveLength(numberOfRequestsPerHandler);
          expect(otherHandler.requests).toHaveLength(numberOfRequestsPerHandler);

          const numberOfExceedingRequests = numberOfRequests - safeLimit;
          expect(console.warn).toHaveBeenCalledTimes(numberOfExceedingRequests);

          for (const [index, call] of console.warn.mock.calls.entries()) {
            const numberOfSavedRequestsAtCall = safeLimit + index + 1;
            const error = new RequestSavingSafeLimitExceededError(numberOfSavedRequestsAtCall, safeLimit);
            expect(call).toEqual([error]);
          }
        });
      });
    });

    it('should not show a warning if the number of saved requests does not exceed the safe limit due to interceptor clearing', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
        };
      }>({ ...interceptorOptions, requestSaving: { enabled: true, safeLimit } }, async (interceptor) => {
        expect(interceptor.requestSaving.enabled).toBe(true);
        expect(interceptor.requestSaving.safeLimit).toBe(safeLimit);

        const handler = await promiseIfRemote(interceptor.get('/users'), interceptor);
        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['warn'], async (console) => {
          const numberOfRequests = safeLimit * 2;
          expect(numberOfRequests).toBeGreaterThan(safeLimit);

          for (let index = 0; index < numberOfRequests; index++) {
            await promiseIfRemote(interceptor.clear(), interceptor);
            await promiseIfRemote(handler.respond({ status: 200 }), interceptor);

            const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
            expect(response.status).toBe(200);
          }

          expect(handler.requests).toHaveLength(1);

          expect(console.warn).toHaveBeenCalledTimes(0);
        });
      });
    });

    it('should not show a warning if the number of saved requests does not exceed the safe limit due to handler clearing', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
        };
      }>({ ...interceptorOptions, requestSaving: { enabled: true, safeLimit } }, async (interceptor) => {
        expect(interceptor.requestSaving.enabled).toBe(true);
        expect(interceptor.requestSaving.safeLimit).toBe(safeLimit);

        const handler = await promiseIfRemote(interceptor.get('/users'), interceptor);
        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['warn'], async (console) => {
          const numberOfRequests = safeLimit * 2;
          expect(numberOfRequests).toBeGreaterThan(safeLimit);

          for (let index = 0; index < numberOfRequests; index++) {
            await promiseIfRemote(handler.clear(), handler);
            await promiseIfRemote(handler.respond({ status: 200 }), interceptor);

            const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
            expect(response.status).toBe(200);
          }

          expect(handler.requests).toHaveLength(1);

          expect(console.warn).toHaveBeenCalledTimes(0);
        });
      });
    });

    it('should not show a warning if the number of saved requests does not exceed the safe limit due to new response declarations', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
        };
      }>({ ...interceptorOptions, requestSaving: { enabled: true, safeLimit } }, async (interceptor) => {
        expect(interceptor.requestSaving.enabled).toBe(true);
        expect(interceptor.requestSaving.safeLimit).toBe(safeLimit);

        const handler = await promiseIfRemote(interceptor.get('/users'), interceptor);
        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['warn'], async (console) => {
          const numberOfRequests = safeLimit * 2;
          expect(numberOfRequests).toBeGreaterThan(safeLimit);

          for (let index = 0; index < numberOfRequests; index++) {
            await promiseIfRemote(handler.respond({ status: 200 }), interceptor);

            const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
            expect(response.status).toBe(200);
          }

          expect(handler.requests).toHaveLength(1);

          expect(console.warn).toHaveBeenCalledTimes(0);
        });
      });
    });
  });

  it('should support changing the request saving configuration after created', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: MethodSchema;
        POST: MethodSchema;
        PUT: MethodSchema;
        PATCH: MethodSchema;
        DELETE: MethodSchema;
        HEAD: MethodSchema;
        OPTIONS: MethodSchema;
      };
    }>({ ...interceptorOptions, requestSaving: { enabled: true } }, async (interceptor) => {
      const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 200 }), interceptor);

      expect(interceptor.requestSaving).toEqual<HttpInterceptorRequestSaving>({
        enabled: true,
        safeLimit: DEFAULT_REQUEST_SAVING_SAFE_LIMIT,
      });

      interceptor.requestSaving.enabled = false;

      expect(interceptor.requestSaving).toEqual<HttpInterceptorRequestSaving>({
        enabled: false,
        safeLimit: 1000,
      });

      interceptor.requestSaving.safeLimit = 500;

      expect(interceptor.requestSaving).toEqual<HttpInterceptorRequestSaving>({
        enabled: false,
        safeLimit: 500,
      });

      const error = new DisabledRequestSavingError();

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        handler.requests;
      }).toThrowError(error);

      // @ts-expect-error Checking that no intercepted requests are saved.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(handler.client._requests).toHaveLength(0);

      const numberOfRequests = 5;

      for (let index = 0; index < numberOfRequests; index++) {
        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(200);
      }

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        handler.requests;
      }).toThrowError(error);

      // @ts-expect-error Checking that no intercepted requests are saved.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(handler.client._requests).toHaveLength(0);

      expect(interceptor.requestSaving).toEqual<HttpInterceptorRequestSaving>({
        enabled: false,
        safeLimit: 500,
      });

      interceptor.requestSaving = {
        enabled: true,
        safeLimit: 1500,
      };

      expect(interceptor.requestSaving).toEqual<HttpInterceptorRequestSaving>({
        enabled: true,
        safeLimit: 1500,
      });

      expect(handler.requests).toHaveLength(0);

      for (let index = 0; index < numberOfRequests; index++) {
        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(200);
      }

      expect(handler.requests).toHaveLength(numberOfRequests);
    });
  });
}
