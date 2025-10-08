import { HTTP_METHODS, HttpSchema } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/server/constants';
import { expectPreflightResponse } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareClearHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  const Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;

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

    type MethodSchema = HttpSchema.Method<{
      response: { 200: { headers: AccessControlHeaders } };
    }>;

    it(`should ignore all handlers after cleared when intercepting ${method} requests`, async () => {
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

        await promiseIfRemote(interceptor.clear(), interceptor);

        const responsePromise = fetch(joinURL(baseURL, '/users'), { method });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else {
          await expectFetchError(responsePromise);
        }

        expect(handler.requests).toHaveLength(0);
      });
    });

    it('should support creating new handlers after cleared', async () => {
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

    it('should support reusing previous handlers after cleared', async () => {
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
        const handler = await promiseIfRemote(interceptor[lowerMethod]('/users'), interceptor);

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

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method });
        expect(response.status).toBe(200);

        expect(otherHandler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
        const request = otherHandler.requests[numberOfRequestsIncludingPreflight - 1];
        expect(request).toBeInstanceOf(Request);

        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        expectTypeOf(request.response.status).toEqualTypeOf<200>();
        expect(request.response.status).toBe(200);

        expectTypeOf(request.response.body).toEqualTypeOf<null>();
        expect(request.response.body).toBe(null);
      });
    });
  });
}
