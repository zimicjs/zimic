import { expect, expectTypeOf, it } from 'vitest';

import HttpRequestTracker from '@/interceptor/http/HttpRequestTracker';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorClass } from '../../types/classes';

export function createPatchHttpInterceptorTests<InterceptorClass extends HttpInterceptorClass>(
  Interceptor: InterceptorClass,
) {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  it('should support intercepting PATCH requests with a static response body', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        PATCH: {
          response: {
            201: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const updateTracker = interceptor.patch('/users').respond({
        status: 201,
        body: users[0],
      });
      expect(updateTracker).toBeInstanceOf(HttpRequestTracker);

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(`${baseURL}/users`, {
        method: 'PATCH',
      });
      expect(updateResponse.status).toBe(201);

      const fetchedUsers = (await updateResponse.json()) as User;
      expect(fetchedUsers).toEqual(users[0]);

      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<never>();
      expect(updateRequest.body).toBe(null);

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<201>();
      expect(updateRequest.response.status).toEqual(201);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual(users[0]);
    });
  });

  it('should support intercepting PATCH requests with a compatched response body, based on the request body', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        PATCH: {
          request: { body: User };
          response: {
            201: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const updateTracker = interceptor.patch('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<User>();

        return {
          status: 201,
          body: {
            name: request.body.name,
          },
        };
      });
      expect(updateTracker).toBeInstanceOf(HttpRequestTracker);

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const userName = 'User (other)';

      const updateResponse = await fetch(`${baseURL}/users`, {
        method: 'PATCH',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      expect(updateResponse.status).toBe(201);

      const fetchedUsers = (await updateResponse.json()) as User;
      expect(fetchedUsers).toEqual<User>({ name: userName });

      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<User>();
      expect(updateRequest.body).toEqual<User>({ name: userName });

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<201>();
      expect(updateRequest.response.status).toEqual(201);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual<User>({ name: userName });
    });
  });

  it('should not intercept a PATCH request without a registered response', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        PATCH: {
          request: { body: User };
          response: {
            201: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const userName = 'User (other)';

      let updatePromise = fetch(`${baseURL}/users`, {
        method: 'PATCH',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      await expect(updatePromise).rejects.toThrowError();

      const updateTrackerWithoutResponse = interceptor.patch('/users');
      expect(updateTrackerWithoutResponse).toBeInstanceOf(HttpRequestTracker);

      const updateRequestsWithoutResponse = updateTrackerWithoutResponse.requests();
      expect(updateRequestsWithoutResponse).toHaveLength(0);

      let [updateRequestWithoutResponse] = updateRequestsWithoutResponse;
      expectTypeOf<typeof updateRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof updateRequestWithoutResponse.response.status>().toEqualTypeOf<never>();
      expectTypeOf<typeof updateRequestWithoutResponse.response.body>().toEqualTypeOf<never>();

      updatePromise = fetch(`${baseURL}/users`, {
        method: 'PATCH',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      await expect(updatePromise).rejects.toThrowError();

      expect(updateRequestsWithoutResponse).toHaveLength(0);

      [updateRequestWithoutResponse] = updateRequestsWithoutResponse;
      expectTypeOf<typeof updateRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof updateRequestWithoutResponse.response.status>().toEqualTypeOf<never>();
      expectTypeOf<typeof updateRequestWithoutResponse.response.body>().toEqualTypeOf<never>();

      const updateTrackerWithResponse = updateTrackerWithoutResponse.respond({
        status: 201,
        body: users[0],
      });

      const updateResponse = await fetch(`${baseURL}/users`, {
        method: 'PATCH',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      expect(updateResponse.status).toBe(201);

      const fetchedUsers = (await updateResponse.json()) as User;
      expect(fetchedUsers).toEqual(users[0]);

      expect(updateRequestsWithoutResponse).toHaveLength(0);
      const updateRequestsWithResponse = updateTrackerWithResponse.requests();
      expect(updateRequestsWithResponse).toHaveLength(1);

      const [updateRequest] = updateRequestsWithResponse;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<User>();
      expect(updateRequest.body).toEqual<User>({ name: userName });

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<201>();
      expect(updateRequest.response.status).toEqual(201);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual<User>(users[0]);
    });
  });
}
