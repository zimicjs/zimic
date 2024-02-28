import { afterAll, afterEach, beforeAll, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';
import HttpInterceptorWorker from '@/interceptor/http/interceptorWorker/HttpInterceptorWorker';
import HttpRequestTracker from '@/interceptor/http/requestTracker/HttpRequestTracker';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorSchema } from '../../../types/schema';
import { SharedHttpInterceptorTestsOptions } from '../interceptorTests';

export function declareGetHttpInterceptorTests({ platform }: SharedHttpInterceptorTestsOptions) {
  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  const worker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
  const baseURL = 'http://localhost:3000';

  beforeAll(async () => {
    await worker.start();
  });

  afterEach(() => {
    expect(worker.interceptorsWithHandlers()).toHaveLength(0);
  });

  afterAll(async () => {
    await worker.stop();
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
    }>({ worker, baseURL }, async (interceptor) => {
      const listTracker = interceptor.get('/users').respond({
        status: 200,
        body: users,
      });
      expect(listTracker).toBeInstanceOf(HttpRequestTracker);

      const listRequests = listTracker.requests();
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual(users);

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
    }>({ worker, baseURL }, async (interceptor) => {
      const user: User = {
        name: 'User (computed)',
      };

      const listTracker = interceptor.get('/users').respond(() => ({
        status: 200,
        body: [user],
      }));
      expect(listTracker).toBeInstanceOf(HttpRequestTracker);

      const listRequests = listTracker.requests();
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual<User[]>([user]);

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

  it('should support intercepting GET requests having search params', async () => {
    type UserListSearchParams = HttpInterceptorSchema.SearchParams<{
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
    }>({ worker, baseURL }, async (interceptor) => {
      const listTracker = interceptor.get('/users').respond((request) => {
        expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
        expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

        return {
          status: 200,
          body: users,
        };
      });
      expect(listTracker).toBeInstanceOf(HttpRequestTracker);

      const listRequests = listTracker.requests();
      expect(listRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserListSearchParams>({
        name: 'User 1',
        orderBy: ['createdAt', 'name'],
      });

      const listResponse = await fetch(`${baseURL}/users?${searchParams.toString()}`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

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

  it('should support intercepting GET requests having headers', async () => {
    type UserListRequestHeaders = HttpInterceptorSchema.Headers<{
      accept?: string;
    }>;
    type UserListResponseHeaders = HttpInterceptorSchema.Headers<{
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
    }>({ worker, baseURL }, async (interceptor) => {
      const listTracker = interceptor.get('/users').respond((request) => {
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
      });
      expect(listTracker).toBeInstanceOf(HttpRequestTracker);

      const listRequests = listTracker.requests();
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
        } satisfies UserListRequestHeaders,
      });
      expect(listResponse.status).toBe(200);
      expect(listResponse.headers.get('content-type')).toBe('application/json');

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

  it('should support intercepting GET requests with a dynamic path', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const genericGetTracker = interceptor.get('/users/:id').respond({
        status: 200,
        body: users[0],
      });
      expect(genericGetTracker).toBeInstanceOf(HttpRequestTracker);

      const genericGetRequests = genericGetTracker.requests();
      expect(genericGetRequests).toHaveLength(0);

      const genericGetResponse = await fetch(`${baseURL}/users/${1}`, { method: 'GET' });
      expect(genericGetResponse.status).toBe(200);

      const genericFetchedUser = (await genericGetResponse.json()) as User;
      expect(genericFetchedUser).toEqual(users[0]);

      expect(genericGetRequests).toHaveLength(1);
      const [genericGetRequest] = genericGetRequests;
      expect(genericGetRequest).toBeInstanceOf(Request);

      expectTypeOf(genericGetRequest.body).toEqualTypeOf<null>();
      expect(genericGetRequest.body).toBe(null);

      expectTypeOf(genericGetRequest.response.status).toEqualTypeOf<200>();
      expect(genericGetRequest.response.status).toEqual(200);

      expectTypeOf(genericGetRequest.response.body).toEqualTypeOf<User>();
      expect(genericGetRequest.response.body).toEqual(users[0]);

      genericGetTracker.bypass();

      const specificGetTracker = interceptor.get<'/users/:id'>(`/users/${1}`).respond({
        status: 200,
        body: users[0],
      });
      expect(specificGetTracker).toBeInstanceOf(HttpRequestTracker);

      const specificGetRequests = specificGetTracker.requests();
      expect(specificGetRequests).toHaveLength(0);

      const specificGetResponse = await fetch(`${baseURL}/users/${1}`, { method: 'GET' });
      expect(specificGetResponse.status).toBe(200);

      const specificFetchedUser = (await specificGetResponse.json()) as User;
      expect(specificFetchedUser).toEqual(users[0]);

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
      await expect(unmatchedGetPromise).rejects.toThrowError();
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
    }>({ worker, baseURL }, async (interceptor) => {
      let fetchPromise = fetch(`${baseURL}/users`, { method: 'GET' });
      await expect(fetchPromise).rejects.toThrowError();

      const listTrackerWithoutResponse = interceptor.get('/users');
      expect(listTrackerWithoutResponse).toBeInstanceOf(HttpRequestTracker);

      const listRequestsWithoutResponse = listTrackerWithoutResponse.requests();
      expect(listRequestsWithoutResponse).toHaveLength(0);

      let [listRequestWithoutResponse] = listRequestsWithoutResponse;
      expectTypeOf<typeof listRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof listRequestWithoutResponse.response>().toEqualTypeOf<never>();

      fetchPromise = fetch(`${baseURL}/users`, { method: 'GET' });
      await expect(fetchPromise).rejects.toThrowError();

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
      const listRequestsWithResponse = listTrackerWithResponse.requests();
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
    interface ServerErrorResponseBody {
      message: string;
    }

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const listTracker = interceptor
        .get('/users')
        .respond({
          status: 200,
          body: users,
        })
        .respond({
          status: 200,
          body: [],
        });

      const listRequests = listTracker.requests();
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<null>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual([]);

      const errorListTracker = interceptor.get('/users').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const errorListRequests = errorListTracker.requests();
      expect(errorListRequests).toHaveLength(0);

      const otherListResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(otherListResponse.status).toBe(500);

      const serverError = (await otherListResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      expect(listRequests).toHaveLength(1);

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
    interface ServerErrorResponseBody {
      message: string;
    }

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const listTracker = interceptor
        .get('/users')
        .respond({
          status: 200,
          body: users,
        })
        .bypass();

      const initialListRequests = listTracker.requests();
      expect(initialListRequests).toHaveLength(0);

      const listPromise = fetch(`${baseURL}/users`, { method: 'GET' });
      await expect(listPromise).rejects.toThrowError();

      listTracker.respond({
        status: 200,
        body: [],
      });

      expect(initialListRequests).toHaveLength(0);
      const listRequests = listTracker.requests();
      expect(listRequests).toHaveLength(0);

      let listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      let fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

      expect(listRequests).toHaveLength(1);
      let [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<null>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual([]);

      const errorListTracker = interceptor.get('/users').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const errorListRequests = errorListTracker.requests();
      expect(errorListRequests).toHaveLength(0);

      const otherListResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(otherListResponse.status).toBe(500);

      const serverError = (await otherListResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      expect(listRequests).toHaveLength(1);

      expect(errorListRequests).toHaveLength(1);
      const [errorListRequest] = errorListRequests;
      expect(errorListRequest).toBeInstanceOf(Request);

      expectTypeOf(errorListRequest.body).toEqualTypeOf<null>();
      expect(errorListRequest.body).toBe(null);

      expectTypeOf(errorListRequest.response.status).toEqualTypeOf<500>();
      expect(errorListRequest.response.status).toEqual(500);

      expectTypeOf(errorListRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorListRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      errorListTracker.bypass();

      listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

      expect(errorListRequests).toHaveLength(1);

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
    }>({ worker, baseURL }, async (interceptor) => {
      const listTracker = interceptor.get('/users').respond({
        status: 200,
        body: users,
      });

      interceptor.clear();

      const initialListRequests = listTracker.requests();
      expect(initialListRequests).toHaveLength(0);

      const listPromise = fetch(`${baseURL}/users`, { method: 'GET' });
      await expect(listPromise).rejects.toThrowError();
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
    }>({ worker, baseURL }, async (interceptor) => {
      let listTracker = interceptor.get('/users').respond({
        status: 200,
        body: users,
      });

      interceptor.clear();

      listTracker = interceptor.get('/users').respond({
        status: 200,
        body: [],
      });

      const listRequests = listTracker.requests();
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

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
    }>({ worker, baseURL }, async (interceptor) => {
      const listTracker = interceptor.get('/users').respond({
        status: 200,
        body: users,
      });

      interceptor.clear();

      listTracker.respond({
        status: 200,
        body: [],
      });

      const listRequests = listTracker.requests();
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

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
