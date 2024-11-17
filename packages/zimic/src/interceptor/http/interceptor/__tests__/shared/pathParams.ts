import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { HTTP_METHODS, HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/interceptor/server/constants';
import { importCrypto } from '@/utils/crypto';
import { joinURL } from '@/utils/urls';
import { expectBypassedResponse, expectPreflightResponse, expectFetchError } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export async function declarePathParamsHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const crypto = await importCrypto();

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: crypto.randomUUID(), name: 'User 1' },
    { id: crypto.randomUUID(), name: 'User 2' },
  ];

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

    it(`should support intercepting ${method} requests with a path parameter`, async () => {
      await usingHttpInterceptor<{
        '/users/:id': {
          GET: MethodSchema;
          POST: MethodSchema;
          PUT: MethodSchema;
          PATCH: MethodSchema;
          DELETE: MethodSchema;
          HEAD: MethodSchema;
          OPTIONS: MethodSchema;
        };
      }>(interceptorOptions, async (interceptor) => {
        const genericHandler = await promiseIfRemote(
          interceptor[lowerMethod]('/users/:id').respond((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<{ id: string }>();
            expect(request.pathParams).toEqual({ id: users[0].id });

            return { status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS };
          }),
          interceptor,
        );
        expect(genericHandler).toBeInstanceOf(Handler);

        let genericRequests = await promiseIfRemote(genericHandler.requests(), interceptor);
        expect(genericRequests).toHaveLength(0);

        const genericResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method });
        expect(genericResponse.status).toBe(200);

        genericRequests = await promiseIfRemote(genericHandler.requests(), interceptor);
        expect(genericRequests).toHaveLength(numberOfRequestsIncludingPreflight);
        const genericRequest = genericRequests[numberOfRequestsIncludingPreflight - 1];
        expect(genericRequest).toBeInstanceOf(Request);

        expectTypeOf(genericRequest.pathParams).toEqualTypeOf<{ id: string }>();
        expect(genericRequest.pathParams).toEqual({ id: users[0].id });

        expectTypeOf(genericRequest.body).toEqualTypeOf<null>();
        expect(genericRequest.body).toBe(null);

        expectTypeOf(genericRequest.response.status).toEqualTypeOf<200>();
        expect(genericRequest.response.status).toBe(200);

        expectTypeOf(genericRequest.response.body).toEqualTypeOf<null>();
        expect(genericRequest.response.body).toBe(null);

        await promiseIfRemote(genericHandler.bypass(), interceptor);

        const specificHandler = await promiseIfRemote(
          interceptor[lowerMethod](`/users/${users[0].id}`).respond((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<{ id: string }>();
            expect(request.pathParams).toEqual({});

            return {
              status: 200,
              headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            };
          }),
          interceptor,
        );
        expect(specificHandler).toBeInstanceOf(Handler);

        let specificRequests = await promiseIfRemote(specificHandler.requests(), interceptor);
        expect(specificRequests).toHaveLength(0);

        const specificResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method });
        expect(specificResponse.status).toBe(200);

        specificRequests = await promiseIfRemote(specificHandler.requests(), interceptor);
        expect(specificRequests).toHaveLength(numberOfRequestsIncludingPreflight);
        const specificRequest = specificRequests[numberOfRequestsIncludingPreflight - 1];
        expect(specificRequest).toBeInstanceOf(Request);

        expectTypeOf(specificRequest.pathParams).toEqualTypeOf<{ id: string }>();
        expect(specificRequest.pathParams).toEqual({});

        expectTypeOf(specificRequest.body).toEqualTypeOf<null>();
        expect(specificRequest.body).toBe(null);

        expectTypeOf(specificRequest.response.status).toEqualTypeOf<200>();
        expect(specificRequest.response.status).toBe(200);

        expectTypeOf(specificRequest.response.body).toEqualTypeOf<null>();
        expect(specificRequest.response.body).toBe(null);

        const unmatchedResponsePromise = fetch(joinURL(baseURL, `/users/${2}`), { method });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(unmatchedResponsePromise);
        } else if (type === 'local') {
          await expectBypassedResponse(unmatchedResponsePromise);
        } else {
          await expectFetchError(unmatchedResponsePromise);
        }
      });
    });
  });
}
