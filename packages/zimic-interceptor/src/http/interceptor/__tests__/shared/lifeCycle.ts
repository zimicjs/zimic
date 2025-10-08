import { HTTP_METHODS, HttpSchema } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, describe, expect, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/server/constants';
import { expectBypassedResponse, expectPreflightResponse } from '@tests/utils/fetch';
import {
  assessPreflightInterference,
  createInternalHttpInterceptor,
  usingHttpInterceptor,
} from '@tests/utils/interceptors';

import NotRunningHttpInterceptorError from '../../errors/NotRunningHttpInterceptorError';
import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareLifeCycleHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

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

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method });
        expect(response.status).toBe(200);

        expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);

        expect(interceptor.isRunning).toBe(true);
        await interceptor.stop();
        expect(interceptor.isRunning).toBe(false);

        let responsePromise = fetch(joinURL(baseURL, '/users'), {
          method,
          signal: overridesPreflightResponse ? undefined : AbortSignal.timeout(500),
        });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else if (type === 'local') {
          await expectBypassedResponse(responsePromise, { canBeAborted: true });
        } else {
          await expectFetchError(responsePromise, { canBeAborted: true });
        }

        expect(handler.requests).toHaveLength(0);

        await interceptor.start();
        expect(interceptor.isRunning).toBe(true);

        responsePromise = fetch(joinURL(baseURL, '/users'), { method });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else {
          await expectFetchError(responsePromise);
        }

        expect(handler.requests).toHaveLength(0);
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

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method });
        expect(response.status).toBe(200);

        expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);

        await usingHttpInterceptor(interceptorOptions, async (otherInterceptor) => {
          expect(interceptor.isRunning).toBe(true);
          expect(otherInterceptor.isRunning).toBe(true);

          await interceptor.stop();
          expect(interceptor.isRunning).toBe(false);
          expect(otherInterceptor.isRunning).toBe(true);

          let responsePromise = fetch(joinURL(baseURL, '/users'), {
            method,
            signal: overridesPreflightResponse ? undefined : AbortSignal.timeout(500),
          });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise, { canBeAborted: true });
          }

          expect(handler.requests).toHaveLength(0);

          await interceptor.start();
          expect(interceptor.isRunning).toBe(true);
          expect(otherInterceptor.isRunning).toBe(true);

          responsePromise = fetch(joinURL(baseURL, '/users'), { method });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          expect(handler.requests).toHaveLength(0);
        });
      });
    });

    it(`should throw an error when trying to create a ${method} request handler if not running`, async () => {
      const interceptor = createInternalHttpInterceptor(interceptorOptions);
      expect(interceptor.isRunning).toBe(false);

      await expect(async () => {
        await interceptor[lowerMethod]('/');
      }).rejects.toThrowError(new NotRunningHttpInterceptorError());
    });
  });
}
