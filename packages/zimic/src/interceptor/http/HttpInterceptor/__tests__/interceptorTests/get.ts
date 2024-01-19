import { expect, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import HttpRequestTracker from '../../../HttpRequestTracker';
import { HttpInterceptorClass } from '../../types/classes';

export function createGetHttpInterceptorTests<InterceptorClass extends HttpInterceptorClass>(
  Interceptor: InterceptorClass,
) {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  it.only('should support intercepting GET requests with a static response body', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const userListTracker = interceptor.get('/users').respond({
        status: 200,
        body: users[0],
      });
      expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

      const userListResponse = await fetch(`${baseURL}/users`, {
        method: 'GET',
      });
      expect(userListResponse.status).toBe(200);

      const fetchedUsers = (await userListResponse.json()) as User;
      expect(fetchedUsers).toEqual(users[0]);
    });
  });

  it('should support intercepting GET requests with a computed response body', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      const userName = `User (other ${Math.random()})`;

      await interceptor.start();

      const userListTracker = interceptor.get('/users').respond(() => ({
        status: 200,
        body: { name: userName },
      }));
      expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

      const userListResponse = await fetch(`${baseURL}/users`, {
        method: 'GET',
      });
      expect(userListResponse.status).toBe(200);

      const fetchedUsers = (await userListResponse.json()) as User;
      expect(fetchedUsers).toEqual<User>({ name: userName });
    });
  });

  it('should not intercept a GET request without a registered response', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      let fetchPromise = fetch(`${baseURL}/users`, { method: 'GET' });
      await expect(fetchPromise).rejects.toThrowError();

      const userListTracker = interceptor.get('/users');
      expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

      fetchPromise = fetch(`${baseURL}/users`, { method: 'GET' });
      await expect(fetchPromise).rejects.toThrowError();

      userListTracker.respond({
        status: 200,
        body: users[0],
      });

      const userListResponse = await fetch(`${baseURL}/users`, {
        method: 'GET',
      });
      expect(userListResponse.status).toBe(200);

      const fetchedUsers = (await userListResponse.json()) as User;
      expect(fetchedUsers).toEqual(users[0]);
    });
  });
}
