import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

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

export function declareClearHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
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

    type UserMethodSchema = HttpSchema.Method<{
      response: { 200: { headers: AccessControlHeaders } };
    }>;

    it(`should ignore all handlers after cleared when intercepting ${method} requests`, async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: UserMethodSchema;
          POST: UserMethodSchema;
          PUT: UserMethodSchema;
          PATCH: UserMethodSchema;
          DELETE: UserMethodSchema;
          HEAD: UserMethodSchema;
          OPTIONS: UserMethodSchema;
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

        await promiseIfRemote(interceptor.clear(), interceptor);

        const promise = fetch(joinURL(baseURL, '/users'), { method });
        await expectFetchErrorOrPreflightResponse(promise, {
          shouldBePreflight: overridesPreflightResponse,
        });

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
      });
    });

    it('should support creating new handlers after cleared', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: UserMethodSchema;
          POST: UserMethodSchema;
          PUT: UserMethodSchema;
          PATCH: UserMethodSchema;
          DELETE: UserMethodSchema;
          HEAD: UserMethodSchema;
          OPTIONS: UserMethodSchema;
        };
      }>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(
          interceptor[lowerMethod]('/users').respond({
            status: 200,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          }),
          interceptor,
        );

        await promiseIfRemote(interceptor.clear(), interceptor);

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
        expect(request.response.status).toEqual(200);

        expectTypeOf(request.response.body).toEqualTypeOf<null>();
        expect(request.response.body).toBe(null);
      });
    });

    it('should support reusing previous handlers after cleared', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: UserMethodSchema;
          POST: UserMethodSchema;
          PUT: UserMethodSchema;
          PATCH: UserMethodSchema;
          DELETE: UserMethodSchema;
          HEAD: UserMethodSchema;
          OPTIONS: UserMethodSchema;
        };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor[lowerMethod]('/users'), interceptor);
        expect(handler).toBeInstanceOf(Handler);

        await promiseIfRemote(
          handler.respond({
            status: 200,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          }),
          interceptor,
        );

        await promiseIfRemote(interceptor.clear(), interceptor);

        const otherHandler = await promiseIfRemote(
          handler.respond({
            status: 200,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          }),
          interceptor,
        );
        expect(otherHandler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(otherHandler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(otherHandler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
        const request = requests[numberOfRequestsIncludingPreflight - 1];
        expect(request).toBeInstanceOf(Request);

        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        expectTypeOf(request.response.status).toEqualTypeOf<200>();
        expect(request.response.status).toEqual(200);

        expectTypeOf(request.response.body).toEqualTypeOf<null>();
        expect(request.response.body).toBe(null);
      });
    });
  });
}
