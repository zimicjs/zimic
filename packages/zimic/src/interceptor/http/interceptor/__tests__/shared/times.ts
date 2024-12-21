import { beforeEach, describe, expect, it } from 'vitest';

import { HTTP_METHODS, HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import { expectTimesCheckError } from '@/interceptor/http/requestHandler/__tests__/shared/utils';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/interceptor/server/constants';
import { importCrypto } from '@/utils/crypto';
import { joinURL } from '@/utils/urls';
import { expectPreflightResponse, expectFetchError } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export async function declareTimesHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const crypto = await importCrypto();

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  const Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  type MethodSchema = HttpSchema.Method<{
    response: {
      200: { headers: AccessControlHeaders };
    };
  }>;

  describe.each(HTTP_METHODS)('Method (%s)', (method) => {
    const { overridesPreflightResponse, numberOfRequestsIncludingPreflight } = assessPreflightInterference({
      method,
      platform,
      type,
    });

    const lowerMethod = method.toLowerCase<'POST'>();

    describe('Exact number of requests', () => {
      it(`should intercept an exact number of limited ${method} requests`, async () => {
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
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS })
              .times(numberOfRequestsIncludingPreflight),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              firstLine: `Expected exactly ${
                numberOfRequestsIncludingPreflight
              } request${numberOfRequestsIncludingPreflight === 1 ? '' : 's'}, but got 0.`,
            },
          );

          let response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          handler.times(numberOfRequestsIncludingPreflight * 2);

          response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * 2);

          handler.times(numberOfRequestsIncludingPreflight * 3);

          response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * 3);
        });
      });

      it(`should intercept less than an exact number of limited ${method} requests`, async () => {
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
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS })
              .times(numberOfRequestsIncludingPreflight * 2),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            { firstLine: `Expected exactly ${numberOfRequestsIncludingPreflight * 2} requests, but got 0.` },
          );

          let response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              firstLine: `Expected exactly ${
                numberOfRequestsIncludingPreflight * 2
              } requests, but got ${numberOfRequestsIncludingPreflight}.`,
            },
          );

          response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * 2);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          handler.times(numberOfRequestsIncludingPreflight * 4);

          response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * 3);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              firstLine: `Expected exactly ${
                numberOfRequestsIncludingPreflight * 4
              } requests, but got ${numberOfRequestsIncludingPreflight * 3}.`,
            },
          );
        });
      });

      it(`should not intercept more than an exact number of limited ${method} requests`, async () => {
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
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS })
              .times(numberOfRequestsIncludingPreflight),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              firstLine: `Expected exactly ${
                numberOfRequestsIncludingPreflight
              } request${numberOfRequestsIncludingPreflight === 1 ? '' : 's'}, but got 0.`,
            },
          );

          const response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          let responsePromise = fetch(joinURL(baseURL, '/users'), {
            method,
            headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
          });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              firstLine: `Expected exactly ${
                numberOfRequestsIncludingPreflight
              } request${numberOfRequestsIncludingPreflight === 1 ? '' : 's'}, but got ${
                numberOfRequestsIncludingPreflight * 2
              }.`,
            },
          );

          responsePromise = fetch(joinURL(baseURL, '/users'), { method });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              firstLine: `Expected exactly ${
                numberOfRequestsIncludingPreflight
              } request${numberOfRequestsIncludingPreflight === 1 ? '' : 's'}, but got ${
                numberOfRequestsIncludingPreflight * 3
              }.`,
            },
          );
        });
      });
    });

    describe('Range number of requests', () => {
      it(`should intercept the minimum number of ${method} requests limited in a range`, async () => {
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
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS })
              .times(0, numberOfRequestsIncludingPreflight * 3),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          let response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * 2);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * 3);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);
        });
      });

      it(`should intercept less than the minimum number of ${method} requests limited in a range`, async () => {
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
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS })
              .times(numberOfRequestsIncludingPreflight * 2, numberOfRequestsIncludingPreflight * 3),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              firstLine: `Expected at least ${
                numberOfRequestsIncludingPreflight * 2
              } and at most ${numberOfRequestsIncludingPreflight * 3} requests, but got 0.`,
            },
          );

          let response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              firstLine: `Expected at least ${
                numberOfRequestsIncludingPreflight * 2
              } and at most ${numberOfRequestsIncludingPreflight * 3} requests, but got ${
                numberOfRequestsIncludingPreflight
              }.`,
            },
          );

          response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * 2);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);
        });
      });

      it(`should intercept the maximum number of ${method} requests limited in a range`, async () => {
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
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS })
              .times(numberOfRequestsIncludingPreflight * 2, numberOfRequestsIncludingPreflight * 3),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          const requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * 3);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);
        });
      });

      it(`should not intercept more than the maximum number of ${method} requests limited in a range`, async () => {
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
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS })
              .times(numberOfRequestsIncludingPreflight * 2, numberOfRequestsIncludingPreflight * 3),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * 3);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          const responsePromise = fetch(joinURL(baseURL, '/users'), {
            method,
            headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
          });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * 3);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              firstLine: `Expected at least ${
                numberOfRequestsIncludingPreflight * 2
              } and at most ${numberOfRequestsIncludingPreflight * 3} requests, but got ${
                numberOfRequestsIncludingPreflight * 4
              }.`,
            },
          );
        });
      });

      it(`should intercept the exact number of ${method} requests limited in a range including zero`, async () => {
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
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS })
              .times(0, numberOfRequestsIncludingPreflight),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          const response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          const requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          const responsePromise = fetch(joinURL(baseURL, '/users'), {
            method,
            headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
          });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              firstLine: `Expected at least 0 and at most ${numberOfRequestsIncludingPreflight} request${
                numberOfRequestsIncludingPreflight === 1 ? '' : 's'
              }, but got ${numberOfRequestsIncludingPreflight * 2}.`,
            },
          );
        });
      });

      it(`should intercept the exact number of ${method} requests limited in a unitary range`, async () => {
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
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS })
              .times(numberOfRequestsIncludingPreflight, numberOfRequestsIncludingPreflight),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              firstLine: `Expected exactly ${numberOfRequestsIncludingPreflight} request${
                numberOfRequestsIncludingPreflight === 1 ? '' : 's'
              }, but got 0.`,
            },
          );

          const response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          const requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          const responsePromise = fetch(joinURL(baseURL, '/users'), {
            method,
            headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
          });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              firstLine: `Expected exactly ${numberOfRequestsIncludingPreflight} request${
                numberOfRequestsIncludingPreflight === 1 ? '' : 's'
              }, but got ${numberOfRequestsIncludingPreflight * 2}.`,
            },
          );
        });
      });

      it(`should intercept the exact number of ${method} requests limited in a non-unitary range`, async () => {
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
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS })
              .times(numberOfRequestsIncludingPreflight * 2, numberOfRequestsIncludingPreflight * 2),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            { firstLine: `Expected exactly ${numberOfRequestsIncludingPreflight * 2} requests, but got 0.` },
          );

          let response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              firstLine: `Expected exactly ${
                numberOfRequestsIncludingPreflight * 2
              } requests, but got ${numberOfRequestsIncludingPreflight}.`,
            },
          );

          response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * 2);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          const responsePromise = fetch(joinURL(baseURL, '/users'), {
            method,
            headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
          });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              firstLine: `Expected exactly ${
                numberOfRequestsIncludingPreflight * 2
              } requests, but got ${numberOfRequestsIncludingPreflight * 3}.`,
            },
          );
        });
      });
    });
  });
}
