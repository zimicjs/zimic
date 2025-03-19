import { HttpSchema } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import DisabledRequestSavingError from '@/http/requestHandler/errors/DisabledRequestSavingError';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/server/constants';
import { isClientSide } from '@/utils/environment';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { DEFAULT_REQUEST_SAVING_SAFE_LIMIT } from '../../HttpInterceptorClient';
import { HttpInterceptorOptions } from '../../types/options';
import { HttpInterceptorRequestSaving } from '../../types/public';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareRequestSavingHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  type MethodSchema = HttpSchema.Method<{
    response: { 200: { headers: AccessControlHeaders } };
  }>;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  describe('Enabled', () => {
    it.each([{ NODE_ENV: 'development' }, { NODE_ENV: 'test' }, { NODE_ENV: 'production' }])(
      'should have the correct default save requests strategy if none is provided (NODE_ENV: %s)',
      async (environment) => {
        vi.spyOn(process, 'env', 'get').mockReturnValue(environment);
        expect(process.env).toEqual(environment);

        await usingHttpInterceptor<{
          '/users': { GET: MethodSchema };
        }>({ ...interceptorOptions, requestSaving: undefined }, async (interceptor) => {
          const defaultRequestSaving = interceptor.requestSaving;

          if (isClientSide()) {
            expect(defaultRequestSaving.enabled).toBe(false);
          } else {
            expect(defaultRequestSaving.enabled).toBe(environment.NODE_ENV === 'test');
          }

          const handler = await promiseIfRemote(
            interceptor.get('/users').respond({
              status: 200,
              headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            }),
            interceptor,
          );

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
      },
    );

    it('should not save intercepted requests if disabled', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
        };
      }>({ ...interceptorOptions, requestSaving: { enabled: false } }, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.get('/users').respond({
            status: 200,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          }),
          interceptor,
        );

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

    it('should save intercepted requests if enabled', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
        };
      }>({ ...interceptorOptions, requestSaving: { enabled: true } }, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.get('/users').respond({
            status: 200,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          }),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        const numberOfRequests = 5;

        for (let index = 0; index < numberOfRequests; index++) {
          const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(response.status).toBe(200);
        }

        expect(handler.requests).toHaveLength(numberOfRequests);
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
      const handler = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
        }),
        interceptor,
      );

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
