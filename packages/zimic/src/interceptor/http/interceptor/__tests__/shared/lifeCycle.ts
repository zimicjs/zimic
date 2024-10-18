import { beforeEach, describe, expect, it } from 'vitest';

import { HTTP_METHODS, HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/interceptor/server/constants';
import { fetchWithTimeout } from '@/utils/fetch';
import { joinURL } from '@/utils/urls';
import { expectFetchErrorOrPreflightResponse } from '@tests/utils/fetch';
import {
  assessPreflightInterference,
  createInternalHttpInterceptor,
  usingHttpInterceptor,
} from '@tests/utils/interceptors';

import NotStartedHttpInterceptorError from '../../errors/NotStartedHttpInterceptorError';
import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareLifeCycleHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

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

    type MethodSchema = HttpSchema.Method<{
      response: { 200: { headers: AccessControlHeaders } };
    }>;

    it(`should ignore all handlers after restarted when intercepting ${method} requests`, async () => {
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

        expect(interceptor.isRunning()).toBe(true);
        await interceptor.stop();
        expect(interceptor.isRunning()).toBe(false);

        let promise = fetchWithTimeout(joinURL(baseURL, '/users'), {
          method,
          timeout: 200,
        });
        await expectFetchErrorOrPreflightResponse(promise, {
          shouldBePreflight: overridesPreflightResponse,
          canBeAborted: true,
        });

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

        await interceptor.start();
        expect(interceptor.isRunning()).toBe(true);

        promise = fetch(joinURL(baseURL, '/users'), { method });
        await expectFetchErrorOrPreflightResponse(promise, {
          shouldBePreflight: overridesPreflightResponse,
        });

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
      });
    });

    it(`should ignore all handlers after restarted when intercepting ${method} requests, even if another interceptor is still running`, async () => {
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

        await usingHttpInterceptor(interceptorOptions, async (otherInterceptor) => {
          expect(interceptor.isRunning()).toBe(true);
          expect(otherInterceptor.isRunning()).toBe(true);

          await interceptor.stop();
          expect(interceptor.isRunning()).toBe(false);
          expect(otherInterceptor.isRunning()).toBe(true);

          let promise = fetchWithTimeout(joinURL(baseURL, '/users'), { method, timeout: 200 });
          await expectFetchErrorOrPreflightResponse(promise, {
            shouldBePreflight: overridesPreflightResponse,
            canBeAborted: true,
          });

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          await interceptor.start();
          expect(interceptor.isRunning()).toBe(true);
          expect(otherInterceptor.isRunning()).toBe(true);

          promise = fetch(joinURL(baseURL, '/users'), { method });
          await expectFetchErrorOrPreflightResponse(promise, {
            shouldBePreflight: overridesPreflightResponse,
          });

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
        });
      });
    });

    it(`should throw an error when trying to create a ${method} request handler if not running`, async () => {
      const interceptor = createInternalHttpInterceptor(interceptorOptions);
      expect(interceptor.isRunning()).toBe(false);

      await expect(async () => {
        await interceptor[lowerMethod]('/');
      }).rejects.toThrowError(new NotStartedHttpInterceptorError());
    });
  });
}
