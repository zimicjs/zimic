import { beforeEach, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { JSONValue } from '@/types/json';
import { getCrypto } from '@/utils/crypto';
import { fetchWithTimeout } from '@/utils/fetch';
import { joinURL } from '@/utils/urls';
import { expectFetchError } from '@tests/utils/fetch';
import { createInternalHttpInterceptor, usingHttpInterceptor } from '@tests/utils/interceptors';

import NotStartedHttpInterceptorError from '../../../errors/NotStartedHttpInterceptorError';
import { HttpInterceptorOptions } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../types';

export async function declarePutHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  const crypto = await getCrypto();

  type User = JSONValue<{
    id: string;
    name: string;
  }>;

  const users: User[] = [
    {
      id: crypto.randomUUID(),
      name: 'User 1',
    },
    {
      id: crypto.randomUUID(),
      name: 'User 2',
    },
  ];

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Handler = options.type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;
  });

  it('should support intercepting PUT requests with a static response', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const updateHandler = await promiseIfRemote(
        interceptor.put(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[0],
        }),
        interceptor,
      );
      expect(updateHandler).toBeInstanceOf(Handler);

      let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      expect(updateResponse.status).toBe(200);

      const updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual(users[0]);

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<null>();
      expect(updateRequest.body).toBe(null);

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual(users[0]);
    });
  });

  it('should support intercepting PUT requests with a computed response', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          request: { body: User };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const updateHandler = await promiseIfRemote(
        interceptor.put(`/users/${users[0].id}`).respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<User>();

          const updatedUser: User = { ...users[0], ...request.body };

          return {
            status: 200,
            body: updatedUser,
          };
        }),
        interceptor,
      );
      expect(updateHandler).toBeInstanceOf(Handler);

      let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(0);

      const userName = 'User (other)';

      const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
        method: 'PUT',
        body: JSON.stringify({ ...users[0], name: userName } satisfies User),
      });
      expect(updateResponse.status).toBe(200);

      const updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual<User>({ ...users[0], name: userName });

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<User>();
      expect(updateRequest.body).toEqual<User>({ ...users[0], name: userName });

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual<User>({ ...users[0], name: userName });
    });
  });
  it('should support intercepting PUT requests having headers', async () => {
    type UserUpdateRequestHeaders = HttpSchema.Headers<{
      accept?: string;
    }>;
    type UserUpdateResponseHeaders = HttpSchema.Headers<{
      'content-type'?: `application/${string}`;
      'cache-control'?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          request: {
            headers: UserUpdateRequestHeaders;
          };
          response: {
            200: {
              headers: UserUpdateResponseHeaders;
              body: User;
            };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const updateHandler = await promiseIfRemote(
        interceptor.put(`/users/${users[0].id}`).respond((request) => {
          expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserUpdateRequestHeaders>>();
          expect(request.headers).toBeInstanceOf(HttpHeaders);

          const acceptHeader = request.headers.get('accept')!;
          expect(acceptHeader).toBe('application/json');

          return {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'cache-control': 'no-cache',
            },
            body: users[0],
          };
        }),
        interceptor,
      );
      expect(updateHandler).toBeInstanceOf(Handler);

      let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
        method: 'PUT',
        headers: {
          accept: 'application/json',
        } satisfies UserUpdateRequestHeaders,
      });
      expect(updateResponse.status).toBe(200);

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.headers).toEqualTypeOf<HttpHeaders<UserUpdateRequestHeaders>>();
      expect(updateRequest.headers).toBeInstanceOf(HttpHeaders);
      expect(updateRequest.headers.get('accept')).toBe('application/json');

      expectTypeOf(updateRequest.response.headers).toEqualTypeOf<HttpHeaders<UserUpdateResponseHeaders>>();
      expect(updateRequest.response.headers).toBeInstanceOf(HttpHeaders);
      expect(updateRequest.response.headers.get('content-type')).toBe('application/json');
      expect(updateRequest.response.headers.get('cache-control')).toBe('no-cache');
    });
  });

  it('should support intercepting PUT requests having search params', async () => {
    type UserUpdateSearchParams = HttpSchema.SearchParams<{
      tag?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          request: {
            searchParams: UserUpdateSearchParams;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const updateHandler = await promiseIfRemote(
        interceptor.put(`/users/${users[0].id}`).respond((request) => {
          expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserUpdateSearchParams>>();
          expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

          return {
            status: 200,
            body: users[0],
          };
        }),
        interceptor,
      );
      expect(updateHandler).toBeInstanceOf(Handler);

      let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserUpdateSearchParams>({
        tag: 'admin',
      });

      const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}?${searchParams.toString()}`), {
        method: 'PUT',
      });
      expect(updateResponse.status).toBe(200);

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.searchParams).toEqualTypeOf<HttpSearchParams<UserUpdateSearchParams>>();
      expect(updateRequest.searchParams).toBeInstanceOf(HttpSearchParams);
      expect(updateRequest.searchParams).toEqual(searchParams);
      expect(updateRequest.searchParams.get('tag')).toBe('admin');
    });
  });

  it('should support intercepting PUT requests having headers restrictions', async () => {
    type UserUpdateHeaders = HttpSchema.Headers<{
      'content-type'?: string;
      accept?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          request: {
            headers: UserUpdateHeaders;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const updateHandler = await promiseIfRemote(
        interceptor
          .put(`/users/${users[0].id}`)
          .with({
            headers: { 'content-type': 'application/json' },
          })
          .with((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserUpdateHeaders>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            return request.headers.get('accept')?.includes('application/json') ?? false;
          })
          .respond((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserUpdateHeaders>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            return {
              status: 200,
              body: users[0],
            };
          }),
        interceptor,
      );
      expect(updateHandler).toBeInstanceOf(Handler);

      let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(0);

      const headers = new HttpHeaders<UserUpdateHeaders>({
        'content-type': 'application/json',
        accept: 'application/json',
      });

      let updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT', headers });
      expect(updateResponse.status).toBe(200);
      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);

      headers.append('accept', 'application/xml');

      updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT', headers });
      expect(updateResponse.status).toBe(200);
      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(2);

      headers.delete('accept');

      let updateResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT', headers });
      await expectFetchError(updateResponsePromise);
      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(2);

      headers.set('accept', 'application/json');
      headers.set('content-type', 'text/plain');

      updateResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT', headers });
      await expectFetchError(updateResponsePromise);
      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(2);
    });
  });

  it('should support intercepting PUT requests having search params restrictions', async () => {
    type UserUpdateSearchParams = HttpSchema.SearchParams<{
      tag?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          request: {
            searchParams: UserUpdateSearchParams;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const updateHandler = await promiseIfRemote(
        interceptor
          .put(`/users/${users[0].id}`)
          .with({
            searchParams: { tag: 'admin' },
          })
          .respond((request) => {
            expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserUpdateSearchParams>>();
            expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

            return {
              status: 200,
              body: users[0],
            };
          }),
        interceptor,
      );
      expect(updateHandler).toBeInstanceOf(Handler);

      let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserUpdateSearchParams>({
        tag: 'admin',
      });

      const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}?${searchParams.toString()}`), {
        method: 'PUT',
      });
      expect(updateResponse.status).toBe(200);
      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);

      searchParams.delete('tag');

      const updateResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}?${searchParams.toString()}`), {
        method: 'PUT',
      });
      await expectFetchError(updateResponsePromise);
      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);
    });
  });

  it('should support intercepting PUT requests having body restrictions', async () => {
    type UserUpdateBody = JSONValue<User>;

    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          request: {
            body: UserUpdateBody;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const updateHandler = await promiseIfRemote(
        interceptor
          .put(`/users/${users[0].id}`)
          .with({
            body: { ...users[0], name: users[1].name },
          })
          .respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<UserUpdateBody>();

            return {
              status: 200,
              body: users[0],
            };
          }),
        interceptor,
      );
      expect(updateHandler).toBeInstanceOf(Handler);

      let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
        method: 'PUT',
        body: JSON.stringify({
          ...users[0],
          name: users[1].name,
        } satisfies UserUpdateBody),
      });
      expect(updateResponse.status).toBe(200);
      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);

      const updateResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), {
        method: 'PUT',
        body: JSON.stringify({
          ...users[0],
          name: users[0].name,
        } satisfies UserUpdateBody),
      });
      await expectFetchError(updateResponsePromise);
      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);
    });
  });

  it('should support intercepting PUT requests with a dynamic path', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const genericUpdateHandler = await promiseIfRemote(
        interceptor.put('/users/:id').respond({
          status: 200,
          body: users[0],
        }),
        interceptor,
      );
      expect(genericUpdateHandler).toBeInstanceOf(Handler);

      let genericUpdateRequests = await promiseIfRemote(genericUpdateHandler.requests(), interceptor);
      expect(genericUpdateRequests).toHaveLength(0);

      const genericUpdateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      expect(genericUpdateResponse.status).toBe(200);

      const genericUpdatedUser = (await genericUpdateResponse.json()) as User;
      expect(genericUpdatedUser).toEqual(users[0]);

      genericUpdateRequests = await promiseIfRemote(genericUpdateHandler.requests(), interceptor);
      expect(genericUpdateRequests).toHaveLength(1);
      const [genericUpdateRequest] = genericUpdateRequests;
      expect(genericUpdateRequest).toBeInstanceOf(Request);

      expectTypeOf(genericUpdateRequest.body).toEqualTypeOf<null>();
      expect(genericUpdateRequest.body).toBe(null);

      expectTypeOf(genericUpdateRequest.response.status).toEqualTypeOf<200>();
      expect(genericUpdateRequest.response.status).toEqual(200);

      expectTypeOf(genericUpdateRequest.response.body).toEqualTypeOf<User>();
      expect(genericUpdateRequest.response.body).toEqual(users[0]);

      await promiseIfRemote(genericUpdateHandler.bypass(), interceptor);

      const specificUpdateHandler = await promiseIfRemote(
        interceptor.put(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[0],
        }),
        interceptor,
      );
      expect(specificUpdateHandler).toBeInstanceOf(Handler);

      let specificUpdateRequests = await promiseIfRemote(specificUpdateHandler.requests(), interceptor);
      expect(specificUpdateRequests).toHaveLength(0);

      const specificUpdateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      expect(specificUpdateResponse.status).toBe(200);

      const specificUpdatedUser = (await specificUpdateResponse.json()) as User;
      expect(specificUpdatedUser).toEqual(users[0]);

      specificUpdateRequests = await promiseIfRemote(specificUpdateHandler.requests(), interceptor);
      expect(specificUpdateRequests).toHaveLength(1);
      const [specificUpdateRequest] = specificUpdateRequests;
      expect(specificUpdateRequest).toBeInstanceOf(Request);

      expectTypeOf(specificUpdateRequest.body).toEqualTypeOf<null>();
      expect(specificUpdateRequest.body).toBe(null);

      expectTypeOf(specificUpdateRequest.response.status).toEqualTypeOf<200>();
      expect(specificUpdateRequest.response.status).toEqual(200);

      expectTypeOf(specificUpdateRequest.response.body).toEqualTypeOf<User>();
      expect(specificUpdateRequest.response.body).toEqual(users[0]);

      const unmatchedUpdatePromise = fetch(joinURL(baseURL, `/users/${users[1].id}`), { method: 'PUT' });
      await expectFetchError(unmatchedUpdatePromise);
    });
  });

  it('should not intercept a PUT request without a registered response', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          request: { body: User };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const userName = 'User (other)';

      let updatePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), {
        method: 'PUT',
        body: JSON.stringify({ ...users[0], name: userName } satisfies User),
      });
      await expectFetchError(updatePromise);

      const updateHandlerWithoutResponse = await promiseIfRemote(interceptor.put(`/users/${users[0].id}`), interceptor);
      expect(updateHandlerWithoutResponse).toBeInstanceOf(Handler);

      let updateRequestsWithoutResponse = await promiseIfRemote(updateHandlerWithoutResponse.requests(), interceptor);
      expect(updateRequestsWithoutResponse).toHaveLength(0);

      let [updateRequestWithoutResponse] = updateRequestsWithoutResponse;
      expectTypeOf<typeof updateRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof updateRequestWithoutResponse.response>().toEqualTypeOf<never>();

      updatePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), {
        method: 'PUT',
        body: JSON.stringify({ ...users[0], name: userName } satisfies User),
      });
      await expectFetchError(updatePromise);

      updateRequestsWithoutResponse = await promiseIfRemote(updateHandlerWithoutResponse.requests(), interceptor);
      expect(updateRequestsWithoutResponse).toHaveLength(0);

      [updateRequestWithoutResponse] = updateRequestsWithoutResponse;
      expectTypeOf<typeof updateRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof updateRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const updateHandlerWithResponse = updateHandlerWithoutResponse.respond({
        status: 200,
        body: users[0],
      });

      const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
        method: 'PUT',
        body: JSON.stringify({ ...users[0], name: userName } satisfies User),
      });
      expect(updateResponse.status).toBe(200);

      const updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual(users[0]);

      expect(updateRequestsWithoutResponse).toHaveLength(0);
      const updateRequestsWithResponse = await promiseIfRemote(updateHandlerWithResponse.requests(), interceptor);
      expect(updateRequestsWithResponse).toHaveLength(1);

      const [updateRequest] = updateRequestsWithResponse;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<User>();
      expect(updateRequest.body).toEqual<User>({ ...users[0], name: userName });

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual<User>(users[0]);
    });
  });

  it('should consider only the last declared response when intercepting PUT requests', async () => {
    type ServerErrorResponseBody = JSONValue<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          response: {
            200: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const updateHandler = await promiseIfRemote(
        interceptor
          .put(`/users/${users[0].id}`)
          .respond({
            status: 200,
            body: users[0],
          })
          .respond({
            status: 200,
            body: users[1],
          }),
        interceptor,
      );

      let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      expect(updateResponse.status).toBe(200);

      const updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual(users[1]);

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<null>();
      expect(updateRequest.body).toBe(null);

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual(users[1]);

      const errorUpdateHandler = await promiseIfRemote(
        interceptor.put(`/users/${users[0].id}`).respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        interceptor,
      );

      let errorUpdateRequests = await promiseIfRemote(errorUpdateHandler.requests(), interceptor);
      expect(errorUpdateRequests).toHaveLength(0);

      const otherUpdateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      expect(otherUpdateResponse.status).toBe(500);

      const serverError = (await otherUpdateResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);

      errorUpdateRequests = await promiseIfRemote(errorUpdateHandler.requests(), interceptor);
      expect(errorUpdateRequests).toHaveLength(1);
      const [errorUpdateRequest] = errorUpdateRequests;
      expect(errorUpdateRequest).toBeInstanceOf(Request);

      expectTypeOf(errorUpdateRequest.body).toEqualTypeOf<null>();
      expect(errorUpdateRequest.body).toBe(null);

      expectTypeOf(errorUpdateRequest.response.status).toEqualTypeOf<500>();
      expect(errorUpdateRequest.response.status).toEqual(500);

      expectTypeOf(errorUpdateRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorUpdateRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });
    });
  });

  it('should ignore handlers with bypassed responses when intercepting PUT requests', async () => {
    type ServerErrorResponseBody = JSONValue<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          response: {
            200: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const updateHandler = await promiseIfRemote(
        interceptor
          .put(`/users/${users[0].id}`)
          .respond({
            status: 200,
            body: users[0],
          })
          .bypass(),
        interceptor,
      );

      let initialUpdateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(initialUpdateRequests).toHaveLength(0);

      const updatePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      await expectFetchError(updatePromise);

      await promiseIfRemote(
        updateHandler.respond({
          status: 200,
          body: users[1],
        }),
        interceptor,
      );

      initialUpdateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(initialUpdateRequests).toHaveLength(0);
      let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(0);

      let updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      expect(updateResponse.status).toBe(200);

      let createdUsers = (await updateResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);
      let [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<null>();
      expect(updateRequest.body).toBe(null);

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual(users[1]);

      const errorUpdateHandler = await promiseIfRemote(
        interceptor.put(`/users/${users[0].id}`).respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        interceptor,
      );

      let errorUpdateRequests = await promiseIfRemote(errorUpdateHandler.requests(), interceptor);
      expect(errorUpdateRequests).toHaveLength(0);

      const otherUpdateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      expect(otherUpdateResponse.status).toBe(500);

      const serverError = (await otherUpdateResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);

      errorUpdateRequests = await promiseIfRemote(errorUpdateHandler.requests(), interceptor);
      expect(errorUpdateRequests).toHaveLength(1);
      const [errorUpdateRequest] = errorUpdateRequests;
      expect(errorUpdateRequest).toBeInstanceOf(Request);

      expectTypeOf(errorUpdateRequest.body).toEqualTypeOf<null>();
      expect(errorUpdateRequest.body).toBe(null);

      expectTypeOf(errorUpdateRequest.response.status).toEqualTypeOf<500>();
      expect(errorUpdateRequest.response.status).toEqual(500);

      expectTypeOf(errorUpdateRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorUpdateRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      await promiseIfRemote(errorUpdateHandler.bypass(), interceptor);

      updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      expect(updateResponse.status).toBe(200);

      createdUsers = (await updateResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

      errorUpdateRequests = await promiseIfRemote(errorUpdateHandler.requests(), interceptor);
      expect(errorUpdateRequests).toHaveLength(1);

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(2);
      [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<null>();
      expect(updateRequest.body).toBe(null);

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual(users[1]);
    });
  });

  it('should ignore all handlers after cleared when intercepting PUT requests', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const updateHandler = await promiseIfRemote(
        interceptor.put(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[0],
        }),
        interceptor,
      );

      let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      expect(updateResponse.status).toBe(200);

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);

      await promiseIfRemote(interceptor.clear(), interceptor);

      const updatePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      await expectFetchError(updatePromise);

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);
    });
  });

  it('should ignore all handlers after restarted when intercepting PUT requests', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const updateHandler = await promiseIfRemote(
        interceptor.put(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[0],
        }),
        interceptor,
      );

      let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      expect(updateResponse.status).toBe(200);

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);

      expect(interceptor.isRunning()).toBe(true);
      await interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);

      let updatePromise = fetchWithTimeout(joinURL(baseURL, `/users/${users[0].id}`), {
        method: 'PUT',
        timeout: 200,
      });
      await expectFetchError(updatePromise, { canBeAborted: true });

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);

      await interceptor.start();
      expect(interceptor.isRunning()).toBe(true);

      updatePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      await expectFetchError(updatePromise);

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);
    });
  });

  it('should ignore all handlers after restarted when intercepting PUT requests, even if another interceptor is still running', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const updateHandler = await promiseIfRemote(
        interceptor.put(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[0],
        }),
        interceptor,
      );

      let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      expect(updateResponse.status).toBe(200);

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);

      await usingHttpInterceptor(interceptorOptions, async (otherInterceptor) => {
        expect(interceptor.isRunning()).toBe(true);
        expect(otherInterceptor.isRunning()).toBe(true);

        await interceptor.stop();
        expect(interceptor.isRunning()).toBe(false);
        expect(otherInterceptor.isRunning()).toBe(true);

        let updatePromise = fetchWithTimeout(joinURL(baseURL, `/users/${users[0].id}`), {
          method: 'PUT',
          timeout: 200,
        });
        await expectFetchError(updatePromise, { canBeAborted: true });

        updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(1);

        await interceptor.start();
        expect(interceptor.isRunning()).toBe(true);
        expect(otherInterceptor.isRunning()).toBe(true);

        updatePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
        await expectFetchError(updatePromise);

        updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(1);
      });
    });
  });

  it('should throw an error when trying to create a PUT request handler if not running', async () => {
    const interceptor = createInternalHttpInterceptor(interceptorOptions);
    expect(interceptor.isRunning()).toBe(false);

    await expect(async () => {
      await interceptor.put('/');
    }).rejects.toThrowError(new NotStartedHttpInterceptorError());
  });

  it('should support creating new handlers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      let updateHandler = await promiseIfRemote(
        interceptor.put(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[0],
        }),
        interceptor,
      );

      await promiseIfRemote(interceptor.clear(), interceptor);

      updateHandler = await promiseIfRemote(
        interceptor.put(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[1],
        }),
        interceptor,
      );

      let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      expect(updateResponse.status).toBe(200);

      const updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual(users[1]);

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<null>();
      expect(updateRequest.body).toBe(null);

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual(users[1]);
    });
  });

  it('should support reusing current handlers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PUT: {
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const updateHandler = await promiseIfRemote(
        interceptor.put(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[0],
        }),
        interceptor,
      );

      await promiseIfRemote(interceptor.clear(), interceptor);

      await promiseIfRemote(
        updateHandler.respond({
          status: 200,
          body: users[1],
        }),
        interceptor,
      );

      let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
      expect(updateResponse.status).toBe(200);

      const updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual(users[1]);

      updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<null>();
      expect(updateRequest.body).toBe(null);

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual(users[1]);
    });
  });
}
