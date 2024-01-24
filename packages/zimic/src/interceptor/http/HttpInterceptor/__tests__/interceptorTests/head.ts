import { expect, expectTypeOf, it } from 'vitest';

import HttpRequestTracker from '@/interceptor/http/HttpRequestTracker';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

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
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<200>();
      expect(headRequest.response.status).toEqual(200);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<unknown>();
      expect(headRequest.response.body).toBe(null);
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
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<200>();
      expect(headRequest.response.status).toEqual(200);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<200>();
      expect(headRequest.response.status).toEqual(200);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<unknown>();
      expect(headRequest.response.body).toBe(null);
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
      expect(headRequestWithResponse.body).toBe(null);

      expectTypeOf(headRequestWithResponse.response.status).toEqualTypeOf<200>();
      expect(headRequestWithResponse.response.status).toEqual(200);

      expectTypeOf(headRequestWithResponse.response.body).toEqualTypeOf<unknown>();
      expect(headRequestWithResponse.response.body).toBe(null);
    });
  });

  it('should consider only the last declared response when intercepting HEAD requests', async () => {
    interface ServerErrorResponseBody {
      message: string;
    }

    const interceptor = new Interceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
            204: {};
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const headTracker = interceptor
        .head('/users')
        .respond({
          status: 200,
        })
        .respond({
          status: 204,
        });
      expect(headTracker).toBeInstanceOf(HttpRequestTracker);

      const headRequests = headTracker.requests();
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(`${baseURL}/users`, {
        method: 'HEAD',
      });
      expect(headResponse.status).toBe(204);

      expect(headRequests).toHaveLength(1);
      const [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.body).toEqualTypeOf<never>();
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<204>();
      expect(headRequest.response.status).toEqual(204);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<unknown>();
      expect(headRequest.response.body).toBe(null);

      const otherHeadTracker = interceptor.head('/users').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const otherHeadRequests = otherHeadTracker.requests();
      expect(otherHeadRequests).toHaveLength(0);

      const otherHeadResponse = await fetch(`${baseURL}/users`, {
        method: 'HEAD',
      });
      expect(otherHeadResponse.status).toBe(500);

      const serverError = (await otherHeadResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      expect(otherHeadRequests).toHaveLength(1);
      const [otherHeadRequest] = otherHeadRequests;
      expect(otherHeadRequest).toBeInstanceOf(Request);

      expectTypeOf(otherHeadRequest.body).toEqualTypeOf<never>();
      expect(otherHeadRequest.body).toBe(null);

      expectTypeOf(otherHeadRequest.response.status).toEqualTypeOf<500>();
      expect(otherHeadRequest.response.status).toEqual(500);

      expectTypeOf(otherHeadRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(otherHeadRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });
    });
  });
}
