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
    request: {
      searchParams: { value?: string };
    };
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
              content: `Expected exactly ${
                numberOfRequestsIncludingPreflight
              } request${numberOfRequestsIncludingPreflight === 1 ? '' : 's'}, but got 0.`,
              numberOfRequests: numberOfRequestsIncludingPreflight,
            },
          );

          let response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          handler.times(numberOfRequestsIncludingPreflight * 2);

          response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * 2);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          handler.times(numberOfRequestsIncludingPreflight * 3);

          response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * 3);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);
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
            {
              content: `Expected exactly ${numberOfRequestsIncludingPreflight * 2} requests, but got 0.`,
              numberOfRequests: numberOfRequestsIncludingPreflight * 2,
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
              content: `Expected exactly ${
                numberOfRequestsIncludingPreflight * 2
              } requests, but got ${numberOfRequestsIncludingPreflight}.`,
              numberOfRequests: numberOfRequestsIncludingPreflight * 2,
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
              content: `Expected exactly ${
                numberOfRequestsIncludingPreflight * 4
              } requests, but got ${numberOfRequestsIncludingPreflight * 3}.`,
              numberOfRequests: numberOfRequestsIncludingPreflight * 4,
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
              content: `Expected exactly ${
                numberOfRequestsIncludingPreflight
              } request${numberOfRequestsIncludingPreflight === 1 ? '' : 's'}, but got 0.`,
              numberOfRequests: numberOfRequestsIncludingPreflight,
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
              content: `Expected exactly ${
                numberOfRequestsIncludingPreflight
              } request${numberOfRequestsIncludingPreflight === 1 ? '' : 's'}, but got ${
                numberOfRequestsIncludingPreflight * 2
              }.`,
              numberOfRequests: numberOfRequestsIncludingPreflight,
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
              content: `Expected exactly ${
                numberOfRequestsIncludingPreflight
              } request${numberOfRequestsIncludingPreflight === 1 ? '' : 's'}, but got ${
                numberOfRequestsIncludingPreflight * 3
              }.`,
              numberOfRequests: numberOfRequestsIncludingPreflight,
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
              content: `Expected at least ${
                numberOfRequestsIncludingPreflight * 2
              } and at most ${numberOfRequestsIncludingPreflight * 3} requests, but got 0.`,
              minNumberOfRequests: numberOfRequestsIncludingPreflight * 2,
              maxNumberOfRequests: numberOfRequestsIncludingPreflight * 3,
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
              content: `Expected at least ${
                numberOfRequestsIncludingPreflight * 2
              } and at most ${numberOfRequestsIncludingPreflight * 3} requests, but got ${
                numberOfRequestsIncludingPreflight
              }.`,
              minNumberOfRequests: numberOfRequestsIncludingPreflight * 2,
              maxNumberOfRequests: numberOfRequestsIncludingPreflight * 3,
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
              content: `Expected at least ${
                numberOfRequestsIncludingPreflight * 2
              } and at most ${numberOfRequestsIncludingPreflight * 3} requests, but got ${
                numberOfRequestsIncludingPreflight * 4
              }.`,
              minNumberOfRequests: numberOfRequestsIncludingPreflight * 2,
              maxNumberOfRequests: numberOfRequestsIncludingPreflight * 3,
            },
          );
        });
      });

      it(`should intercept the exact number of ${method} requests limited in a range where the minimum and maximum are equal`, async () => {
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
              content: `Expected exactly ${numberOfRequestsIncludingPreflight} request${
                numberOfRequestsIncludingPreflight === 1 ? '' : 's'
              }, but got 0.`,
              minNumberOfRequests: numberOfRequestsIncludingPreflight,
              maxNumberOfRequests: numberOfRequestsIncludingPreflight,
            },
          );

          const response = await fetch(joinURL(baseURL, '/users'), { method });
          expect(response.status).toBe(200);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
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

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              content: `Expected exactly ${numberOfRequestsIncludingPreflight} request${
                numberOfRequestsIncludingPreflight === 1 ? '' : 's'
              }, but got ${numberOfRequestsIncludingPreflight * 2}.`,
              minNumberOfRequests: numberOfRequestsIncludingPreflight,
              maxNumberOfRequests: numberOfRequestsIncludingPreflight,
            },
          );
        });
      });
    });

    describe('Unmatched requests', () => {
      it('should not consider requests unmatched due to restrictions in time checks', async () => {
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
              .with({ searchParams: { value: '1' } })
              .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS })
              .times(1),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            { content: 'Expected exactly 1 matching request, but got 0.', numberOfRequests: 1 },
          );

          const responsePromise = fetch(joinURL(baseURL, '/users'), { method });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          const contentLines = [
            'Expected exactly 1 matching request, but got 0.',
            '',
            'Requests evaluated by this handler:',
            '',
            '  - Expected',
            '  + Received',
          ];

          for (let requestIndex = 0; requestIndex < numberOfRequestsIncludingPreflight; requestIndex++) {
            const requestNumber = requestIndex + 1;

            contentLines.push(
              '',
              `${requestNumber}: ${method} ${joinURL(baseURL, '/users')}`,
              '     Search params:',
              '       - { "value": "1" }',
              '       + {}',
            );
          }

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            {
              content: contentLines.join('\n'),
              numberOfRequests: 1,
            },
          );
        });
      });

      it('should not consider requests unmatched due to missing response declarations in time checks', async () => {
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
          const handler = await promiseIfRemote(interceptor[lowerMethod]('/users').times(1), interceptor);
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            { content: 'Expected exactly 1 request, but got 0.', numberOfRequests: 1 },
          );

          const responsePromise = fetch(joinURL(baseURL, '/users'), { method });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            { content: 'Expected exactly 1 request, but got 0.', numberOfRequests: 1 },
          );
        });
      });

      it('should not consider requests unmatched due to unmocked path in time checks', async () => {
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
              .with({ searchParams: { value: '1' } })
              .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS })
              .times(1),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            { content: 'Expected exactly 1 matching request, but got 0.', numberOfRequests: 1 },
          );

          const responsePromise = fetch(joinURL(baseURL, '/users/other'), { method });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          await expectTimesCheckError(
            async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            },
            { content: 'Expected exactly 1 matching request, but got 0.', numberOfRequests: 1 },
          );
        });
      });
    });
  });
}
