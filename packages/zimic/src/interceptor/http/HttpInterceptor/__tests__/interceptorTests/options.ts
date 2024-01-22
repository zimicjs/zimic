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

      const optionsTracker = interceptor.options('/users').respond({
        status: 200,
      });
      expect(optionsTracker).toBeInstanceOf(HttpRequestTracker);

      const optionsRequests = optionsTracker.requests();
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(`${baseURL}/users`, {
        method: 'OPTIONS',
      });
      expect(optionsResponse.status).toBe(200);

      expect(optionsRequests).toHaveLength(1);
      const [optionsRequest] = optionsRequests;
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<never>();
      expect(optionsRequest.body).toBe(null);

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<200>();
      expect(optionsRequest.response.status).toEqual(200);

      expectTypeOf(optionsRequest.response.body).toEqualTypeOf<unknown>();
      expect(optionsRequest.response.body).toBe(null);
    });
  });

  it('should support intercepting OPTIONS requests with a computed response body', async () => {
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

      const optionsTracker = interceptor.options('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<Filters>();
        return {
          status: 200,
        };
      });
      expect(optionsTracker).toBeInstanceOf(HttpRequestTracker);

      const optionsRequests = optionsTracker.requests();
      expect(optionsRequests).toHaveLength(0);

      const userName = 'User (other)';

      const optionsResponse = await fetch(`${baseURL}/users`, {
        method: 'OPTIONS',
        body: JSON.stringify({ name: userName } satisfies Filters),
      });

      expect(optionsResponse.status).toBe(200);

      expect(optionsRequests).toHaveLength(1);
      const [optionsRequest] = optionsRequests;
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<Filters>();
      expect(optionsRequest.body).toEqual<Filters>({ name: userName });

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<200>();
      expect(optionsRequest.response.status).toEqual(200);

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<200>();
      expect(optionsRequest.response.status).toEqual(200);

      expectTypeOf(optionsRequest.response.body).toEqualTypeOf<unknown>();
      expect(optionsRequest.response.body).toBe(null);
    });
  });

  it('should not intercept a OPTIONS request without a registered response', async () => {
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

      const optionsTrackerWithoutResponse = interceptor.options('/users');
      expect(optionsTrackerWithoutResponse).toBeInstanceOf(HttpRequestTracker);

      const optionsRequestsWithoutResponse = optionsTrackerWithoutResponse.requests();
      expect(optionsRequestsWithoutResponse).toHaveLength(0);

      let [optionsRequestWithoutResponse] = optionsRequestsWithoutResponse;
      expectTypeOf<typeof optionsRequestWithoutResponse.body>().toEqualTypeOf<never>();
      expectTypeOf<typeof optionsRequestWithoutResponse.response.status>().toEqualTypeOf<never>();
      expectTypeOf<typeof optionsRequestWithoutResponse.response.body>().toEqualTypeOf<never>();

      fetchPromise = fetch(`${baseURL}/users`, { method: 'OPTIONS' });
      await expect(fetchPromise).rejects.toThrowError();

      expect(optionsRequestsWithoutResponse).toHaveLength(0);

      [optionsRequestWithoutResponse] = optionsRequestsWithoutResponse;
      expectTypeOf<typeof optionsRequestWithoutResponse.body>().toEqualTypeOf<never>();
      expectTypeOf<typeof optionsRequestWithoutResponse.response.status>().toEqualTypeOf<never>();
      expectTypeOf<typeof optionsRequestWithoutResponse.response.body>().toEqualTypeOf<never>();

      const optionsTrackerWithResponse = optionsTrackerWithoutResponse.respond({
        status: 200,
      });

      const optionsResponse = await fetch(`${baseURL}/users`, {
        method: 'OPTIONS',
      });
      expect(optionsResponse.status).toBe(200);

      expect(optionsRequestsWithoutResponse).toHaveLength(0);
      const optionsRequestsWithResponse = optionsTrackerWithResponse.requests();
      expect(optionsRequestsWithResponse).toHaveLength(1);

      const [optionsRequestWithResponse] = optionsRequestsWithResponse;
      expect(optionsRequestWithResponse).toBeInstanceOf(Request);
      expect(optionsRequestWithResponse.response.status).toEqual(200);

      expectTypeOf(optionsRequestWithResponse.body).toEqualTypeOf<never>();
      expect(optionsRequestWithResponse.body).toBe(null);

      expectTypeOf(optionsRequestWithResponse.response.status).toEqualTypeOf<200>();
      expect(optionsRequestWithResponse.response.status).toEqual(200);

      expectTypeOf(optionsRequestWithResponse.response.body).toEqualTypeOf<unknown>();
      expect(optionsRequestWithResponse.response.body).toBe(null);
    });
  });
}
