import { HttpSchema } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, expect, expectTypeOf, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/server/constants';
import { importCrypto } from '@/utils/crypto';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export async function declarePathParamsHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

  const crypto = await importCrypto();

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: crypto.randomUUID(), name: 'User 1' },
    { id: crypto.randomUUID(), name: 'User 2' },
  ];

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  const Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  type MethodSchema = HttpSchema.Method<{
    response: { 200: { headers: AccessControlHeaders } };
  }>;

  it('should support intercepting requests with a path parameter', async () => {
    await usingHttpInterceptor<{
      '/users/:id': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const genericHandler = await promiseIfRemote(
        interceptor.get('/users/:id').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ id: string }>();
          expect(request.pathParams).toEqual({ id: users[0].id });

          return { status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS };
        }),
        interceptor,
      );
      expect(genericHandler).toBeInstanceOf(Handler);

      expect(genericHandler.requests).toHaveLength(0);

      const genericResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'GET' });
      expect(genericResponse.status).toBe(200);

      expect(genericHandler.requests).toHaveLength(1);
      const genericRequest = genericHandler.requests[0];
      expect(genericRequest).toBeInstanceOf(Request);

      expectTypeOf(genericRequest.pathParams).toEqualTypeOf<{ id: string }>();
      expect(genericRequest.pathParams).toEqual({ id: users[0].id });

      expectTypeOf(genericRequest.body).toEqualTypeOf<null>();
      expect(genericRequest.body).toBe(null);

      expectTypeOf(genericRequest.response.status).toEqualTypeOf<200>();
      expect(genericRequest.response.status).toBe(200);

      expectTypeOf(genericRequest.response.body).toEqualTypeOf<null>();
      expect(genericRequest.response.body).toBe(null);

      await promiseIfRemote(genericHandler.clear(), interceptor);

      const specificHandler = await promiseIfRemote(
        interceptor.get(`/users/${users[0].id}`).respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ id: string }>();
          expect(request.pathParams).toEqual({});

          return { status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS };
        }),
        interceptor,
      );
      expect(specificHandler).toBeInstanceOf(Handler);

      expect(specificHandler.requests).toHaveLength(0);

      const specificResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'GET' });
      expect(specificResponse.status).toBe(200);

      expect(specificHandler.requests).toHaveLength(1);
      const specificRequest = specificHandler.requests[0];
      expect(specificRequest).toBeInstanceOf(Request);

      expectTypeOf(specificRequest.pathParams).toEqualTypeOf<{ id: string }>();
      expect(specificRequest.pathParams).toEqual({});

      expectTypeOf(specificRequest.body).toEqualTypeOf<null>();
      expect(specificRequest.body).toBe(null);

      expectTypeOf(specificRequest.response.status).toEqualTypeOf<200>();
      expect(specificRequest.response.status).toBe(200);

      expectTypeOf(specificRequest.response.body).toEqualTypeOf<null>();
      expect(specificRequest.response.body).toBe(null);

      const unmatchedResponsePromise = fetch(joinURL(baseURL, '/users/2'), { method: 'GET' });
      await expectFetchError(unmatchedResponsePromise);
    });
  });
}
