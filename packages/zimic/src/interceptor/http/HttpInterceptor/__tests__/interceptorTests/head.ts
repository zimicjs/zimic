import { expect, expectTypeOf, it } from 'vitest';

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

      const headTracker = interceptor.head('/users').respond({
        status: 200,
      });
      expect(headTracker).toBeInstanceOf(HttpRequestTracker);

      const headRequests = headTracker.requests();
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(`${baseURL}/users`, {
        method: 'HEAD',
      });
      expect(headResponse.status).toBe(200);

      expect(headRequests).toHaveLength(1);
      const [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.body).toEqualTypeOf<never>();
      expect(headRequest.body).toBe(undefined);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<200>();
      expect(headRequest.response.status).toEqual(200);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<unknown>();
      expect(headRequest.response.body).toBe(undefined);
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

      const headTracker = interceptor.head('/users').respond(() => ({
        status: 200,
      }));
      expect(headTracker).toBeInstanceOf(HttpRequestTracker);

      const headRequests = headTracker.requests();
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(`${baseURL}/users`, {
        method: 'HEAD',
      });
      expect(headResponse.status).toBe(200);

      expect(headRequests).toHaveLength(1);
      const [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.body).toEqualTypeOf<never>();
      expect(headRequest.body).toBe(undefined);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<200>();
      expect(headRequest.response.status).toEqual(200);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<200>();
      expect(headRequest.response.status).toEqual(200);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<unknown>();
      expect(headRequest.response.body).toBe(undefined);
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

      const headTrackerWithoutResponse = interceptor.head('/users');
      expect(headTrackerWithoutResponse).toBeInstanceOf(HttpRequestTracker);

      const headRequestsWithoutResponse = headTrackerWithoutResponse.requests();
      expect(headRequestsWithoutResponse).toHaveLength(0);

      let [headRequestWithoutResponse] = headRequestsWithoutResponse;
      expectTypeOf<typeof headRequestWithoutResponse.body>().toEqualTypeOf<never>();
      expectTypeOf<typeof headRequestWithoutResponse.response.status>().toEqualTypeOf<never>();
      expectTypeOf<typeof headRequestWithoutResponse.response.body>().toEqualTypeOf<never>();

      fetchPromise = fetch(`${baseURL}/users`, { method: 'HEAD' });
      await expect(fetchPromise).rejects.toThrowError();

      expect(headRequestsWithoutResponse).toHaveLength(0);

      [headRequestWithoutResponse] = headRequestsWithoutResponse;
      expectTypeOf<typeof headRequestWithoutResponse.body>().toEqualTypeOf<never>();
      expectTypeOf<typeof headRequestWithoutResponse.response.status>().toEqualTypeOf<never>();
      expectTypeOf<typeof headRequestWithoutResponse.response.body>().toEqualTypeOf<never>();

      const headTrackerWithResponse = headTrackerWithoutResponse.respond({
        status: 200,
      });

      const headResponse = await fetch(`${baseURL}/users`, {
        method: 'HEAD',
      });
      expect(headResponse.status).toBe(200);

      expect(headRequestsWithoutResponse).toHaveLength(0);
      const headRequestsWithResponse = headTrackerWithResponse.requests();
      expect(headRequestsWithResponse).toHaveLength(1);

      const [headRequestWithResponse] = headRequestsWithResponse;
      expect(headRequestWithResponse).toBeInstanceOf(Request);
      expect(headRequestWithResponse.response.status).toEqual(200);

      expectTypeOf(headRequestWithResponse.body).toEqualTypeOf<never>();
      expect(headRequestWithResponse.body).toBe(undefined);

      expectTypeOf(headRequestWithResponse.response.status).toEqualTypeOf<200>();
      expect(headRequestWithResponse.response.status).toEqual(200);

      expectTypeOf(headRequestWithResponse.response.body).toEqualTypeOf<unknown>();
      expect(headRequestWithResponse.response.body).toBe(undefined);
    });
  });
}
