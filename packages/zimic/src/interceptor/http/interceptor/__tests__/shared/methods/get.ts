import { afterAll, afterEach, beforeAll, expect, expectTypeOf, it } from 'vitest';

import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';
import InternalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/InternalHttpInterceptorWorker';
import InternalHttpRequestTracker from '@/interceptor/http/requestTracker/InternalHttpRequestTracker';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { SharedHttpInterceptorTestsOptions } from '../interceptorTests';

export function declareGetHttpInterceptorTests({ platform }: SharedHttpInterceptorTestsOptions) {
  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  const worker = createHttpInterceptorWorker({ platform }) as InternalHttpInterceptorWorker;
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
      expect(listTracker).toBeInstanceOf(InternalHttpRequestTracker);

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
      const userName = `User (other ${Math.random()})`;

      const listTracker = interceptor.get('/users').respond(() => ({
        status: 200,
        body: [{ name: userName }],
      }));
      expect(listTracker).toBeInstanceOf(InternalHttpRequestTracker);

      const listRequests = listTracker.requests();
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual<User[]>([{ name: userName }]);

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
      expect(listRequest.response.body).toEqual<User[]>([{ name: userName }]);
    });
  });

  it('should support intercepting GET requests with a dynamic route', async () => {
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
      expect(genericGetTracker).toBeInstanceOf(InternalHttpRequestTracker);

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
      expect(specificGetTracker).toBeInstanceOf(InternalHttpRequestTracker);

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
      expect(listTrackerWithoutResponse).toBeInstanceOf(InternalHttpRequestTracker);

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
