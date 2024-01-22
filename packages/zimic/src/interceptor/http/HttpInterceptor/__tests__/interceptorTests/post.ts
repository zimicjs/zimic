import { expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import HttpRequestTracker from '../../../HttpRequestTracker';
import { HttpInterceptorClass } from '../../types/classes';

export function createPostHttpInterceptorTests<InterceptorClass extends HttpInterceptorClass>(
  Interceptor: InterceptorClass,
) {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  it('should support intercepting POST requests with a static response body', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        POST: {
          response: {
            201: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const creationTracker = interceptor.post('/users').respond({
        status: 201,
        body: users[0],
      });
      expect(creationTracker).toBeInstanceOf(HttpRequestTracker);

      const creationRequests = creationTracker.requests();
      expect(creationRequests).toHaveLength(0);

      const creationResponse = await fetch(`${baseURL}/users`, {
        method: 'POST',
      });
      expect(creationResponse.status).toBe(201);

      const fetchedUsers = (await creationResponse.json()) as User;
      expect(fetchedUsers).toEqual(users[0]);

      expect(creationRequests).toHaveLength(1);
      const [creationRequest] = creationRequests;
      expect(creationRequest).toBeInstanceOf(Request);

      expectTypeOf(creationRequest.body).toEqualTypeOf<never>();
      expect(creationRequest.body).toBe(undefined);

      expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
      expect(creationRequest.response.status).toEqual(201);

      expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
      expect(creationRequest.response.body).toEqual(users[0]);
    });
  });

  it('should support intercepting POST requests with a computed response body, based on the request body', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        POST: {
          request: { body: User };
          response: {
            201: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const creationTracker = interceptor.post('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<User>();

        return {
          status: 201,
          body: {
            name: request.body.name,
          },
        };
      });
      expect(creationTracker).toBeInstanceOf(HttpRequestTracker);

      const creationRequests = creationTracker.requests();
      expect(creationRequests).toHaveLength(0);

      const userName = 'User (other)';

      const creationResponse = await fetch(`${baseURL}/users`, {
        method: 'POST',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      expect(creationResponse.status).toBe(201);

      const fetchedUsers = (await creationResponse.json()) as User;
      expect(fetchedUsers).toEqual<User>({ name: userName });

      expect(creationRequests).toHaveLength(1);
      const [creationRequest] = creationRequests;
      expect(creationRequest).toBeInstanceOf(Request);

      expectTypeOf(creationRequest.body).toEqualTypeOf<User>();
      expect(creationRequest.body).toEqual<User>({ name: userName });

      expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
      expect(creationRequest.response.status).toEqual(201);

      expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
      expect(creationRequest.response.body).toEqual<User>({ name: userName });
    });
  });

  it('should not intercept a POST request without a registered response', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        POST: {
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

      let creationPromise = fetch(`${baseURL}/users`, {
        method: 'POST',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      await expect(creationPromise).rejects.toThrowError();

      const creationTrackerWithoutResponse = interceptor.post('/users');
      expect(creationTrackerWithoutResponse).toBeInstanceOf(HttpRequestTracker);

      const creationRequestsWithoutResponse = creationTrackerWithoutResponse.requests();
      expect(creationRequestsWithoutResponse).toHaveLength(0);

      let [creationRequestWithoutResponse] = creationRequestsWithoutResponse;
      expectTypeOf<typeof creationRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof creationRequestWithoutResponse.response.status>().toEqualTypeOf<never>();
      expectTypeOf<typeof creationRequestWithoutResponse.response.body>().toEqualTypeOf<never>();

      creationPromise = fetch(`${baseURL}/users`, {
        method: 'POST',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      await expect(creationPromise).rejects.toThrowError();

      expect(creationRequestsWithoutResponse).toHaveLength(0);

      [creationRequestWithoutResponse] = creationRequestsWithoutResponse;
      expectTypeOf<typeof creationRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof creationRequestWithoutResponse.response.status>().toEqualTypeOf<never>();
      expectTypeOf<typeof creationRequestWithoutResponse.response.body>().toEqualTypeOf<never>();

      const creationTrackerWithResponse = creationTrackerWithoutResponse.respond({
        status: 201,
        body: users[0],
      });

      const creationResponse = await fetch(`${baseURL}/users`, {
        method: 'POST',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      expect(creationResponse.status).toBe(201);

      const fetchedUsers = (await creationResponse.json()) as User;
      expect(fetchedUsers).toEqual(users[0]);

      expect(creationRequestsWithoutResponse).toHaveLength(0);
      const creationRequestsWithResponse = creationTrackerWithResponse.requests();
      expect(creationRequestsWithResponse).toHaveLength(1);

      const [creationRequest] = creationRequestsWithResponse;
      expect(creationRequest).toBeInstanceOf(Request);

      expectTypeOf(creationRequest.body).toEqualTypeOf<User>();
      expect(creationRequest.body).toEqual<User>({ name: userName });

      expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
      expect(creationRequest.response.status).toEqual(201);

      expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
      expect(creationRequest.response.body).toEqual<User>(users[0]);
    });
  });
}
