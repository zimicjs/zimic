import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { HTTP_METHODS, HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/interceptor/server/constants';
import { joinURL } from '@/utils/urls';
import { expectPreflightResponse, expectFetchError } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareBypassHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
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

    const lowerMethod = method.toLowerCase<'POST'>(); // Only consider POST to reduce type unions

    type MethodSchema = HttpSchema.Method<{
      response: {
        200: { headers: AccessControlHeaders };
        201: { headers: AccessControlHeaders };
        204: { headers: AccessControlHeaders };
      };
    }>;

    it(`should ignore handlers with bypassed responses when intercepting ${method} requests`, async () => {
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
        const okHandler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
            .respond({
              status: 200,
              headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            })
            .bypass(),
          interceptor,
        );
        expect(okHandler).toBeInstanceOf(Handler);

        let initialRequests = await promiseIfRemote(okHandler.requests(), interceptor);
        expect(initialRequests).toHaveLength(0);

        const responsePromise = fetch(joinURL(baseURL, '/users'), { method });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else {
          await expectFetchError(responsePromise);
        }

        const createdHandler = await promiseIfRemote(
          okHandler.respond({
            status: 201,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          }),
          interceptor,
        );
        expect(createdHandler).toBeInstanceOf(Handler);

        initialRequests = await promiseIfRemote(okHandler.requests(), interceptor);
        expect(initialRequests).toHaveLength(0);
        let requests = await promiseIfRemote(createdHandler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        let response = await fetch(joinURL(baseURL, '/users'), { method });
        expect(response.status).toBe(201);

        requests = await promiseIfRemote(createdHandler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
        let request = requests[numberOfRequestsIncludingPreflight - 1];
        expect(request).toBeInstanceOf(Request);

        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        expectTypeOf(request.response.status).toEqualTypeOf<201>();
        expect(request.response.status).toBe(201);

        expectTypeOf(request.response.body).toEqualTypeOf<null>();
        expect(request.response.body).toBe(null);

        const noContentHandler = await promiseIfRemote(
          interceptor[lowerMethod]('/users').respond({
            status: 204,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          }),
          interceptor,
        );
        expect(noContentHandler).toBeInstanceOf(Handler);

        let withMessageRequests = await promiseIfRemote(noContentHandler.requests(), interceptor);
        expect(withMessageRequests).toHaveLength(0);

        const otherResponse = await fetch(joinURL(baseURL, '/users'), { method });
        expect(otherResponse.status).toBe(204);

        requests = await promiseIfRemote(createdHandler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

        withMessageRequests = await promiseIfRemote(noContentHandler.requests(), interceptor);
        expect(withMessageRequests).toHaveLength(numberOfRequestsIncludingPreflight);
        const withMessageRequest = withMessageRequests[numberOfRequestsIncludingPreflight - 1];
        expect(withMessageRequest).toBeInstanceOf(Request);

        expectTypeOf(withMessageRequest.body).toEqualTypeOf<null>();
        expect(withMessageRequest.body).toBe(null);

        expectTypeOf(withMessageRequest.response.status).toEqualTypeOf<204>();
        expect(withMessageRequest.response.status).toBe(204);

        expectTypeOf(withMessageRequest.response.body).toEqualTypeOf<null>();
        expect(withMessageRequest.response.body).toBe(null);

        await promiseIfRemote(noContentHandler.bypass(), interceptor);

        response = await fetch(joinURL(baseURL, '/users'), { method });
        expect(response.status).toBe(201);

        withMessageRequests = await promiseIfRemote(noContentHandler.requests(), interceptor);
        expect(withMessageRequests).toHaveLength(numberOfRequestsIncludingPreflight);

        requests = await promiseIfRemote(createdHandler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight * 2);
        request = requests[numberOfRequestsIncludingPreflight - 1];
        expect(request).toBeInstanceOf(Request);

        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        expectTypeOf(request.response.status).toEqualTypeOf<201>();
        expect(request.response.status).toBe(201);

        expectTypeOf(request.response.body).toEqualTypeOf<null>();
        expect(request.response.body).toBe(null);
      });
    });
  });
}
