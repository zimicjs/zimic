import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HTTP_METHODS, HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/interceptor/server/constants';
import { joinURL } from '@/utils/urls';
import { expectFetchError, expectFetchErrorOrPreflightResponse } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './types';

export function declareHandlerHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;
  });

  describe.each(HTTP_METHODS)('Method: %s', (method) => {
    const { overridesPreflightResponse, numberOfRequestsIncludingPreflight } = assessPreflightInterference({
      method,
      platform,
      type,
    });

    const lowerMethod = method.toLowerCase<typeof method>();

    type MethodSchema = HttpSchema.Method<{
      response: { 200: { headers: AccessControlHeaders } };
    }>;

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

        const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method });
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

    it(`should not intercept an ${method} request without a registered response`, async () => {
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
        let fetchPromise = fetch(joinURL(baseURL, '/users'), { method });
        await expectFetchErrorOrPreflightResponse(fetchPromise, {
          shouldBePreflight: overridesPreflightResponse,
        });

        const handlerWithoutResponse = await promiseIfRemote(interceptor[lowerMethod]('/users'), interceptor);
        expect(handlerWithoutResponse).toBeInstanceOf(Handler);

        let requestsWithoutResponse = await promiseIfRemote(handlerWithoutResponse.requests(), interceptor);
        expect(requestsWithoutResponse).toHaveLength(0);

        let requestWithoutResponse = requestsWithoutResponse[numberOfRequestsIncludingPreflight - 1];
        expectTypeOf<typeof requestWithoutResponse.body>().toEqualTypeOf<null>();
        expectTypeOf<typeof requestWithoutResponse.response>().toEqualTypeOf<never>();

        fetchPromise = fetch(joinURL(baseURL, '/users'), { method });
        await expectFetchErrorOrPreflightResponse(fetchPromise, {
          shouldBePreflight: overridesPreflightResponse,
        });

        requestsWithoutResponse = await promiseIfRemote(handlerWithoutResponse.requests(), interceptor);
        expect(requestsWithoutResponse).toHaveLength(0);

        requestWithoutResponse = requestsWithoutResponse[numberOfRequestsIncludingPreflight];
        expectTypeOf<typeof requestWithoutResponse.body>().toEqualTypeOf<null>();
        expectTypeOf<typeof requestWithoutResponse.response>().toEqualTypeOf<never>();

        const handlerWithResponse = handlerWithoutResponse.respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
        });

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

          const promise = fetch(joinURL(baseURL, '/users'), { method });

          if (type === 'remote' && platform === 'browser') {
            await expectFetchError(promise);
          } else {
            const response = await promise;
            expect(response.status).toBe(200);
          }
        });
      });
    }
  });
}
