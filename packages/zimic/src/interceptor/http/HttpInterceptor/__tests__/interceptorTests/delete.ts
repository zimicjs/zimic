import { expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import HttpRequestTracker from '../../../HttpRequestTracker';
import { HttpInterceptorClass } from '../../types/classes';

export function createDeleteHttpInterceptorTests<InterceptorClass extends HttpInterceptorClass>(
  Interceptor: InterceptorClass,
) {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  it('should support intercepting DELETE requests with a static response body', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        DELETE: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const deletionTracker = interceptor.delete('/users').respond({
        status: 200,
        body: users[0],
      });
      expect(deletionTracker).toBeInstanceOf(HttpRequestTracker);

      const deletionRequests = deletionTracker.requests();
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(`${baseURL}/users`, {
        method: 'DELETE',
      });
      expect(deletionResponse.status).toBe(200);

      const fetchedUsers = (await deletionResponse.json()) as User;
      expect(fetchedUsers).toEqual(users[0]);

      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<never>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[0]);
    });
  });

  it('should support intercepting DELETE requests with a computed response body, based on the request body', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        DELETE: {
          request: { body: User };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const deletionTracker = interceptor.delete('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<User>();

        return {
          status: 200,
          body: {
            name: request.body.name,
          },
        };
      });
      expect(deletionTracker).toBeInstanceOf(HttpRequestTracker);

      const deletionRequests = deletionTracker.requests();
      expect(deletionRequests).toHaveLength(0);

      const userName = 'User (other)';

      const deletionResponse = await fetch(`${baseURL}/users`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      expect(deletionResponse.status).toBe(200);

      const fetchedUsers = (await deletionResponse.json()) as User;
      expect(fetchedUsers).toEqual<User>({ name: userName });

      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<User>();
      expect(deletionRequest.body).toEqual<User>({ name: userName });

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual<User>({ name: userName });
    });
  });

  it('should not intercept a DELETE request without a registered response', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        DELETE: {
          request: { body: User };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const userName = 'User (other)';

      let deletionPromise = fetch(`${baseURL}/users`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      await expect(deletionPromise).rejects.toThrowError();

      const deletionTrackerWithoutResponse = interceptor.delete('/users');
      expect(deletionTrackerWithoutResponse).toBeInstanceOf(HttpRequestTracker);

      const deletionRequestsWithoutResponse = deletionTrackerWithoutResponse.requests();
      expect(deletionRequestsWithoutResponse).toHaveLength(0);

      let [deletionRequestWithoutResponse] = deletionRequestsWithoutResponse;
      expectTypeOf<typeof deletionRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof deletionRequestWithoutResponse.response.status>().toEqualTypeOf<never>();
      expectTypeOf<typeof deletionRequestWithoutResponse.response.body>().toEqualTypeOf<never>();

      deletionPromise = fetch(`${baseURL}/users`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      await expect(deletionPromise).rejects.toThrowError();

      expect(deletionRequestsWithoutResponse).toHaveLength(0);

      [deletionRequestWithoutResponse] = deletionRequestsWithoutResponse;
      expectTypeOf<typeof deletionRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof deletionRequestWithoutResponse.response.status>().toEqualTypeOf<never>();
      expectTypeOf<typeof deletionRequestWithoutResponse.response.body>().toEqualTypeOf<never>();

      const deletionTrackerWithResponse = deletionTrackerWithoutResponse.respond({
        status: 200,
        body: users[0],
      });

      const deletionResponse = await fetch(`${baseURL}/users`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      expect(deletionResponse.status).toBe(200);

      const fetchedUsers = (await deletionResponse.json()) as User;
      expect(fetchedUsers).toEqual(users[0]);

      expect(deletionRequestsWithoutResponse).toHaveLength(0);
      const deletionRequestsWithResponse = deletionTrackerWithResponse.requests();
      expect(deletionRequestsWithResponse).toHaveLength(1);

      const [deletionRequest] = deletionRequestsWithResponse;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<User>();
      expect(deletionRequest.body).toEqual<User>({ name: userName });

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual<User>(users[0]);
    });
  });
}
