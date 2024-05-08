import { beforeEach, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestTracker from '@/interceptor/http/requestTracker/LocalHttpRequestTracker';
import RemoteHttpRequestTracker from '@/interceptor/http/requestTracker/RemoteHttpRequestTracker';
import { JSONValue } from '@/types/json';
import { getCrypto } from '@/utils/crypto';
import { expectFetchError } from '@tests/utils/fetch';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../types';

export async function declareGetHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
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

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  let Tracker: typeof LocalHttpRequestTracker | typeof RemoteHttpRequestTracker;

  beforeEach(() => {
    baseURL = getBaseURL().raw;
    interceptorOptions = getInterceptorOptions();

    Tracker = options.type === 'local' ? LocalHttpRequestTracker : RemoteHttpRequestTracker;
  });

  it('should support intercepting GET requests with a static response body', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listTracker = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 200,
          body: users,
        }),
        interceptor,
      );
      expect(listTracker).toBeInstanceOf(Tracker);

      let listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual(users);

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<null>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual(users);
    });
  });

  it('should support intercepting GET requests with a computed response body', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const user: User = {
        id: crypto.randomUUID(),
        name: 'User (computed)',
      };

      const listTracker = await promiseIfRemote(
        interceptor.get('/users').respond(() => ({
          status: 200,
          body: [user],
        })),
        interceptor,
      );
      expect(listTracker).toBeInstanceOf(Tracker);

      let listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual<User[]>([user]);

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<null>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual<User[]>([user]);
    });
  });

  it('should support intercepting GET requests having headers', async () => {
    type UserListRequestHeaders = HttpSchema.Headers<{
      accept?: string;
    }>;
    type UserListResponseHeaders = HttpSchema.Headers<{
      'content-type'?: `application/${string}`;
      'cache-control'?: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          request: {
            headers: UserListRequestHeaders;
          };
          response: {
            200: {
              headers: UserListResponseHeaders;
              body: User[];
            };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listTracker = await promiseIfRemote(
        interceptor.get('/users').respond((request) => {
          expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserListRequestHeaders>>();
          expect(request.headers).toBeInstanceOf(HttpHeaders);

          const acceptHeader = request.headers.get('accept')!;
          expect(acceptHeader).toBe('application/json');

          return {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'cache-control': 'no-cache',
            },
            body: users,
          };
        }),
        interceptor,
      );
      expect(listTracker).toBeInstanceOf(Tracker);

      let listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
        } satisfies UserListRequestHeaders,
      });
      expect(listResponse.status).toBe(200);
      expect(listResponse.headers.get('content-type')).toBe('application/json');

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.headers).toEqualTypeOf<HttpHeaders<UserListRequestHeaders>>();
      expect(listRequest.headers).toBeInstanceOf(HttpHeaders);
      expect(listRequest.headers.get('accept')).toBe('application/json');

      expectTypeOf(listRequest.response.headers).toEqualTypeOf<HttpHeaders<UserListResponseHeaders>>();
      expect(listRequest.response.headers).toBeInstanceOf(HttpHeaders);
      expect(listRequest.response.headers.get('content-type')).toBe('application/json');
      expect(listRequest.response.headers.get('cache-control')).toBe('no-cache');
    });
  });

  it('should support intercepting GET requests having search params', async () => {
    type UserListSearchParams = HttpSchema.SearchParams<{
      name?: string;
      orderBy?: ('name' | 'createdAt')[];
      page?: `${number}`;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          request: {
            searchParams: UserListSearchParams;
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listTracker = await promiseIfRemote(
        interceptor.get('/users').respond((request) => {
          expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
          expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

          return {
            status: 200,
            body: users,
          };
        }),
        interceptor,
      );
      expect(listTracker).toBeInstanceOf(Tracker);

      let listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserListSearchParams>({
        name: 'User 1',
        orderBy: ['createdAt', 'name'],
      });

      const listResponse = await fetch(`${baseURL}/users?${searchParams.toString()}`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
      expect(listRequest.searchParams).toBeInstanceOf(HttpSearchParams);
      expect(listRequest.searchParams).toEqual(searchParams);
      expect(listRequest.searchParams.get('name')).toBe('User 1');
      expect(listRequest.searchParams.getAll('orderBy')).toEqual(['createdAt', 'name']);
      expect(listRequest.searchParams.get('page')).toBe(null);
    });
  });

  it('should support intercepting GET requests having headers restrictions', async () => {
    type UserListHeaders = HttpSchema.Headers<{
      'content-type'?: string;
      accept?: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          request: {
            headers: UserListHeaders;
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listTracker = await promiseIfRemote(
        interceptor
          .get('/users')
          .with({
            headers: { 'content-type': 'application/json' },
          })
          .with((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserListHeaders>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            return request.headers.get('accept')?.includes('application/json') ?? false;
          })
          .respond((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserListHeaders>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            return {
              status: 200,
              body: users,
            };
          }),
        interceptor,
      );
      expect(listTracker).toBeInstanceOf(Tracker);

      let listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const headers = new HttpHeaders<UserListHeaders>({
        'content-type': 'application/json',
        accept: 'application/json',
      });

      let listResponse = await fetch(`${baseURL}/users`, { method: 'GET', headers });
      expect(listResponse.status).toBe(200);

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      headers.append('accept', 'application/xml');

      listResponse = await fetch(`${baseURL}/users`, { method: 'GET', headers });
      expect(listResponse.status).toBe(200);
      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(2);

      headers.delete('accept');

      let listResponsePromise = fetch(`${baseURL}/users`, { method: 'GET', headers });
      await expectFetchError(listResponsePromise);
      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(2);

      headers.set('accept', 'application/json');
      headers.set('content-type', 'text/plain');

      listResponsePromise = fetch(`${baseURL}/users`, { method: 'GET', headers });
      await expectFetchError(listResponsePromise);
      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(2);
    });
  });

  it('should support intercepting GET requests having search params restrictions', async () => {
    type UserListSearchParams = HttpSchema.SearchParams<{
      name?: string;
      orderBy?: ('name' | 'createdAt')[];
      page?: `${number}`;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          request: {
            searchParams: UserListSearchParams;
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listTracker = await promiseIfRemote(
        interceptor
          .get('/users')
          .with({
            searchParams: {
              name: 'User 1',
            },
          })
          .with((request) => {
            expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
            expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

            return request.searchParams.getAll('orderBy').length > 0;
          })
          .respond((request) => {
            expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
            expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

            return {
              status: 200,
              body: users,
            };
          }),
        interceptor,
      );
      expect(listTracker).toBeInstanceOf(Tracker);

      let listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserListSearchParams>({
        name: 'User 1',
        orderBy: ['createdAt', 'name'],
      });

      const listResponse = await fetch(`${baseURL}/users?${searchParams.toString()}`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      searchParams.delete('orderBy');

      let listResponsePromise = fetch(`${baseURL}/users?${searchParams.toString()}`, { method: 'GET' });
      await expectFetchError(listResponsePromise);

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      searchParams.append('orderBy', 'name');
      searchParams.set('name', 'User 2');

      listResponsePromise = fetch(`${baseURL}/users?${searchParams.toString()}`, { method: 'GET' });
      await expectFetchError(listResponsePromise);

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
    });
  });

  it('should support intercepting GET requests with a dynamic path', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const genericGetTracker = await promiseIfRemote(
        interceptor.get('/users/:id').respond({
          status: 200,
          body: users[0],
        }),
        interceptor,
      );
      expect(genericGetTracker).toBeInstanceOf(Tracker);

      let genericGetRequests = await promiseIfRemote(genericGetTracker.requests(), interceptor);
      expect(genericGetRequests).toHaveLength(0);

      const genericGetResponse = await fetch(`${baseURL}/users/${1}`, { method: 'GET' });
      expect(genericGetResponse.status).toBe(200);

      const genericFetchedUser = (await genericGetResponse.json()) as User;
      expect(genericFetchedUser).toEqual(users[0]);

      genericGetRequests = await promiseIfRemote(genericGetTracker.requests(), interceptor);
      expect(genericGetRequests).toHaveLength(1);
      const [genericGetRequest] = genericGetRequests;
      expect(genericGetRequest).toBeInstanceOf(Request);

      expectTypeOf(genericGetRequest.body).toEqualTypeOf<null>();
      expect(genericGetRequest.body).toBe(null);

      expectTypeOf(genericGetRequest.response.status).toEqualTypeOf<200>();
      expect(genericGetRequest.response.status).toEqual(200);

      expectTypeOf(genericGetRequest.response.body).toEqualTypeOf<User>();
      expect(genericGetRequest.response.body).toEqual(users[0]);

      await promiseIfRemote(genericGetTracker.bypass(), interceptor);

      const specificGetTracker = await promiseIfRemote(
        interceptor.get(`/users/${1}`).respond({
          status: 200,
          body: users[0],
        }),
        interceptor,
      );
      expect(specificGetTracker).toBeInstanceOf(Tracker);

      let specificGetRequests = await promiseIfRemote(specificGetTracker.requests(), interceptor);
      expect(specificGetRequests).toHaveLength(0);

      const specificGetResponse = await fetch(`${baseURL}/users/${1}`, { method: 'GET' });
      expect(specificGetResponse.status).toBe(200);

      const specificFetchedUser = (await specificGetResponse.json()) as User;
      expect(specificFetchedUser).toEqual(users[0]);

      specificGetRequests = await promiseIfRemote(specificGetTracker.requests(), interceptor);
      expect(specificGetRequests).toHaveLength(1);
      const [specificGetRequest] = specificGetRequests;
      expect(specificGetRequest).toBeInstanceOf(Request);

      expectTypeOf(specificGetRequest.body).toEqualTypeOf<null>();
      expect(specificGetRequest.body).toBe(null);

      expectTypeOf(specificGetRequest.response.status).toEqualTypeOf<200>();
      expect(specificGetRequest.response.status).toEqual(200);

      expectTypeOf(specificGetRequest.response.body).toEqualTypeOf<User>();
      expect(specificGetRequest.response.body).toEqual(users[0]);

      const unmatchedGetPromise = fetch(`${baseURL}/users/${2}`, { method: 'GET' });
      await expectFetchError(unmatchedGetPromise);
    });
  });

  it('should not intercept a GET request without a registered response', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      let fetchPromise = fetch(`${baseURL}/users`, { method: 'GET' });
      await expectFetchError(fetchPromise);

      const listTrackerWithoutResponse = await promiseIfRemote(interceptor.get('/users'), interceptor);
      expect(listTrackerWithoutResponse).toBeInstanceOf(Tracker);

      let listRequestsWithoutResponse = await promiseIfRemote(listTrackerWithoutResponse.requests(), interceptor);
      expect(listRequestsWithoutResponse).toHaveLength(0);

      let [listRequestWithoutResponse] = listRequestsWithoutResponse;
      expectTypeOf<typeof listRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof listRequestWithoutResponse.response>().toEqualTypeOf<never>();

      fetchPromise = fetch(`${baseURL}/users`, { method: 'GET' });
      await expectFetchError(fetchPromise);

      listRequestsWithoutResponse = await promiseIfRemote(listTrackerWithoutResponse.requests(), interceptor);
      expect(listRequestsWithoutResponse).toHaveLength(0);

      [listRequestWithoutResponse] = listRequestsWithoutResponse;
      expectTypeOf<typeof listRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof listRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const listTrackerWithResponse = listTrackerWithoutResponse.respond({
        status: 200,
        body: users,
      });

      const listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual(users);

      expect(listRequestsWithoutResponse).toHaveLength(0);
      const listRequestsWithResponse = await promiseIfRemote(listTrackerWithResponse.requests(), interceptor);
      expect(listRequestsWithResponse).toHaveLength(1);

      const [listRequestWithResponse] = listRequestsWithResponse;
      expect(listRequestWithResponse).toBeInstanceOf(Request);
      expect(listRequestWithResponse.response.status).toEqual(200);

      expectTypeOf(listRequestWithResponse.body).toEqualTypeOf<null>();
      expect(listRequestWithResponse.body).toBe(null);

      expectTypeOf(listRequestWithResponse.response.status).toEqualTypeOf<200>();
      expect(listRequestWithResponse.response.status).toEqual(200);

      expectTypeOf(listRequestWithResponse.response.body).toEqualTypeOf<User[]>();
      expect(listRequestWithResponse.response.body).toEqual(users);
    });
  });

  it('should consider only the last declared response when intercepting GET requests', async () => {
    type ServerErrorResponseBody = JSONValue<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listTracker = await promiseIfRemote(
        interceptor
          .get('/users')
          .respond({
            status: 200,
            body: users,
          })
          .respond({
            status: 200,
            body: [],
          }),
        interceptor,
      );

      let listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<null>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual([]);

      const errorListTracker = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        interceptor,
      );

      let errorListRequests = await promiseIfRemote(errorListTracker.requests(), interceptor);
      expect(errorListRequests).toHaveLength(0);

      const otherListResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(otherListResponse.status).toBe(500);

      const serverError = (await otherListResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      errorListRequests = await promiseIfRemote(errorListTracker.requests(), interceptor);
      expect(errorListRequests).toHaveLength(1);
      const [errorListRequest] = errorListRequests;
      expect(errorListRequest).toBeInstanceOf(Request);

      expectTypeOf(errorListRequest.body).toEqualTypeOf<null>();
      expect(errorListRequest.body).toBe(null);

      expectTypeOf(errorListRequest.response.status).toEqualTypeOf<500>();
      expect(errorListRequest.response.status).toEqual(500);

      expectTypeOf(errorListRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorListRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });
    });
  });

  it('should ignore trackers with bypassed responses when intercepting GET requests', async () => {
    type ServerErrorResponseBody = JSONValue<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listTracker = await promiseIfRemote(
        interceptor
          .get('/users')
          .respond({
            status: 200,
            body: users,
          })
          .bypass(),
        interceptor,
      );

      let initialListRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(initialListRequests).toHaveLength(0);

      const listPromise = fetch(`${baseURL}/users`, { method: 'GET' });
      await expectFetchError(listPromise);

      await promiseIfRemote(
        listTracker.respond({
          status: 200,
          body: [],
        }),
        interceptor,
      );

      initialListRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(initialListRequests).toHaveLength(0);
      let listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      let listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      let fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      let [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<null>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual([]);

      const errorListTracker = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        interceptor,
      );

      let errorListRequests = await promiseIfRemote(errorListTracker.requests(), interceptor);
      expect(errorListRequests).toHaveLength(0);

      const otherListResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(otherListResponse.status).toBe(500);

      const serverError = (await otherListResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      errorListRequests = await promiseIfRemote(errorListTracker.requests(), interceptor);
      expect(errorListRequests).toHaveLength(1);
      const [errorListRequest] = errorListRequests;
      expect(errorListRequest).toBeInstanceOf(Request);

      expectTypeOf(errorListRequest.body).toEqualTypeOf<null>();
      expect(errorListRequest.body).toBe(null);

      expectTypeOf(errorListRequest.response.status).toEqualTypeOf<500>();
      expect(errorListRequest.response.status).toEqual(500);

      expectTypeOf(errorListRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorListRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      await promiseIfRemote(errorListTracker.bypass(), interceptor);

      listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

      errorListRequests = await promiseIfRemote(errorListTracker.requests(), interceptor);
      expect(errorListRequests).toHaveLength(1);

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(2);
      [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<null>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual([]);
    });
  });

  it('should ignore all trackers when cleared when intercepting GET requests', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listTracker = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 200,
          body: users,
        }),
        interceptor,
      );

      await promiseIfRemote(interceptor.clear(), interceptor);

      const initialListRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(initialListRequests).toHaveLength(0);

      const listPromise = fetch(`${baseURL}/users`, { method: 'GET' });
      await expectFetchError(listPromise);
    });
  });

  it('should support creating new trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      let listTracker = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 200,
          body: users,
        }),
        interceptor,
      );

      await promiseIfRemote(interceptor.clear(), interceptor);

      listTracker = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 200,
          body: [],
        }),
        interceptor,
      );

      let listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<null>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual([]);
    });
  });

  it('should support reusing previous trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listTracker = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 200,
          body: users,
        }),
        interceptor,
      );

      await promiseIfRemote(interceptor.clear(), interceptor);

      await promiseIfRemote(
        listTracker.respond({
          status: 200,
          body: [],
        }),
        interceptor,
      );

      let listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

      listRequests = await promiseIfRemote(listTracker.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<null>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual([]);
    });
  });
}
