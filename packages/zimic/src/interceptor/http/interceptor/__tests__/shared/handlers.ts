import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HTTP_METHODS, HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import DisabledRequestSavingError from '@/interceptor/http/requestHandler/errors/DisabledRequestSavingError';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/interceptor/server/constants';
import { importCrypto } from '@/utils/crypto';
import { joinURL } from '@/utils/urls';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectPreflightResponse, expectFetchError } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions, verifyUnhandledRequestMessage } from './utils';

export async function declareHandlerHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const crypto = await importCrypto();

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  type MethodSchema = HttpSchema.Method<{
    response: { 200: { headers: AccessControlHeaders } };
  }>;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;
  });

  describe.each(HTTP_METHODS)('Method (%s)', (method) => {
    const { overridesPreflightResponse, numberOfRequestsIncludingPreflight } = assessPreflightInterference({
      method,
      platform,
      type,
    });

    const lowerMethod = method.toLowerCase<'POST'>();

    it(`should support intercepting ${method} requests with a static response`, async () => {
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
          interceptor[lowerMethod]('/users').respond({
            status: 200,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
        const request = requests[numberOfRequestsIncludingPreflight - 1];
        expect(request).toBeInstanceOf(Request);

        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        expectTypeOf(request.response.status).toEqualTypeOf<200>();
        expect(request.response.status).toBe(200);

        expectTypeOf(request.response.body).toEqualTypeOf<null>();
        expect(request.response.body).toBe(null);
      });
    });

    it(`should support intercepting ${method} requests with a computed response`, async () => {
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
          interceptor[lowerMethod]('/users').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<null>();

            return {
              status: 200,
              headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method });

        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
        const request = requests[numberOfRequestsIncludingPreflight - 1];
        expect(request).toBeInstanceOf(Request);

        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        expectTypeOf(request.response.status).toEqualTypeOf<200>();
        expect(request.response.status).toBe(200);

        expectTypeOf(request.response.status).toEqualTypeOf<200>();
        expect(request.response.status).toBe(200);

        expectTypeOf(request.response.body).toEqualTypeOf<null>();
        expect(request.response.body).toBe(null);
      });
    });

    it(`should log an error if a ${method} request is intercepted with a computed response and the handler throws`, async () => {
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
      }>({ ...interceptorOptions, onUnhandledRequest: { action: 'reject', log: true } }, async (interceptor) => {
        const error = new Error('An error occurred.');

        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users').respond(() => {
            throw error;
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        await usingIgnoredConsole(['error', 'warn'], async (spies) => {
          const request = new Request(joinURL(baseURL, '/users'), {
            method,
            headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
          });
          const responsePromise = fetch(request);

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          expect(spies.error).toHaveBeenCalledTimes(
            method === 'OPTIONS' && type === 'remote' && platform === 'browser' ? 4 : 2,
          );
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error.mock.calls[0]).toEqual([error]);

          const errorMessage = spies.error.mock.calls[1].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });
        });

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);
      });
    });

    it(`should support intercepting ${method} requests having headers`, async () => {
      type UserRequestHeaders = HttpSchema.Headers<{
        accept?: string;
      }>;

      type MethodSchema = HttpSchema.Method<{
        request: { headers: UserRequestHeaders };
        response: { 200: { headers: AccessControlHeaders } };
      }>;

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
          interceptor[lowerMethod]('/users').respond((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserRequestHeaders>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            const acceptHeader = request.headers.get('accept')!;
            expect(['application/json', '*/*']).toContain(acceptHeader);

            return {
              status: 200,
              headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), {
          method,
          headers: {
            accept: 'application/json',
          } satisfies UserRequestHeaders,
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
        const request = requests[numberOfRequestsIncludingPreflight - 1];
        expect(request).toBeInstanceOf(Request);

        expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserRequestHeaders>>();
        expect(request.headers).toBeInstanceOf(HttpHeaders);
        expect(request.headers.get('accept')).toBe('application/json');

        expectTypeOf(request.response.headers).toEqualTypeOf<HttpHeaders<AccessControlHeaders>>();
        expect(request.response.headers).toBeInstanceOf(HttpHeaders);
        expect(Object.fromEntries(request.response.headers.entries())).toEqual(
          expect.objectContaining(DEFAULT_ACCESS_CONTROL_HEADERS),
        );
      });
    });

    it(`should support intercepting ${method} requests having search params`, async () => {
      type UserSearchParams = HttpSchema.SearchParams<{
        tag?: string;
      }>;

      type MethodSchema = HttpSchema.Method<{
        request: { searchParams: UserSearchParams };
        response: { 200: { headers: AccessControlHeaders } };
      }>;

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
          interceptor[lowerMethod]('/users').respond((request) => {
            expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserSearchParams>>();
            expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

            return {
              status: 200,
              headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const searchParams = new HttpSearchParams<UserSearchParams>({ tag: 'admin' });

        const response = await fetch(joinURL(baseURL, `/users?${searchParams}`), { method });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
        const request = requests[numberOfRequestsIncludingPreflight - 1];
        expect(request).toBeInstanceOf(Request);

        expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserSearchParams>>();
        expect(request.searchParams).toBeInstanceOf(HttpSearchParams);
        expect(request.searchParams).toEqual(searchParams);
        expect(request.searchParams.get('tag')).toBe('admin');
      });
    });

    it(`should not intercept ${method} requests without a registered response`, async () => {
      type MethodSchema = HttpSchema.Method<{
        response: { 200: { headers: AccessControlHeaders } };
      }>;

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
        let responsePromise = fetch(joinURL(baseURL, '/users'), { method });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else {
          await expectFetchError(responsePromise);
        }

        const handlerWithoutResponse = await promiseIfRemote(interceptor[lowerMethod]('/users'), interceptor);
        expect(handlerWithoutResponse).toBeInstanceOf(Handler);

        let requestsWithoutResponse = await promiseIfRemote(handlerWithoutResponse.requests(), interceptor);
        expect(requestsWithoutResponse).toHaveLength(0);

        let _requestWithoutResponse = requestsWithoutResponse[numberOfRequestsIncludingPreflight - 1];
        expectTypeOf<typeof _requestWithoutResponse.body>().toEqualTypeOf<null>();
        expectTypeOf<typeof _requestWithoutResponse.response>().toEqualTypeOf<never>();

        responsePromise = fetch(joinURL(baseURL, '/users'), { method });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else {
          await expectFetchError(responsePromise);
        }

        requestsWithoutResponse = await promiseIfRemote(handlerWithoutResponse.requests(), interceptor);
        expect(requestsWithoutResponse).toHaveLength(0);

        _requestWithoutResponse = requestsWithoutResponse[numberOfRequestsIncludingPreflight];
        expectTypeOf<typeof _requestWithoutResponse.body>().toEqualTypeOf<null>();
        expectTypeOf<typeof _requestWithoutResponse.response>().toEqualTypeOf<never>();

        const handlerWithResponse = await promiseIfRemote(
          handlerWithoutResponse.respond({
            status: 200,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          }),
          interceptor,
        );

        const response = await fetch(joinURL(baseURL, '/users'), { method });
        expect(response.status).toBe(200);

        expect(requestsWithoutResponse).toHaveLength(0);
        const requestsWithResponse = await promiseIfRemote(handlerWithResponse.requests(), interceptor);
        expect(requestsWithResponse).toHaveLength(numberOfRequestsIncludingPreflight);

        const requestWithResponse = requestsWithResponse[numberOfRequestsIncludingPreflight - 1];
        expect(requestWithResponse).toBeInstanceOf(Request);
        expect(requestWithResponse.response.status).toBe(200);

        expectTypeOf(requestWithResponse.body).toEqualTypeOf<null>();
        expect(requestWithResponse.body).toBe(null);

        expectTypeOf(requestWithResponse.response.status).toEqualTypeOf<200>();
        expect(requestWithResponse.response.status).toBe(200);

        expectTypeOf(requestWithResponse.response.body).toEqualTypeOf<null>();
        expect(requestWithResponse.response.body).toBe(null);
      });
    });

    it(`should consider only the last declared response when intercepting ${method} requests`, async () => {
      type MethodSchema = HttpSchema.Method<{
        response: {
          200: { headers: AccessControlHeaders };
          201: { headers: AccessControlHeaders };
        };
      }>;

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
          interceptor[lowerMethod]('/users').respond({
            status: 200,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          }),
          interceptor,
        );

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
        const request = requests[numberOfRequestsIncludingPreflight - 1];
        expect(request).toBeInstanceOf(Request);

        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        expectTypeOf(request.response.status).toEqualTypeOf<200>();
        expect(request.response.status).toBe(200);

        expectTypeOf(request.response.body).toEqualTypeOf<null>();
        expect(request.response.body).toBe(null);

        const otherHandler = await promiseIfRemote(
          interceptor[lowerMethod]('/users').respond({
            status: 201,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          }),
          interceptor,
        );

        let otherRequests = await promiseIfRemote(otherHandler.requests(), interceptor);
        expect(otherRequests).toHaveLength(0);

        const otherResponse = await fetch(joinURL(baseURL, '/users'), { method });
        expect(otherResponse.status).toBe(201);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

        otherRequests = await promiseIfRemote(otherHandler.requests(), interceptor);
        expect(otherRequests).toHaveLength(numberOfRequestsIncludingPreflight);
        const otherRequest = otherRequests[numberOfRequestsIncludingPreflight - 1];
        expect(otherRequest).toBeInstanceOf(Request);

        expectTypeOf(otherRequest.body).toEqualTypeOf<null>();
        expect(otherRequest.body).toBe(null);

        expectTypeOf(otherRequest.response.status).toEqualTypeOf<201>();
        expect(otherRequest.response.status).toBe(201);

        expectTypeOf(otherRequest.response.body).toEqualTypeOf<null>();
        expect(otherRequest.response.body).toBe(null);
      });
    });

    if (method === 'OPTIONS') {
      it(`should result in a browser error after returning a remote ${method} request without proper access-control headers`, async () => {
        await usingHttpInterceptor<{
          '/users': {
            OPTIONS: {
              response: {
                200: { headers: {} };
              };
            };
          };
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.options('/users').respond({
              status: 200,
              headers: {},
            }),
            interceptor,
          );

          const initialRequests = await promiseIfRemote(handler.requests(), interceptor);
          expect(initialRequests).toHaveLength(0);

          const responsePromise = fetch(joinURL(baseURL, '/users'), { method });

          if (type === 'remote' && platform === 'browser') {
            await expectFetchError(responsePromise);
          } else {
            const response = await responsePromise;
            expect(response.status).toBe(200);
          }
        });
      });
    }

    describe('Request saving', () => {
      it.each([false, undefined])(
        `should not save intercepted ${method} requests if disabled with: %s`,
        async (saveRequests) => {
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
          }>({ ...interceptorOptions, saveRequests }, async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor[lowerMethod]('/users').respond({
                status: 200,
                headers: DEFAULT_ACCESS_CONTROL_HEADERS,
              }),
              interceptor,
            );

            const error = new DisabledRequestSavingError();

            await expect(async () => {
              await promiseIfRemote(handler.requests(), interceptor);
            }).rejects.toThrowError(error);

            // @ts-expect-error Checking that no intercepted requests are saved.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(handler._client.interceptedRequests).toHaveLength(0);

            const numberOfRequests = 5;

            for (let index = 0; index < numberOfRequests; index++) {
              const response = await fetch(joinURL(baseURL, '/users'), { method });
              expect(response.status).toBe(200);
            }

            await expect(async () => {
              await promiseIfRemote(handler.requests(), interceptor);
            }).rejects.toThrowError(error);

            // @ts-expect-error Checking that no intercepted requests are saved.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(handler._client.interceptedRequests).toHaveLength(0);
          });
        },
      );

      it.each([true])(`should save intercepted ${method} requests if enabled with: %s`, async (saveRequests) => {
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
        }>({ ...interceptorOptions, saveRequests }, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users').respond({
              status: 200,
              headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            }),
            interceptor,
          );

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          const numberOfRequests = 5;

          for (let index = 0; index < numberOfRequests; index++) {
            const response = await fetch(joinURL(baseURL, '/users'), { method });
            expect(response.status).toBe(200);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * numberOfRequests);
        });
      });
    });
  });
}
