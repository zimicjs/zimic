import { beforeEach, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/RemoteHttpInterceptorWorker';
import LocalHttpRequestTracker from '@/interceptor/http/requestTracker/LocalHttpRequestTracker';
import RemoteHttpRequestTracker from '@/interceptor/http/requestTracker/RemoteHttpRequestTracker';
import { JSONValue } from '@/types/json';
import { getCrypto } from '@/utils/crypto';
import { expectFetchError } from '@tests/utils/fetch';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../types';

export async function declareDeleteHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { getBaseURL, getWorker, getInterceptorOptions } = options;

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

  let baseURL: string;
  let worker: LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker;
  let interceptorOptions: HttpInterceptorOptions;

  let Tracker: typeof LocalHttpRequestTracker | typeof RemoteHttpRequestTracker;

  beforeEach(() => {
    baseURL = getBaseURL();
    worker = getWorker();
    interceptorOptions = getInterceptorOptions();

    Tracker = worker instanceof LocalHttpInterceptorWorker ? LocalHttpRequestTracker : RemoteHttpRequestTracker;
  });

  it('should support intercepting DELETE requests with a static response body', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionTracker = await promiseIfRemote(
        interceptor.delete(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[0],
        }),
        worker,
      );
      expect(deletionTracker).toBeInstanceOf(Tracker);

      let deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      const deletedUsers = (await deletionResponse.json()) as User;
      expect(deletedUsers).toEqual(users[0]);

      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<null>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[0]);
    });
  });

  it('should support intercepting DELETE requests with a computed response body, based on the request body', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          request: { body: Partial<User> };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionTracker = await promiseIfRemote(
        interceptor.delete(`/users/${users[0].id}`).respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<Partial<User>>();

          return {
            status: 200,
            body: users[0],
          };
        }),
        worker,
      );

      let deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(0);

      const userName = 'User (other)';

      const deletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies Partial<User>),
      });
      expect(deletionResponse.status).toBe(200);

      const deletedUsers = (await deletionResponse.json()) as User;
      expect(deletedUsers).toEqual<User>(users[0]);

      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<Partial<User>>();
      expect(deletionRequest.body).toEqual<Partial<User>>({ name: userName });

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual<User>(users[0]);
    });
  });

  it('should support intercepting DELETE requests having headers', async () => {
    type UserDeletionRequestHeaders = HttpSchema.Headers<{
      accept?: string;
    }>;
    type UserDeletionResponseHeaders = HttpSchema.Headers<{
      'content-type'?: `application/${string}`;
      'cache-control'?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          request: {
            headers: UserDeletionRequestHeaders;
          };
          response: {
            200: {
              headers: UserDeletionResponseHeaders;
              body: User;
            };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionTracker = await promiseIfRemote(
        interceptor.delete(`/users/:id`).respond((request) => {
          expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserDeletionRequestHeaders>>();
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
        worker,
      );
      expect(deletionTracker).toBeInstanceOf(Tracker);

      let deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'DELETE',
        headers: {
          accept: 'application/json',
        } satisfies UserDeletionRequestHeaders,
      });
      expect(deletionResponse.status).toBe(200);

      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.headers).toEqualTypeOf<HttpHeaders<UserDeletionRequestHeaders>>();
      expect(deletionRequest.headers).toBeInstanceOf(HttpHeaders);
      expect(deletionRequest.headers.get('accept')).toBe('application/json');

      expectTypeOf(deletionRequest.response.headers).toEqualTypeOf<HttpHeaders<UserDeletionResponseHeaders>>();
      expect(deletionRequest.response.headers).toBeInstanceOf(HttpHeaders);
      expect(deletionRequest.response.headers.get('content-type')).toBe('application/json');
      expect(deletionRequest.response.headers.get('cache-control')).toBe('no-cache');
    });
  });

  it('should support intercepting DELETE requests having search params', async () => {
    type UserDeletionSearchParams = HttpSchema.SearchParams<{
      tag?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          request: {
            searchParams: UserDeletionSearchParams;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionTracker = await promiseIfRemote(
        interceptor.delete(`/users/:id`).respond((request) => {
          expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserDeletionSearchParams>>();
          expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

          return {
            status: 200,
            body: users[0],
          };
        }),
        worker,
      );
      expect(deletionTracker).toBeInstanceOf(Tracker);

      let deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserDeletionSearchParams>({
        tag: 'admin',
      });

      const deletionResponse = await fetch(`${baseURL}/users/${users[0].id}?${searchParams.toString()}`, {
        method: 'DELETE',
      });
      expect(deletionResponse.status).toBe(200);

      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.searchParams).toEqualTypeOf<HttpSearchParams<UserDeletionSearchParams>>();
      expect(deletionRequest.searchParams).toBeInstanceOf(HttpSearchParams);
      expect(deletionRequest.searchParams).toEqual(searchParams);
      expect(deletionRequest.searchParams.get('tag')).toBe('admin');
    });
  });

  it('should support intercepting DELETE requests having headers restrictions', async () => {
    type UserDeletionHeaders = HttpSchema.Headers<{
      'content-type'?: string;
      accept?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          request: {
            headers: UserDeletionHeaders;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionTracker = await promiseIfRemote(
        interceptor
          .delete(`/users/:id`)
          .with({
            headers: { 'content-type': 'application/json' },
          })
          .with((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserDeletionHeaders>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            return request.headers.get('accept')?.includes('application/json') ?? false;
          })
          .respond((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserDeletionHeaders>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            return {
              status: 200,
              body: users[0],
            };
          }),
        worker,
      );
      expect(deletionTracker).toBeInstanceOf(Tracker);

      let deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(0);

      const headers = new HttpHeaders<UserDeletionHeaders>({
        'content-type': 'application/json',
        accept: 'application/json',
      });

      let deletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE', headers });
      expect(deletionResponse.status).toBe(200);
      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(1);

      headers.append('accept', 'application/xml');

      deletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE', headers });
      expect(deletionResponse.status).toBe(200);
      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(2);

      headers.delete('accept');

      let deletionResponsePromise = fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE', headers });
      await expectFetchError(deletionResponsePromise);
      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(2);

      headers.set('accept', 'application/json');
      headers.set('content-type', 'text/plain');

      deletionResponsePromise = fetch(`${baseURL}/users`, { method: 'DELETE', headers });
      await expectFetchError(deletionResponsePromise);
      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(2);
    });
  });

  it('should support intercepting DELETE requests having search params restrictions', async () => {
    type UserDeletionSearchParams = HttpSchema.SearchParams<{
      tag?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          request: {
            searchParams: UserDeletionSearchParams;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionTracker = await promiseIfRemote(
        interceptor
          .delete(`/users/:id`)
          .with({
            searchParams: { tag: 'admin' },
          })
          .respond((request) => {
            expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserDeletionSearchParams>>();
            expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

            return {
              status: 200,
              body: users[0],
            };
          }),
        worker,
      );
      expect(deletionTracker).toBeInstanceOf(Tracker);

      let deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserDeletionSearchParams>({
        tag: 'admin',
      });

      const deletionResponse = await fetch(`${baseURL}/users/${users[0].id}?${searchParams.toString()}`, {
        method: 'DELETE',
      });
      expect(deletionResponse.status).toBe(200);
      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(1);

      searchParams.delete('tag');

      const listResponsePromise = fetch(`${baseURL}/users/${users[0].id}?${searchParams.toString()}`, {
        method: 'DELETE',
      });
      await expectFetchError(listResponsePromise);
      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(1);
    });
  });

  it('should support intercepting DELETE requests having body restrictions', async () => {
    type UserDeletionBody = JSONValue<{
      tags?: string[];
      other?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          request: {
            body: UserDeletionBody;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionTracker = await promiseIfRemote(
        interceptor
          .delete(`/users/:id`)
          .with({
            body: { tags: ['admin'] },
          })
          .with((request) => {
            expectTypeOf(request.body).toEqualTypeOf<UserDeletionBody>();

            return request.body.other?.startsWith('extra') ?? false;
          })
          .respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<UserDeletionBody>();

            return {
              status: 200,
              body: users[0],
            };
          }),
        worker,
      );
      expect(deletionTracker).toBeInstanceOf(Tracker);

      let deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(0);

      let deletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          tags: ['admin'],
          other: 'extra',
        } satisfies UserDeletionBody),
      });
      expect(deletionResponse.status).toBe(200);
      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(1);

      deletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          tags: ['admin'],
          other: 'extra-other',
        } satisfies UserDeletionBody),
      });
      expect(deletionResponse.status).toBe(200);
      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(2);

      let deletionResponsePromise = fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          tags: ['admin'],
        } satisfies UserDeletionBody),
      });
      await expectFetchError(deletionResponsePromise);
      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(2);

      deletionResponsePromise = fetch(`${baseURL}/users`, {
        method: 'DELETE',
        body: JSON.stringify({
          tags: [],
        } satisfies UserDeletionBody),
      });
      await expectFetchError(deletionResponsePromise);
      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(2);
    });
  });

  it('should support intercepting DELETE requests with a dynamic path', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const genericDeletionTracker = await promiseIfRemote(
        interceptor.delete(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[0],
        }),
        worker,
      );
      expect(genericDeletionTracker).toBeInstanceOf(Tracker);

      let genericDeletionRequests = await promiseIfRemote(genericDeletionTracker.requests(), worker);
      expect(genericDeletionRequests).toHaveLength(0);

      const genericDeletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE' });
      expect(genericDeletionResponse.status).toBe(200);

      const genericDeletedUser = (await genericDeletionResponse.json()) as User;
      expect(genericDeletedUser).toEqual(users[0]);

      genericDeletionRequests = await promiseIfRemote(genericDeletionTracker.requests(), worker);
      expect(genericDeletionRequests).toHaveLength(1);
      const [genericDeletionRequest] = genericDeletionRequests;
      expect(genericDeletionRequest).toBeInstanceOf(Request);

      expectTypeOf(genericDeletionRequest.body).toEqualTypeOf<null>();
      expect(genericDeletionRequest.body).toBe(null);

      expectTypeOf(genericDeletionRequest.response.status).toEqualTypeOf<200>();
      expect(genericDeletionRequest.response.status).toEqual(200);

      expectTypeOf(genericDeletionRequest.response.body).toEqualTypeOf<User>();
      expect(genericDeletionRequest.response.body).toEqual(users[0]);

      await promiseIfRemote(genericDeletionTracker.bypass(), worker);

      const specificDeletionTracker = await promiseIfRemote(
        interceptor.delete(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[0],
        }),
        worker,
      );
      expect(specificDeletionTracker).toBeInstanceOf(Tracker);

      let specificDeletionRequests = await promiseIfRemote(specificDeletionTracker.requests(), worker);
      expect(specificDeletionRequests).toHaveLength(0);

      const specificDeletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE' });
      expect(specificDeletionResponse.status).toBe(200);

      const specificDeletedUser = (await specificDeletionResponse.json()) as User;
      expect(specificDeletedUser).toEqual(users[0]);

      specificDeletionRequests = await promiseIfRemote(specificDeletionTracker.requests(), worker);
      expect(specificDeletionRequests).toHaveLength(1);
      const [specificDeletionRequest] = specificDeletionRequests;
      expect(specificDeletionRequest).toBeInstanceOf(Request);

      expectTypeOf(specificDeletionRequest.body).toEqualTypeOf<null>();
      expect(specificDeletionRequest.body).toBe(null);

      expectTypeOf(specificDeletionRequest.response.status).toEqualTypeOf<200>();
      expect(specificDeletionRequest.response.status).toEqual(200);

      expectTypeOf(specificDeletionRequest.response.body).toEqualTypeOf<User>();
      expect(specificDeletionRequest.response.body).toEqual(users[0]);

      const unmatchedDeletionPromise = fetch(`${baseURL}/users/${2}`, { method: 'DELETE' });
      await expectFetchError(unmatchedDeletionPromise);
    });
  });

  it('should not intercept a DELETE request without a registered response', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          request: { body: Partial<User> };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const userName = 'User (other)';

      let deletionPromise = fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies Partial<User>),
      });
      await expectFetchError(deletionPromise);

      const deletionTrackerWithoutResponse = await promiseIfRemote(interceptor.delete(`/users/:id`), worker);
      expect(deletionTrackerWithoutResponse).toBeInstanceOf(Tracker);

      let deletionRequestsWithoutResponse = await promiseIfRemote(deletionTrackerWithoutResponse.requests(), worker);
      expect(deletionRequestsWithoutResponse).toHaveLength(0);

      let [deletionRequestWithoutResponse] = deletionRequestsWithoutResponse;
      expectTypeOf<typeof deletionRequestWithoutResponse.body>().toEqualTypeOf<Partial<User>>();
      expectTypeOf<typeof deletionRequestWithoutResponse.response>().toEqualTypeOf<never>();

      deletionPromise = fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies Partial<User>),
      });
      await expectFetchError(deletionPromise);

      deletionRequestsWithoutResponse = await promiseIfRemote(deletionTrackerWithoutResponse.requests(), worker);
      expect(deletionRequestsWithoutResponse).toHaveLength(0);

      [deletionRequestWithoutResponse] = deletionRequestsWithoutResponse;
      expectTypeOf<typeof deletionRequestWithoutResponse.body>().toEqualTypeOf<Partial<User>>();
      expectTypeOf<typeof deletionRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const deletionTrackerWithResponse = deletionTrackerWithoutResponse.respond({
        status: 200,
        body: users[0],
      });

      const deletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies Partial<User>),
      });
      expect(deletionResponse.status).toBe(200);

      const deletedUsers = (await deletionResponse.json()) as User;
      expect(deletedUsers).toEqual(users[0]);

      expect(deletionRequestsWithoutResponse).toHaveLength(0);
      const deletionRequestsWithResponse = await promiseIfRemote(deletionTrackerWithResponse.requests(), worker);
      expect(deletionRequestsWithResponse).toHaveLength(1);

      const [deletionRequest] = deletionRequestsWithResponse;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<Partial<User>>();
      expect(deletionRequest.body).toEqual<Partial<User>>({ name: userName });

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual<User>(users[0]);
    });
  });

  it('should consider only the last declared response when intercepting DELETE requests', async () => {
    type ServerErrorResponseBody = JSONValue<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionTracker = await promiseIfRemote(
        interceptor
          .delete(`/users/${users[0].id}`)
          .respond({
            status: 200,
            body: users[0],
          })
          .respond({
            status: 200,
            body: users[1],
          }),
        worker,
      );

      let deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      const deletionUsers = (await deletionResponse.json()) as User;
      expect(deletionUsers).toEqual(users[1]);

      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<null>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[1]);

      const errorDeletionTracker = await promiseIfRemote(
        interceptor.delete(`/users/${users[0].id}`).respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        worker,
      );

      let errorDeletionRequests = await promiseIfRemote(errorDeletionTracker.requests(), worker);
      expect(errorDeletionRequests).toHaveLength(0);

      const otherDeletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE' });
      expect(otherDeletionResponse.status).toBe(500);

      const serverError = (await otherDeletionResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(1);

      errorDeletionRequests = await promiseIfRemote(errorDeletionTracker.requests(), worker);
      expect(errorDeletionRequests).toHaveLength(1);
      const [errorDeletionRequest] = errorDeletionRequests;
      expect(errorDeletionRequest).toBeInstanceOf(Request);

      expectTypeOf(errorDeletionRequest.body).toEqualTypeOf<null>();
      expect(errorDeletionRequest.body).toBe(null);

      expectTypeOf(errorDeletionRequest.response.status).toEqualTypeOf<500>();
      expect(errorDeletionRequest.response.status).toEqual(500);

      expectTypeOf(errorDeletionRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorDeletionRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });
    });
  });

  it('should ignore trackers with bypassed responses when intercepting DELETE requests', async () => {
    type ServerErrorResponseBody = JSONValue<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionTracker = await promiseIfRemote(
        interceptor
          .delete(`/users/${users[0].id}`)
          .respond({
            status: 200,
            body: users[0],
          })
          .bypass(),
        worker,
      );

      let initialDeletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(initialDeletionRequests).toHaveLength(0);

      const deletionPromise = fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE' });
      await expectFetchError(deletionPromise);

      await promiseIfRemote(
        deletionTracker.respond({
          status: 200,
          body: users[1],
        }),
        worker,
      );

      initialDeletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(initialDeletionRequests).toHaveLength(0);
      let deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(0);

      let deletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      let createdUsers = (await deletionResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(1);
      let [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<null>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[1]);

      const errorDeletionTracker = await promiseIfRemote(
        interceptor.delete(`/users/${users[0].id}`).respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        worker,
      );

      let errorDeletionRequests = await promiseIfRemote(errorDeletionTracker.requests(), worker);
      expect(errorDeletionRequests).toHaveLength(0);

      const otherDeletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE' });
      expect(otherDeletionResponse.status).toBe(500);

      const serverError = (await otherDeletionResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(1);

      errorDeletionRequests = await promiseIfRemote(errorDeletionTracker.requests(), worker);
      expect(errorDeletionRequests).toHaveLength(1);
      const [errorDeletionRequest] = errorDeletionRequests;
      expect(errorDeletionRequest).toBeInstanceOf(Request);

      expectTypeOf(errorDeletionRequest.body).toEqualTypeOf<null>();
      expect(errorDeletionRequest.body).toBe(null);

      expectTypeOf(errorDeletionRequest.response.status).toEqualTypeOf<500>();
      expect(errorDeletionRequest.response.status).toEqual(500);

      expectTypeOf(errorDeletionRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorDeletionRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      await promiseIfRemote(errorDeletionTracker.bypass(), worker);

      deletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      createdUsers = (await deletionResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

      errorDeletionRequests = await promiseIfRemote(errorDeletionTracker.requests(), worker);
      expect(errorDeletionRequests).toHaveLength(1);

      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(2);
      [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<null>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[1]);
    });
  });

  it('should ignore all trackers after cleared when intercepting DELETE requests', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionTracker = await promiseIfRemote(
        interceptor.delete(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[0],
        }),
        worker,
      );

      await promiseIfRemote(interceptor.clear(), worker);

      const initialDeletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(initialDeletionRequests).toHaveLength(0);

      const deletionPromise = fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE' });
      await expectFetchError(deletionPromise);
    });
  });

  it('should support creating new trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      let deletionTracker = await promiseIfRemote(
        interceptor.delete(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[0],
        }),
        worker,
      );

      await promiseIfRemote(interceptor.clear(), worker);

      deletionTracker = await promiseIfRemote(
        interceptor.delete(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[1],
        }),
        worker,
      );

      let deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      const createdUsers = (await deletionResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<null>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[1]);
    });
  });

  it('should support reusing previous trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionTracker = await promiseIfRemote(
        interceptor.delete(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[0],
        }),
        worker,
      );

      await promiseIfRemote(interceptor.clear(), worker);

      await promiseIfRemote(
        deletionTracker.respond({
          status: 200,
          body: users[1],
        }),
        worker,
      );

      let deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      const createdUsers = (await deletionResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

      deletionRequests = await promiseIfRemote(deletionTracker.requests(), worker);
      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<null>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[1]);
    });
  });
}
