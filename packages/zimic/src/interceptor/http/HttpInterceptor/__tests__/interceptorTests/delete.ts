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

      const userListTracker = interceptor.delete('/users').respond({
        status: 200,
        body: users[0],
      });
      expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

      const userListResponse = await fetch(`${baseURL}/users`, {
        method: 'DELETE',
      });
      expect(userListResponse.status).toBe(200);

      const fetchedUsers = (await userListResponse.json()) as User;
      expect(fetchedUsers).toEqual(users[0]);
    });
  });

  it('should support intercepting DELETE requests with a computed response body, based on request body', async () => {
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

      const userListTracker = interceptor.delete('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<User>();

        return {
          status: 200,
          body: {
            name: request.body.name,
          },
        };
      });
      expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

      const userName = 'User (other)';

      const userListResponse = await fetch(`${baseURL}/users`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      expect(userListResponse.status).toBe(200);

      const fetchedUsers = (await userListResponse.json()) as User;
      expect(fetchedUsers).toEqual<User>({ name: userName });
    });
  });

  it('should not intercept a DELETE request without a registered response', async () => {
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

      let fetchPromise = fetch(`${baseURL}/users`, { method: 'DELETE' });
      await expect(fetchPromise).rejects.toThrowError();

      const userListTracker = interceptor.delete('/users');
      expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

      fetchPromise = fetch(`${baseURL}/users`, { method: 'DELETE' });
      await expect(fetchPromise).rejects.toThrowError();

      userListTracker.respond({
        status: 200,
        body: users[0],
      });

      const userListResponse = await fetch(`${baseURL}/users`, {
        method: 'DELETE',
      });
      expect(userListResponse.status).toBe(200);

      const fetchedUsers = (await userListResponse.json()) as User;
      expect(fetchedUsers).toEqual(users[0]);
    });
  });
}
