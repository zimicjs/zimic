import { HttpHeaders, HttpSearchParams, HTTP_METHODS, HttpSchema } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/server/constants';
import { importCrypto } from '@/utils/crypto';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectPreflightResponse } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions, verifyUnhandledRequestMessage } from './utils';

export async function declareHandlerHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const crypto = await importCrypto();

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  const Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;

  type MethodSchema = HttpSchema.Method<{
    response: { 200: { headers: AccessControlHeaders } };
  }>;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
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

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method });
        expect(response.status).toBe(200);

        expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
        const request = handler.requests[numberOfRequestsIncludingPreflight - 1];
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

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method });

        expect(response.status).toBe(200);

        expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
        const request = handler.requests[numberOfRequestsIncludingPreflight - 1];
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

        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['error', 'warn'], async (console) => {
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

          expect(console.error).toHaveBeenCalledTimes(
            method === 'OPTIONS' && type === 'remote' && platform === 'browser' ? 4 : 2,
          );
          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.error.mock.calls[0]).toEqual([error]);

          const errorMessage = console.error.mock.calls[1].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });
        });

        expect(handler.requests).toHaveLength(0);
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

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), {
          method,
          headers: {
            accept: 'application/json',
          } satisfies UserRequestHeaders,
        });
        expect(response.status).toBe(200);

        expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
        const request = handler.requests[numberOfRequestsIncludingPreflight - 1];
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

        expect(handler.requests).toHaveLength(0);

        const searchParams = new HttpSearchParams<UserSearchParams>({ tag: 'admin' });

        const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method });
        expect(response.status).toBe(200);

        expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
        const request = handler.requests[numberOfRequestsIncludingPreflight - 1];
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

        expect(handlerWithoutResponse.requests).toHaveLength(0);

        let _requestWithoutResponse = handlerWithoutResponse.requests[numberOfRequestsIncludingPreflight - 1];
        expectTypeOf<typeof _requestWithoutResponse.body>().toEqualTypeOf<null>();
        expectTypeOf<typeof _requestWithoutResponse.response>().toEqualTypeOf<never>();

        responsePromise = fetch(joinURL(baseURL, '/users'), { method });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else {
          await expectFetchError(responsePromise);
        }

        expect(handlerWithoutResponse.requests).toHaveLength(0);

        _requestWithoutResponse = handlerWithoutResponse.requests[numberOfRequestsIncludingPreflight];
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

        expect(handlerWithoutResponse.requests).toHaveLength(numberOfRequestsIncludingPreflight);
        expect(handlerWithResponse.requests).toHaveLength(numberOfRequestsIncludingPreflight);

        const requestWithResponse = handlerWithResponse.requests[numberOfRequestsIncludingPreflight - 1];
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

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method });
        expect(response.status).toBe(200);

        expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
        const request = handler.requests[numberOfRequestsIncludingPreflight - 1];
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

        expect(otherHandler.requests).toHaveLength(0);

        const otherResponse = await fetch(joinURL(baseURL, '/users'), { method });
        expect(otherResponse.status).toBe(201);

        expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);

        expect(otherHandler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
        const otherRequest = otherHandler.requests[numberOfRequestsIncludingPreflight - 1];
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

          expect(handler.requests).toHaveLength(0);

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
  });
}
