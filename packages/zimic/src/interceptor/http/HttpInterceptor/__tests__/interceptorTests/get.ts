import { expect, expectTypeOf, it } from 'vitest';

import HttpRequestTracker from '@/interceptor/http/HttpRequestTracker';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorClass } from '../../types/classes';

export function createGetHttpInterceptorTests<InterceptorClass extends HttpInterceptorClass>(
  Interceptor: InterceptorClass,
) {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  it('should support intercepting GET requests with a static response body', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const listTracker = interceptor.get('/users').respond({
        status: 200,
        body: users,
      });
      expect(listTracker).toBeInstanceOf(HttpRequestTracker);

      const listRequests = listTracker.requests();
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, {
        method: 'GET',
      });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User;
      expect(fetchedUsers).toEqual(users);

      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<never>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual(users);
    });
  });

  it('should support intercepting GET requests with a computed response body', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      const userName = `User (other ${Math.random()})`;

      await interceptor.start();

      const listTracker = interceptor.get('/users').respond(() => ({
        status: 200,
        body: [{ name: userName }],
      }));
      expect(listTracker).toBeInstanceOf(HttpRequestTracker);

      const listRequests = listTracker.requests();
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(`${baseURL}/users`, {
        method: 'GET',
      });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User;
      expect(fetchedUsers).toEqual<User[]>([{ name: userName }]);

      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<never>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual<User[]>([{ name: userName }]);
    });
  });

  it('should not intercept a GET request without a registered response', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      let fetchPromise = fetch(`${baseURL}/users`, { method: 'GET' });
      await expect(fetchPromise).rejects.toThrowError();

      const listTrackerWithoutResponse = interceptor.get('/users');
      expect(listTrackerWithoutResponse).toBeInstanceOf(HttpRequestTracker);

      const listRequestsWithoutResponse = listTrackerWithoutResponse.requests();
      expect(listRequestsWithoutResponse).toHaveLength(0);

      let [listRequestWithoutResponse] = listRequestsWithoutResponse;
      expectTypeOf<typeof listRequestWithoutResponse.body>().toEqualTypeOf<never>();
      expectTypeOf<typeof listRequestWithoutResponse.response.status>().toEqualTypeOf<never>();
      expectTypeOf<typeof listRequestWithoutResponse.response.body>().toEqualTypeOf<never>();

      fetchPromise = fetch(`${baseURL}/users`, { method: 'GET' });
      await expect(fetchPromise).rejects.toThrowError();

      expect(listRequestsWithoutResponse).toHaveLength(0);

      [listRequestWithoutResponse] = listRequestsWithoutResponse;
      expectTypeOf<typeof listRequestWithoutResponse.body>().toEqualTypeOf<never>();
      expectTypeOf<typeof listRequestWithoutResponse.response.status>().toEqualTypeOf<never>();
      expectTypeOf<typeof listRequestWithoutResponse.response.body>().toEqualTypeOf<never>();

      const listTrackerWithResponse = listTrackerWithoutResponse.respond({
        status: 200,
        body: users,
      });

      const listResponse = await fetch(`${baseURL}/users`, {
        method: 'GET',
      });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User;
      expect(fetchedUsers).toEqual(users);

      expect(listRequestsWithoutResponse).toHaveLength(0);
      const listRequestsWithResponse = listTrackerWithResponse.requests();
      expect(listRequestsWithResponse).toHaveLength(1);

      const [listRequestWithResponse] = listRequestsWithResponse;
      expect(listRequestWithResponse).toBeInstanceOf(Request);
      expect(listRequestWithResponse.response.status).toEqual(200);

      expectTypeOf(listRequestWithResponse.body).toEqualTypeOf<never>();
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

    const interceptor = new Interceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

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

      const listResponse = await fetch(`${baseURL}/users`, {
        method: 'GET',
      });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User;
      expect(fetchedUsers).toEqual([]);

      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<never>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual([]);

      const otherListTracker = interceptor.get('/users').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const otherListRequests = otherListTracker.requests();
      expect(otherListRequests).toHaveLength(0);

      const otherListResponse = await fetch(`${baseURL}/users`, {
        method: 'GET',
      });
      expect(otherListResponse.status).toBe(500);

      const serverError = (await otherListResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      expect(otherListRequests).toHaveLength(1);
      const [otherListRequest] = otherListRequests;
      expect(otherListRequest).toBeInstanceOf(Request);

      expectTypeOf(otherListRequest.body).toEqualTypeOf<never>();
      expect(otherListRequest.body).toBe(null);

      expectTypeOf(otherListRequest.response.status).toEqualTypeOf<500>();
      expect(otherListRequest.response.status).toEqual(500);

      expectTypeOf(otherListRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(otherListRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });
    });
  });
}
