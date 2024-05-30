import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HTTP_METHODS, HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/interceptor/server/constants';
import { joinURL } from '@/utils/urls';
import { expectFetchErrorOrPreflightResponse } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './types';

export function declareRestrictionsHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
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

    // TODO: improve handler.with() type performance
    const lowerMethod = method.toLowerCase<'POST'>();

    type UserRequestHeaders = HttpSchema.Headers<{
      'content-language'?: string;
      accept?: string;
    }>;

    type UserSearchParams = HttpSchema.SearchParams<{
      tag?: string;
    }>;

    type MethodSchema = HttpSchema.Method<{
      request: {
        headers: UserRequestHeaders;
        searchParams: UserSearchParams;
      };
      response: { 200: { headers: AccessControlHeaders } };
    }>;

    it(`should support intercepting ${method} requests having headers restrictions`, async () => {
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
            .with({
              headers: { 'content-language': 'en' },
            })
            .with((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserRequestHeaders>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

              const acceptHeader = request.headers.get('accept');
              return acceptHeader ? acceptHeader.includes('application/json') : false;
            })
            .respond((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserRequestHeaders>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

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

        const headers = new HttpHeaders<UserRequestHeaders>({
          'content-language': 'en',
          accept: 'application/json',
        });

        let response = await fetch(joinURL(baseURL, '/users'), { method, headers });
        expect(response.status).toBe(200);
        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);

        headers.append('accept', 'application/xml');

        response = await fetch(joinURL(baseURL, '/users'), { method, headers });
        expect(response.status).toBe(200);
        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(2);

        headers.delete('accept');

        let promise = fetch(joinURL(baseURL, '/users'), { method, headers });
        await expectFetchErrorOrPreflightResponse(promise, {
          shouldBePreflight: overridesPreflightResponse,
        });
        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(2);

        headers.delete('content-language');

        promise = fetch(joinURL(baseURL, '/users'), { method, headers });
        await expectFetchErrorOrPreflightResponse(promise, {
          shouldBePreflight: overridesPreflightResponse,
        });
        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(2);

        headers.set('accept', 'application/json');
        headers.set('content-language', 'pt');

        promise = fetch(joinURL(baseURL, `/users`), { method, headers });
        await expectFetchErrorOrPreflightResponse(promise, {
          shouldBePreflight: overridesPreflightResponse,
        });
        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(2);
      });
    });

    it(`should support intercepting ${method} requests having search params restrictions`, async () => {
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
            .with({
              searchParams: { tag: 'admin' },
            })
            .respond((request) => {
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

        const searchParams = new HttpSearchParams<UserSearchParams>({
          tag: 'admin',
        });

        const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
          method,
        });
        expect(response.status).toBe(200);
        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

        searchParams.delete('tag');

        const promise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
          method,
        });
        await expectFetchErrorOrPreflightResponse(promise, {
          shouldBePreflight: overridesPreflightResponse,
        });
        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
      });
    });
  });
}
