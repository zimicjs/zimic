import { expect, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import HttpRequestTracker from '../../../HttpRequestTracker';
import { HttpInterceptorClass } from '../../types/classes';

export function createHeadHttpInterceptorTests<InterceptorClass extends HttpInterceptorClass>(
  Interceptor: InterceptorClass,
) {
  const baseURL = 'http://localhost:3000';

  it('should support intercepting HEAD requests with a static response body', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const userListTracker = interceptor.head('/users').respond({
        status: 200,
      });
      expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

      const userListResponse = await fetch(`${baseURL}/users`, {
        method: 'HEAD',
      });
      expect(userListResponse.status).toBe(200);
    });
  });

  it('should support intercepting HEAD requests with a computed response body', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const userListTracker = interceptor.head('/users').respond(() => ({
        status: 200,
      }));
      expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

      const userListResponse = await fetch(`${baseURL}/users`, {
        method: 'HEAD',
      });
      expect(userListResponse.status).toBe(200);
    });
  });

  it('should not intercept a HEAD request without a registered response', async () => {
    const interceptor = new Interceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      let fetchPromise = fetch(`${baseURL}/users`, { method: 'HEAD' });
      await expect(fetchPromise).rejects.toThrowError();

      const userListTracker = interceptor.head('/users');
      expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

      fetchPromise = fetch(`${baseURL}/users`, { method: 'HEAD' });
      await expect(fetchPromise).rejects.toThrowError();

      userListTracker.respond({
        status: 200,
      });

      const userListResponse = await fetch(`${baseURL}/users`, {
        method: 'HEAD',
      });
      expect(userListResponse.status).toBe(200);
    });
  });
}
