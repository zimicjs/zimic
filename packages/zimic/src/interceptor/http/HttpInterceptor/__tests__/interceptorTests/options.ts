import { expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import HttpRequestTracker from '../../../HttpRequestTracker';
import { HttpInterceptorClass } from '../../types/classes';

export function createOptionsHttpInterceptorTests<InterceptorClass extends HttpInterceptorClass>(
  Interceptor: InterceptorClass,
) {
  const baseURL = 'http://localhost:3000';

  interface Filters {
    name: string;
  }

  it('should support intercepting OPTIONS requests with a static response body', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        OPTIONS: {
          response: {
            200: {};
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const userListTracker = interceptor.options('/users').respond({
        status: 200,
      });
      expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

      const userListResponse = await fetch(`${baseURL}/users`, {
        method: 'OPTIONS',
      });
      expect(userListResponse.status).toBe(200);
    });
  });

  it('should support intercepting OPTIONS requests with a computed response body, based on request body', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        OPTIONS: {
          request: { body: Filters };
          response: {
            200: {};
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const userListTracker = interceptor.options('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<Filters>();
        return {
          status: 200,
        };
      });
      expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

      const userName = 'User (other)';

      const userListResponse = await fetch(`${baseURL}/users`, {
        method: 'OPTIONS',
        body: JSON.stringify({ name: userName } satisfies Filters),
      });
      expect(userListResponse.status).toBe(200);
    });
  });

  it('should not intercept an OPTIONS request without a registered response', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        OPTIONS: {
          response: {
            200: {};
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      let fetchPromise = fetch(`${baseURL}/users`, { method: 'OPTIONS' });
      await expect(fetchPromise).rejects.toThrowError();

      const userListTracker = interceptor.options('/users');
      expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

      fetchPromise = fetch(`${baseURL}/users`, { method: 'OPTIONS' });
      await expect(fetchPromise).rejects.toThrowError();

      userListTracker.respond({
        status: 200,
      });

      const userListResponse = await fetch(`${baseURL}/users`, {
        method: 'OPTIONS',
      });
      expect(userListResponse.status).toBe(200);
    });
  });
}
