import { HttpSchema, HTTP_METHODS } from '@zimic/http';
import { joinURL } from '@zimic/utils/url';
import { beforeEach, describe, expect, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { DEFAULT_ACCESS_CONTROL_HEADERS, AccessControlHeaders } from '@/server/constants';
import { methodCanHaveResponseBody } from '@/utils/http';
import { getPreflightAssessment, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../utils';

export function declareDefaultBodyHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { type, platform, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  describe.each(HTTP_METHODS)('Method (%s)', (method) => {
    const { numberOfRequestsIncludingPreflight } = getPreflightAssessment({
      method,
      platform,
      type,
    });

    it('should include a response body only if the request method supports it', async () => {
      type MethodSchema = HttpSchema.Method<{
        response: {
          200: {
            headers: AccessControlHeaders;
            body: string;
          };
        };
      }>;

      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
          POST: MethodSchema;
          PUT: MethodSchema;
          DELETE: MethodSchema;
          PATCH: MethodSchema;
          HEAD: MethodSchema;
          OPTIONS: MethodSchema;
        };
      }>(interceptorOptions, async (interceptor) => {
        const lowerCaseMethod = method.toLowerCase<typeof method>();

        const handler = await promiseIfRemote(
          interceptor[lowerCaseMethod]('/users').respond({
            status: 200,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            body: 'data',
          }),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), { method });
        expect(response.status).toBe(200);

        expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);

        if (methodCanHaveResponseBody(method)) {
          expect(await response.text()).toBe('data');
          expect(handler.requests[0].response.body).toBe('data');
        } else {
          expect(await response.text()).toBe('');
          expect(handler.requests[0].response.body).toBe(null);
        }
      });
    });
  });
}
