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

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Handler = options.type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;
  });

  it('should support intercepting GET requests with a static response', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listHandler = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 200,
          body: users,
        }),
        interceptor,
      );
      expect(listHandler).toBeInstanceOf(Handler);

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual(users);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
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

  it('should support intercepting GET requests with a computed response', async () => {
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

      const listHandler = await promiseIfRemote(
        interceptor.get('/users').respond(() => ({
          status: 200,
          body: [user],
        })),
        interceptor,
      );
      expect(listHandler).toBeInstanceOf(Handler);

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual<User[]>([user]);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
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
      const listHandler = await promiseIfRemote(
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
      expect(listHandler).toBeInstanceOf(Handler);

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(joinURL(baseURL, '/users'), {
        method: 'GET',
        headers: {
          accept: 'application/json',
        } satisfies UserListRequestHeaders,
      });
      expect(listResponse.status).toBe(200);
      expect(listResponse.headers.get('content-type')).toBe('application/json');

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
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
      const listHandler = await promiseIfRemote(
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
      expect(listHandler).toBeInstanceOf(Handler);

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserListSearchParams>({
        name: 'User 1',
        orderBy: ['createdAt', 'name'],
      });

      const listResponse = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
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
      const listHandler = await promiseIfRemote(
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
      expect(listHandler).toBeInstanceOf(Handler);

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const headers = new HttpHeaders<UserListHeaders>({
        'content-type': 'application/json',
        accept: 'application/json',
      });

      let listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
      expect(listResponse.status).toBe(200);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      headers.append('accept', 'application/xml');

      listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
      expect(listResponse.status).toBe(200);
      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(2);

      headers.delete('accept');

      let listResponsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
      await expectFetchError(listResponsePromise);
      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(2);

      headers.set('accept', 'application/json');
      headers.set('content-type', 'text/plain');

      listResponsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
      await expectFetchError(listResponsePromise);
      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
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
      const listHandler = await promiseIfRemote(
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
      expect(listHandler).toBeInstanceOf(Handler);

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserListSearchParams>({
        name: 'User 1',
        orderBy: ['createdAt', 'name'],
      });

      const listResponse = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      searchParams.delete('orderBy');

      let listResponsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
      await expectFetchError(listResponsePromise);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      searchParams.append('orderBy', 'name');
      searchParams.set('name', 'User 2');

      listResponsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
      await expectFetchError(listResponsePromise);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
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
      const genericGetHandler = await promiseIfRemote(
        interceptor.get('/users/:id').respond({
          status: 200,
          body: users[0],
        }),
        interceptor,
      );
      expect(genericGetHandler).toBeInstanceOf(Handler);

      let genericGetRequests = await promiseIfRemote(genericGetHandler.requests(), interceptor);
      expect(genericGetRequests).toHaveLength(0);

      const genericGetResponse = await fetch(joinURL(baseURL, `/users/${1}`), { method: 'GET' });
      expect(genericGetResponse.status).toBe(200);

      const genericFetchedUser = (await genericGetResponse.json()) as User;
      expect(genericFetchedUser).toEqual(users[0]);

      genericGetRequests = await promiseIfRemote(genericGetHandler.requests(), interceptor);
      expect(genericGetRequests).toHaveLength(1);
      const [genericGetRequest] = genericGetRequests;
      expect(genericGetRequest).toBeInstanceOf(Request);

      expectTypeOf(genericGetRequest.body).toEqualTypeOf<null>();
      expect(genericGetRequest.body).toBe(null);

      expectTypeOf(genericGetRequest.response.status).toEqualTypeOf<200>();
      expect(genericGetRequest.response.status).toEqual(200);

      expectTypeOf(genericGetRequest.response.body).toEqualTypeOf<User>();
      expect(genericGetRequest.response.body).toEqual(users[0]);

      await promiseIfRemote(genericGetHandler.bypass(), interceptor);

      const specificGetHandler = await promiseIfRemote(
        interceptor.get(`/users/${1}`).respond({
          status: 200,
          body: users[0],
        }),
        interceptor,
      );
      expect(specificGetHandler).toBeInstanceOf(Handler);

      let specificGetRequests = await promiseIfRemote(specificGetHandler.requests(), interceptor);
      expect(specificGetRequests).toHaveLength(0);

      const specificGetResponse = await fetch(joinURL(baseURL, `/users/${1}`), { method: 'GET' });
      expect(specificGetResponse.status).toBe(200);

      const specificFetchedUser = (await specificGetResponse.json()) as User;
      expect(specificFetchedUser).toEqual(users[0]);

      specificGetRequests = await promiseIfRemote(specificGetHandler.requests(), interceptor);
      expect(specificGetRequests).toHaveLength(1);
      const [specificGetRequest] = specificGetRequests;
      expect(specificGetRequest).toBeInstanceOf(Request);

      expectTypeOf(specificGetRequest.body).toEqualTypeOf<null>();
      expect(specificGetRequest.body).toBe(null);

      expectTypeOf(specificGetRequest.response.status).toEqualTypeOf<200>();
      expect(specificGetRequest.response.status).toEqual(200);

      expectTypeOf(specificGetRequest.response.body).toEqualTypeOf<User>();
      expect(specificGetRequest.response.body).toEqual(users[0]);

      const unmatchedGetPromise = fetch(joinURL(baseURL, `/users/${2}`), { method: 'GET' });
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
      let fetchPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      await expectFetchError(fetchPromise);

      const listHandlerWithoutResponse = await promiseIfRemote(interceptor.get('/users'), interceptor);
      expect(listHandlerWithoutResponse).toBeInstanceOf(Handler);

      let listRequestsWithoutResponse = await promiseIfRemote(listHandlerWithoutResponse.requests(), interceptor);
      expect(listRequestsWithoutResponse).toHaveLength(0);

      let [listRequestWithoutResponse] = listRequestsWithoutResponse;
      expectTypeOf<typeof listRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof listRequestWithoutResponse.response>().toEqualTypeOf<never>();

      fetchPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      await expectFetchError(fetchPromise);

      listRequestsWithoutResponse = await promiseIfRemote(listHandlerWithoutResponse.requests(), interceptor);
      expect(listRequestsWithoutResponse).toHaveLength(0);

      [listRequestWithoutResponse] = listRequestsWithoutResponse;
      expectTypeOf<typeof listRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof listRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const listHandlerWithResponse = listHandlerWithoutResponse.respond({
        status: 200,
        body: users,
      });

      const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual(users);

      expect(listRequestsWithoutResponse).toHaveLength(0);
      const listRequestsWithResponse = await promiseIfRemote(listHandlerWithResponse.requests(), interceptor);
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
      const listHandler = await promiseIfRemote(
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

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<null>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual([]);

      const errorListHandler = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        interceptor,
      );

      let errorListRequests = await promiseIfRemote(errorListHandler.requests(), interceptor);
      expect(errorListRequests).toHaveLength(0);

      const otherListResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(otherListResponse.status).toBe(500);

      const serverError = (await otherListResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      errorListRequests = await promiseIfRemote(errorListHandler.requests(), interceptor);
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

  it('should ignore handlers with bypassed responses when intercepting GET requests', async () => {
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
      const listHandler = await promiseIfRemote(
        interceptor
          .get('/users')
          .respond({
            status: 200,
            body: users,
          })
          .bypass(),
        interceptor,
      );

      let initialListRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(initialListRequests).toHaveLength(0);

      const listPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      await expectFetchError(listPromise);

      await promiseIfRemote(
        listHandler.respond({
          status: 200,
          body: [],
        }),
        interceptor,
      );

      initialListRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(initialListRequests).toHaveLength(0);
      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      let listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      let fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      let [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<null>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual([]);

      const errorListHandler = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        interceptor,
      );

      let errorListRequests = await promiseIfRemote(errorListHandler.requests(), interceptor);
      expect(errorListRequests).toHaveLength(0);

      const otherListResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(otherListResponse.status).toBe(500);

      const serverError = (await otherListResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      errorListRequests = await promiseIfRemote(errorListHandler.requests(), interceptor);
      expect(errorListRequests).toHaveLength(1);
      const [errorListRequest] = errorListRequests;
      expect(errorListRequest).toBeInstanceOf(Request);

      expectTypeOf(errorListRequest.body).toEqualTypeOf<null>();
      expect(errorListRequest.body).toBe(null);

      expectTypeOf(errorListRequest.response.status).toEqualTypeOf<500>();
      expect(errorListRequest.response.status).toEqual(500);

      expectTypeOf(errorListRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorListRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      await promiseIfRemote(errorListHandler.bypass(), interceptor);

      listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

      errorListRequests = await promiseIfRemote(errorListHandler.requests(), interceptor);
      expect(errorListRequests).toHaveLength(1);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
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

  it('should ignore all handlers after cleared when intercepting GET requests', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listHandler = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 200,
          body: users,
        }),
        interceptor,
      );

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      await promiseIfRemote(interceptor.clear(), interceptor);

      const listPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      await expectFetchError(listPromise);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
    });
  });

  it('should ignore all handlers after restarted when intercepting GET requests', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listHandler = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 200,
          body: users,
        }),
        interceptor,
      );

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      expect(interceptor.isRunning()).toBe(true);
      await interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);

      let listPromise = fetchWithTimeout(joinURL(baseURL, '/users'), {
        method: 'GET',
        timeout: 200,
      });
      await expectFetchError(listPromise, { canBeAborted: true });

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      await interceptor.start();
      expect(interceptor.isRunning()).toBe(true);

      listPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      await expectFetchError(listPromise);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
    });
  });

  it('should ignore all handlers after restarted when intercepting GET requests, even if another interceptor is still running', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listHandler = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 200,
          body: users,
        }),
        interceptor,
      );

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      await usingHttpInterceptor(interceptorOptions, async (otherInterceptor) => {
        expect(interceptor.isRunning()).toBe(true);
        expect(otherInterceptor.isRunning()).toBe(true);

        await interceptor.stop();
        expect(interceptor.isRunning()).toBe(false);
        expect(otherInterceptor.isRunning()).toBe(true);

        let listPromise = fetchWithTimeout(joinURL(baseURL, '/users'), {
          method: 'GET',
          timeout: 200,
        });
        await expectFetchError(listPromise, { canBeAborted: true });

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);

        await interceptor.start();
        expect(interceptor.isRunning()).toBe(true);
        expect(otherInterceptor.isRunning()).toBe(true);

        listPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(listPromise);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);
      });
    });
  });

  it('should throw an error when trying to create a GET request handler if not running', async () => {
    const interceptor = createInternalHttpInterceptor(interceptorOptions);
    expect(interceptor.isRunning()).toBe(false);

    await expect(async () => {
      await interceptor.get('/');
    }).rejects.toThrowError(new NotStartedHttpInterceptorError());
  });

  it('should support creating new handlers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      let listHandler = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 200,
          body: users,
        }),
        interceptor,
      );

      await promiseIfRemote(interceptor.clear(), interceptor);

      listHandler = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 200,
          body: [],
        }),
        interceptor,
      );

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
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

  it('should support reusing previous handlers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listHandler = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 200,
          body: users,
        }),
        interceptor,
      );

      await promiseIfRemote(interceptor.clear(), interceptor);

      await promiseIfRemote(
        listHandler.respond({
          status: 200,
          body: [],
        }),
        interceptor,
      );

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
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
