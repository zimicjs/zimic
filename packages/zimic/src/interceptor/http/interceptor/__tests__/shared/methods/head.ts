import { expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestTracker from '@/interceptor/http/requestTracker/LocalHttpRequestTracker';
import { JSONValue } from '@/types/json';
import { expectToThrowFetchError } from '@tests/utils/fetch';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { RuntimeSharedHttpInterceptorTestsOptions } from '../interceptorTests';

export function declareHeadHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { baseURL, worker, interceptorOptions } = options;

  it('should support intercepting HEAD requests with a static response body', async () => {
    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const headTracker = await promiseIfRemote(
        interceptor.head('/users').respond({
          status: 200,
        }),
        worker,
      );
      expect(headTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(1);
      const [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.body).toEqualTypeOf<null>();
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<200>();
      expect(headRequest.response.status).toEqual(200);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<null>();
      expect(headRequest.response.body).toBe(null);
    });
  });

  it('should support intercepting HEAD requests with a computed response body', async () => {
    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const headTracker = await promiseIfRemote(
        interceptor.head('/users').respond(() => ({
          status: 200,
        })),
        worker,
      );
      expect(headTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(1);
      const [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.body).toEqualTypeOf<null>();
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<200>();
      expect(headRequest.response.status).toEqual(200);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<200>();
      expect(headRequest.response.status).toEqual(200);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<null>();
      expect(headRequest.response.body).toBe(null);
    });
  });

  it('should support intercepting HEAD requests having headers', async () => {
    type UserHeadRequestHeaders = HttpSchema.Headers<{
      accept?: string;
    }>;
    type UserHeadResponseHeaders = HttpSchema.Headers<{
      'content-type'?: `application/${string}`;
      'cache-control'?: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          request: {
            headers: UserHeadRequestHeaders;
          };
          response: {
            200: {
              headers: UserHeadResponseHeaders;
            };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const headTracker = await promiseIfRemote(
        interceptor.head('/users').respond((request) => {
          expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserHeadRequestHeaders>>();
          expect(request.headers).toBeInstanceOf(HttpHeaders);

          const acceptHeader = request.headers.get('accept')!;
          expect(acceptHeader).toBe('application/json');

          return {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'cache-control': 'no-cache',
            },
          };
        }),
        worker,
      );
      expect(headTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(`${baseURL}/users`, {
        method: 'HEAD',
        headers: {
          accept: 'application/json',
        } satisfies UserHeadRequestHeaders,
      });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(1);
      const [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.headers).toEqualTypeOf<HttpHeaders<UserHeadRequestHeaders>>();
      expect(headRequest.headers).toBeInstanceOf(HttpHeaders);
      expect(headRequest.headers.get('accept')).toBe('application/json');

      expectTypeOf(headRequest.response.headers).toEqualTypeOf<HttpHeaders<UserHeadResponseHeaders>>();
      expect(headRequest.response.headers).toBeInstanceOf(HttpHeaders);
      expect(headRequest.response.headers.get('content-type')).toBe('application/json');
      expect(headRequest.response.headers.get('cache-control')).toBe('no-cache');
    });
  });

  it('should support intercepting HEAD requests having search params', async () => {
    type UserHeadSearchParams = HttpSchema.SearchParams<{
      tag?: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          request: {
            searchParams: UserHeadSearchParams;
          };
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const headTracker = await promiseIfRemote(
        interceptor.head('/users').respond((request) => {
          expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserHeadSearchParams>>();
          expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

          return {
            status: 200,
          };
        }),
        worker,
      );
      expect(headTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserHeadSearchParams>({
        tag: 'admin',
      });

      const headResponse = await fetch(`${baseURL}/users?${searchParams.toString()}`, { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(1);
      const [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.searchParams).toEqualTypeOf<HttpSearchParams<UserHeadSearchParams>>();
      expect(headRequest.searchParams).toBeInstanceOf(HttpSearchParams);
      expect(headRequest.searchParams).toEqual(searchParams);
      expect(headRequest.searchParams.get('tag')).toBe('admin');
    });
  });

  it('should support intercepting HEAD requests having headers restrictions', async () => {
    type UserHeadHeaders = HttpSchema.Headers<{
      'content-type'?: string;
      accept?: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          request: {
            headers: UserHeadHeaders;
          };
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const headTracker = interceptor
        .head('/users')
        .with({
          headers: { 'content-type': 'application/json' },
        })
        .with((request) => {
          expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserHeadHeaders>>();
          expect(request.headers).toBeInstanceOf(HttpHeaders);

          return request.headers.get('accept')?.includes('application/json') ?? false;
        })
        .respond((request) => {
          expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserHeadHeaders>>();
          expect(request.headers).toBeInstanceOf(HttpHeaders);

          return {
            status: 200,
          };
        });
      expect(headTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(0);

      const headers = new HttpHeaders<UserHeadHeaders>({
        'content-type': 'application/json',
        accept: 'application/json',
      });

      let headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD', headers });
      expect(headResponse.status).toBe(200);
      headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(1);

      headers.append('accept', 'application/xml');

      headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD', headers });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(2);

      headers.delete('accept');

      let headResponsePromise = fetch(`${baseURL}/users`, { method: 'HEAD', headers });
      await expectToThrowFetchError(headResponsePromise);

      headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(2);

      headers.set('accept', 'application/json');
      headers.set('content-type', 'text/plain');

      headResponsePromise = fetch(`${baseURL}/users`, { method: 'HEAD', headers });
      await expectToThrowFetchError(headResponsePromise);

      headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(2);
    });
  });

  it('should support intercepting HEAD requests having search params restrictions', async () => {
    type UserHeadSearchParams = HttpSchema.SearchParams<{
      tag?: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          request: {
            searchParams: UserHeadSearchParams;
          };
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const headTracker = interceptor
        .head('/users')
        .with({
          searchParams: { tag: 'admin' },
        })
        .respond((request) => {
          expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserHeadSearchParams>>();
          expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

          return {
            status: 200,
          };
        });
      expect(headTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserHeadSearchParams>({
        tag: 'admin',
      });

      const headResponse = await fetch(`${baseURL}/users?${searchParams.toString()}`, { method: 'HEAD' });
      expect(headResponse.status).toBe(200);
      headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(1);

      searchParams.delete('tag');

      const headResponsePromise = fetch(`${baseURL}/users?${searchParams.toString()}`, { method: 'HEAD' });
      await expectToThrowFetchError(headResponsePromise);
      headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(1);
    });
  });

  it('should support intercepting HEAD requests with a dynamic path', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        HEAD: {
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const genericHeadTracker = await promiseIfRemote(
        interceptor.head('/users/:id').respond({
          status: 200,
        }),
        worker,
      );
      expect(genericHeadTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let genericHeadRequests = await promiseIfRemote(genericHeadTracker.requests(), worker);
      expect(genericHeadRequests).toHaveLength(0);

      const genericHeadResponse = await fetch(`${baseURL}/users/${1}`, { method: 'HEAD' });
      expect(genericHeadResponse.status).toBe(200);

      genericHeadRequests = await promiseIfRemote(genericHeadTracker.requests(), worker);
      expect(genericHeadRequests).toHaveLength(1);
      const [genericHeadRequest] = genericHeadRequests;
      expect(genericHeadRequest).toBeInstanceOf(Request);

      expectTypeOf(genericHeadRequest.body).toEqualTypeOf<null>();
      expect(genericHeadRequest.body).toBe(null);

      expectTypeOf(genericHeadRequest.response.status).toEqualTypeOf<200>();
      expect(genericHeadRequest.response.status).toEqual(200);

      expectTypeOf(genericHeadRequest.response.body).toEqualTypeOf<null>();
      expect(genericHeadRequest.response.body).toBe(null);

      await promiseIfRemote(genericHeadTracker.bypass(), worker);

      const specificHeadTracker = await promiseIfRemote(
        interceptor.head(`/users/${1}`).respond({
          status: 200,
        }),
        worker,
      );
      expect(specificHeadTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let specificHeadRequests = await promiseIfRemote(specificHeadTracker.requests(), worker);
      expect(specificHeadRequests).toHaveLength(0);

      const specificHeadResponse = await fetch(`${baseURL}/users/${1}`, { method: 'HEAD' });
      expect(specificHeadResponse.status).toBe(200);

      specificHeadRequests = await promiseIfRemote(specificHeadTracker.requests(), worker);
      expect(specificHeadRequests).toHaveLength(1);
      const [specificHeadRequest] = specificHeadRequests;
      expect(specificHeadRequest).toBeInstanceOf(Request);

      expectTypeOf(specificHeadRequest.body).toEqualTypeOf<null>();
      expect(specificHeadRequest.body).toBe(null);

      expectTypeOf(specificHeadRequest.response.status).toEqualTypeOf<200>();
      expect(specificHeadRequest.response.status).toEqual(200);

      expectTypeOf(specificHeadRequest.response.body).toEqualTypeOf<null>();
      expect(specificHeadRequest.response.body).toBe(null);

      const unmatchedHeadPromise = fetch(`${baseURL}/users/${2}`, { method: 'HEAD' });
      await expectToThrowFetchError(unmatchedHeadPromise);
    });
  });

  it('should not intercept a HEAD request without a registered response', async () => {
    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      let fetchPromise = fetch(`${baseURL}/users`, { method: 'HEAD' });
      await expectToThrowFetchError(fetchPromise);

      const headTrackerWithoutResponse = await promiseIfRemote(interceptor.head('/users'), worker);
      expect(headTrackerWithoutResponse).toBeInstanceOf(LocalHttpRequestTracker);

      let headRequestsWithoutResponse = await promiseIfRemote(headTrackerWithoutResponse.requests(), worker);
      expect(headRequestsWithoutResponse).toHaveLength(0);

      let [headRequestWithoutResponse] = headRequestsWithoutResponse;
      expectTypeOf<typeof headRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof headRequestWithoutResponse.response>().toEqualTypeOf<never>();

      fetchPromise = fetch(`${baseURL}/users`, { method: 'HEAD' });
      await expectToThrowFetchError(fetchPromise);

      headRequestsWithoutResponse = await promiseIfRemote(headTrackerWithoutResponse.requests(), worker);
      expect(headRequestsWithoutResponse).toHaveLength(0);

      [headRequestWithoutResponse] = headRequestsWithoutResponse;
      expectTypeOf<typeof headRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof headRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const headTrackerWithResponse = headTrackerWithoutResponse.respond({
        status: 200,
      });

      const headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      expect(headRequestsWithoutResponse).toHaveLength(0);
      const headRequestsWithResponse = await promiseIfRemote(headTrackerWithResponse.requests(), worker);
      expect(headRequestsWithResponse).toHaveLength(1);

      const [headRequestWithResponse] = headRequestsWithResponse;
      expect(headRequestWithResponse).toBeInstanceOf(Request);
      expect(headRequestWithResponse.response.status).toEqual(200);

      expectTypeOf(headRequestWithResponse.body).toEqualTypeOf<null>();
      expect(headRequestWithResponse.body).toBe(null);

      expectTypeOf(headRequestWithResponse.response.status).toEqualTypeOf<200>();
      expect(headRequestWithResponse.response.status).toEqual(200);

      expectTypeOf(headRequestWithResponse.response.body).toEqualTypeOf<null>();
      expect(headRequestWithResponse.response.body).toBe(null);
    });
  });

  it('should consider only the last declared response when intercepting HEAD requests', async () => {
    type ServerErrorResponseBody = JSONValue<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
            204: {};
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const headTracker = await promiseIfRemote(
        interceptor
          .head('/users')
          .respond({
            status: 200,
          })
          .respond({
            status: 204,
          }),
        worker,
      );

      let headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
      expect(headResponse.status).toBe(204);

      headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(1);
      const [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.body).toEqualTypeOf<null>();
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<204>();
      expect(headRequest.response.status).toEqual(204);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<null>();
      expect(headRequest.response.body).toBe(null);

      const errorHeadTracker = await promiseIfRemote(
        interceptor.head('/users').respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        worker,
      );

      let errorHeadRequests = await promiseIfRemote(errorHeadTracker.requests(), worker);
      expect(errorHeadRequests).toHaveLength(0);

      const otherHeadResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
      expect(otherHeadResponse.status).toBe(500);

      const serverError = (await otherHeadResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      headRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(headRequests).toHaveLength(1);

      errorHeadRequests = await promiseIfRemote(errorHeadTracker.requests(), worker);
      expect(errorHeadRequests).toHaveLength(1);
      const [errorHeadRequest] = errorHeadRequests;
      expect(errorHeadRequest).toBeInstanceOf(Request);

      expectTypeOf(errorHeadRequest.body).toEqualTypeOf<null>();
      expect(errorHeadRequest.body).toBe(null);

      expectTypeOf(errorHeadRequest.response.status).toEqualTypeOf<500>();
      expect(errorHeadRequest.response.status).toEqual(500);

      expectTypeOf(errorHeadRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorHeadRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });
    });
  });

  it('should ignore trackers with bypassed responses when intercepting HEAD requests', async () => {
    type ServerErrorResponseBody = JSONValue<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
            204: {};
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const headTracker = await promiseIfRemote(
        interceptor
          .head('/users')
          .respond({
            status: 200,
          })
          .bypass(),
        worker,
      );

      let initialHeadRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(initialHeadRequests).toHaveLength(0);

      const headPromise = fetch(`${baseURL}/users`, { method: 'HEAD' });
      await expectToThrowFetchError(headPromise);

      const noContentHeadTracker = await promiseIfRemote(
        headTracker.respond({
          status: 204,
        }),
        worker,
      );

      initialHeadRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(initialHeadRequests).toHaveLength(0);
      let headRequests = await promiseIfRemote(noContentHeadTracker.requests(), worker);
      expect(headRequests).toHaveLength(0);

      let headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
      expect(headResponse.status).toBe(204);

      headRequests = await promiseIfRemote(noContentHeadTracker.requests(), worker);
      expect(headRequests).toHaveLength(1);
      let [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.body).toEqualTypeOf<null>();
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<204>();
      expect(headRequest.response.status).toEqual(204);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<null>();
      expect(headRequest.response.body).toBe(null);

      const errorHeadTracker = await promiseIfRemote(
        interceptor.head('/users').respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        worker,
      );

      let errorHeadRequests = await promiseIfRemote(errorHeadTracker.requests(), worker);
      expect(errorHeadRequests).toHaveLength(0);

      const otherHeadResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
      expect(otherHeadResponse.status).toBe(500);

      const serverError = (await otherHeadResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      headRequests = await promiseIfRemote(noContentHeadTracker.requests(), worker);
      expect(headRequests).toHaveLength(1);

      errorHeadRequests = await promiseIfRemote(errorHeadTracker.requests(), worker);
      expect(errorHeadRequests).toHaveLength(1);
      const [errorHeadRequest] = errorHeadRequests;
      expect(errorHeadRequest).toBeInstanceOf(Request);

      expectTypeOf(errorHeadRequest.body).toEqualTypeOf<null>();
      expect(errorHeadRequest.body).toBe(null);

      expectTypeOf(errorHeadRequest.response.status).toEqualTypeOf<500>();
      expect(errorHeadRequest.response.status).toEqual(500);

      expectTypeOf(errorHeadRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorHeadRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      await promiseIfRemote(errorHeadTracker.bypass(), worker);

      headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
      expect(headResponse.status).toBe(204);

      errorHeadRequests = await promiseIfRemote(errorHeadTracker.requests(), worker);
      expect(errorHeadRequests).toHaveLength(1);

      headRequests = await promiseIfRemote(noContentHeadTracker.requests(), worker);
      expect(headRequests).toHaveLength(2);
      [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.body).toEqualTypeOf<null>();
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<204>();
      expect(headRequest.response.status).toEqual(204);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<null>();
      expect(headRequest.response.body).toBe(null);
    });
  });

  it('should ignore all trackers after cleared when intercepting HEAD requests', async () => {
    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
            204: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const headTracker = await promiseIfRemote(
        interceptor.head('/users').respond({
          status: 200,
        }),
        worker,
      );

      await promiseIfRemote(interceptor.clear(), worker);

      const initialHeadRequests = await promiseIfRemote(headTracker.requests(), worker);
      expect(initialHeadRequests).toHaveLength(0);

      const headPromise = fetch(`${baseURL}/users`, { method: 'HEAD' });
      await expectToThrowFetchError(headPromise);
    });
  });

  it('should support creating new trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
            204: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(
        interceptor.head('/users').respond({
          status: 200,
        }),
        worker,
      );

      await promiseIfRemote(interceptor.clear(), worker);

      const noContentHeadTracker = await promiseIfRemote(
        interceptor.head('/users').respond({
          status: 204,
        }),
        worker,
      );

      let headRequests = await promiseIfRemote(noContentHeadTracker.requests(), worker);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
      expect(headResponse.status).toBe(204);

      headRequests = await promiseIfRemote(noContentHeadTracker.requests(), worker);
      expect(headRequests).toHaveLength(1);
      const [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.body).toEqualTypeOf<null>();
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<204>();
      expect(headRequest.response.status).toEqual(204);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<null>();
      expect(headRequest.response.body).toBe(null);
    });
  });

  it('should support reusing previous trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
            204: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const headTracker = await promiseIfRemote(interceptor.head('/users'), worker);

      await promiseIfRemote(
        headTracker.respond({
          status: 200,
        }),
        worker,
      );

      await promiseIfRemote(interceptor.clear(), worker);

      const noContentHeadTracker = await promiseIfRemote(
        headTracker.respond({
          status: 204,
        }),
        worker,
      );

      let headRequests = await promiseIfRemote(noContentHeadTracker.requests(), worker);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(`${baseURL}/users`, { method: 'HEAD' });
      expect(headResponse.status).toBe(204);

      headRequests = await promiseIfRemote(noContentHeadTracker.requests(), worker);
      expect(headRequests).toHaveLength(1);
      const [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.body).toEqualTypeOf<null>();
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<204>();
      expect(headRequest.response.status).toEqual(204);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<null>();
      expect(headRequest.response.body).toBe(null);
    });
  });
}
