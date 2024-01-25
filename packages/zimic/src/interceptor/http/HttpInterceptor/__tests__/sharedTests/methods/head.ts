import { expect, expectTypeOf, it } from 'vitest';

import HttpRequestTracker from '@/interceptor/http/HttpRequestTracker';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import HttpInterceptor from '../../../HttpInterceptor';
import { HttpInterceptorOptions } from '../../../types/options';
import { HttpInterceptorSchema } from '../../../types/schema';

export function declareHeadHttpInterceptorTests(
  createInterceptor: <Schema extends HttpInterceptorSchema>(options: HttpInterceptorOptions) => HttpInterceptor<Schema>,
) {
  const baseURL = 'http://localhost:3000';

  it('should support intercepting HEAD requests with a static response body', async () => {
    const interceptor = createInterceptor<{
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

      const headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
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
    const interceptor = createInterceptor<{
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

      const headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
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

  it('should support intercepting HEAD requests with a dynamic route', async () => {
    const interceptor = createInterceptor<{
      '/users/:id': {
        HEAD: {
          response: {
            200: {};
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const genericHeadTracker = interceptor.head('/users/:id').respond({
        status: 200,
      });
      expect(genericHeadTracker).toBeInstanceOf(HttpRequestTracker);

      const genericHeadRequests = genericHeadTracker.requests();
      expect(genericHeadRequests).toHaveLength(0);

      const genericHeadResponse = await fetch(`${baseURL}/users/${1}`, { method: 'HEAD' });
      expect(genericHeadResponse.status).toBe(200);

      expect(genericHeadRequests).toHaveLength(1);
      const [genericHeadRequest] = genericHeadRequests;
      expect(genericHeadRequest).toBeInstanceOf(Request);

      expectTypeOf(genericHeadRequest.body).toEqualTypeOf<never>();
      expect(genericHeadRequest.body).toBe(null);

      expectTypeOf(genericHeadRequest.response.status).toEqualTypeOf<200>();
      expect(genericHeadRequest.response.status).toEqual(200);

      expectTypeOf(genericHeadRequest.response.body).toEqualTypeOf<unknown>();
      expect(genericHeadRequest.response.body).toBe(null);

      genericHeadTracker.bypass();

      const specificHeadTracker = interceptor.head<'/users/:id'>(`/users/${1}`).respond({
        status: 200,
      });
      expect(specificHeadTracker).toBeInstanceOf(HttpRequestTracker);

      const specificHeadRequests = specificHeadTracker.requests();
      expect(specificHeadRequests).toHaveLength(0);

      const specificHeadResponse = await fetch(`${baseURL}/users/${1}`, { method: 'HEAD' });
      expect(specificHeadResponse.status).toBe(200);

      expect(specificHeadRequests).toHaveLength(1);
      const [specificHeadRequest] = specificHeadRequests;
      expect(specificHeadRequest).toBeInstanceOf(Request);

      expectTypeOf(specificHeadRequest.body).toEqualTypeOf<never>();
      expect(specificHeadRequest.body).toBe(null);

      expectTypeOf(specificHeadRequest.response.status).toEqualTypeOf<200>();
      expect(specificHeadRequest.response.status).toEqual(200);

      expectTypeOf(specificHeadRequest.response.body).toEqualTypeOf<unknown>();
      expect(specificHeadRequest.response.body).toBe(null);

      const unmatchedHeadPromise = fetch(`${baseURL}/users/${2}`, { method: 'HEAD' });
      await expect(unmatchedHeadPromise).rejects.toThrowError();
    });
  });

  it('should not intercept a HEAD request without a registered response', async () => {
    const interceptor = createInterceptor<{
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

      const headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
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

    const interceptor = createInterceptor<{
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

      const headRequests = headTracker.requests();
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
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

      const errorHeadTracker = interceptor.head('/users').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const errorHeadRequests = errorHeadTracker.requests();
      expect(errorHeadRequests).toHaveLength(0);

      const otherHeadResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
      expect(otherHeadResponse.status).toBe(500);

      const serverError = (await otherHeadResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      expect(headRequests).toHaveLength(1);

      expect(errorHeadRequests).toHaveLength(1);
      const [errorHeadRequest] = errorHeadRequests;
      expect(errorHeadRequest).toBeInstanceOf(Request);

      expectTypeOf(errorHeadRequest.body).toEqualTypeOf<never>();
      expect(errorHeadRequest.body).toBe(null);

      expectTypeOf(errorHeadRequest.response.status).toEqualTypeOf<500>();
      expect(errorHeadRequest.response.status).toEqual(500);

      expectTypeOf(errorHeadRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorHeadRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });
    });
  });

  it('should ignore trackers with bypassed responses when intercepting HEAD requests', async () => {
    interface ServerErrorResponseBody {
      message: string;
    }

    const interceptor = createInterceptor<{
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
        .bypass();

      const initialHeadRequests = headTracker.requests();
      expect(initialHeadRequests).toHaveLength(0);

      const headPromise = fetch(`${baseURL}/users`, { method: 'HEAD' });
      await expect(headPromise).rejects.toThrowError();

      const noContentHeadTracker = headTracker.respond({
        status: 204,
      });

      expect(initialHeadRequests).toHaveLength(0);
      const headRequests = noContentHeadTracker.requests();
      expect(headRequests).toHaveLength(0);

      let headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
      expect(headResponse.status).toBe(204);

      expect(headRequests).toHaveLength(1);
      let [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.body).toEqualTypeOf<never>();
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.body).toEqualTypeOf<never>();
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<204>();
      expect(headRequest.response.status).toEqual(204);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<unknown>();
      expect(headRequest.response.body).toBe(null);

      const errorHeadTracker = interceptor.head('/users').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const errorHeadRequests = errorHeadTracker.requests();
      expect(errorHeadRequests).toHaveLength(0);

      const otherHeadResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
      expect(otherHeadResponse.status).toBe(500);

      const serverError = (await otherHeadResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      expect(headRequests).toHaveLength(1);

      expect(errorHeadRequests).toHaveLength(1);
      const [errorHeadRequest] = errorHeadRequests;
      expect(errorHeadRequest).toBeInstanceOf(Request);

      expectTypeOf(errorHeadRequest.body).toEqualTypeOf<never>();
      expect(errorHeadRequest.body).toBe(null);

      expectTypeOf(errorHeadRequest.response.status).toEqualTypeOf<500>();
      expect(errorHeadRequest.response.status).toEqual(500);

      expectTypeOf(errorHeadRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorHeadRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      errorHeadTracker.bypass();

      headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
      expect(headResponse.status).toBe(204);

      expect(errorHeadRequests).toHaveLength(1);

      expect(headRequests).toHaveLength(2);
      [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.body).toEqualTypeOf<never>();
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.body).toEqualTypeOf<never>();
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<204>();
      expect(headRequest.response.status).toEqual(204);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<unknown>();
      expect(headRequest.response.body).toBe(null);
    });
  });
}
