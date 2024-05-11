import { beforeEach, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestTracker from '@/interceptor/http/requestTracker/LocalHttpRequestTracker';
import RemoteHttpRequestTracker from '@/interceptor/http/requestTracker/RemoteHttpRequestTracker';
import { fetchWithTimeout, joinURL } from '@/utils/fetch';
import { expectFetchError } from '@tests/utils/fetch';
import { createInternalHttpInterceptor, usingHttpInterceptor } from '@tests/utils/interceptors';

import NotStartedHttpInterceptorError from '../../../errors/NotStartedHttpInterceptorError';
import { HttpInterceptorOptions } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../types';

export function declareHeadHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Tracker: typeof LocalHttpRequestTracker | typeof RemoteHttpRequestTracker;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Tracker = options.type === 'local' ? LocalHttpRequestTracker : RemoteHttpRequestTracker;
  });

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
        interceptor,
      );
      expect(headTracker).toBeInstanceOf(Tracker);

      let headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
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
        interceptor,
      );
      expect(headTracker).toBeInstanceOf(Tracker);

      let headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
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
        interceptor,
      );
      expect(headTracker).toBeInstanceOf(Tracker);

      let headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(joinURL(baseURL, '/users'), {
        method: 'HEAD',
        headers: {
          accept: 'application/json',
        } satisfies UserHeadRequestHeaders,
      });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
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
        interceptor,
      );
      expect(headTracker).toBeInstanceOf(Tracker);

      let headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserHeadSearchParams>({
        tag: 'admin',
      });

      const headResponse = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
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
      expect(headTracker).toBeInstanceOf(Tracker);

      let headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headers = new HttpHeaders<UserHeadHeaders>({
        'content-type': 'application/json',
        accept: 'application/json',
      });

      let headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD', headers });
      expect(headResponse.status).toBe(200);
      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(1);

      headers.append('accept', 'application/xml');

      headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD', headers });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(2);

      headers.delete('accept');

      let headResponsePromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD', headers });
      await expectFetchError(headResponsePromise);

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(2);

      headers.set('accept', 'application/json');
      headers.set('content-type', 'text/plain');

      headResponsePromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD', headers });
      await expectFetchError(headResponsePromise);

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
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
      expect(headTracker).toBeInstanceOf(Tracker);

      let headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserHeadSearchParams>({
        tag: 'admin',
      });

      const headResponse = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'HEAD' });
      expect(headResponse.status).toBe(200);
      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(1);

      searchParams.delete('tag');

      const headResponsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'HEAD' });
      await expectFetchError(headResponsePromise);
      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
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
        interceptor,
      );
      expect(genericHeadTracker).toBeInstanceOf(Tracker);

      let genericHeadRequests = await promiseIfRemote(genericHeadTracker.requests(), interceptor);
      expect(genericHeadRequests).toHaveLength(0);

      const genericHeadResponse = await fetch(joinURL(baseURL, `/users/${1}`), { method: 'HEAD' });
      expect(genericHeadResponse.status).toBe(200);

      genericHeadRequests = await promiseIfRemote(genericHeadTracker.requests(), interceptor);
      expect(genericHeadRequests).toHaveLength(1);
      const [genericHeadRequest] = genericHeadRequests;
      expect(genericHeadRequest).toBeInstanceOf(Request);

      expectTypeOf(genericHeadRequest.body).toEqualTypeOf<null>();
      expect(genericHeadRequest.body).toBe(null);

      expectTypeOf(genericHeadRequest.response.status).toEqualTypeOf<200>();
      expect(genericHeadRequest.response.status).toEqual(200);

      expectTypeOf(genericHeadRequest.response.body).toEqualTypeOf<null>();
      expect(genericHeadRequest.response.body).toBe(null);

      await promiseIfRemote(genericHeadTracker.bypass(), interceptor);

      const specificHeadTracker = await promiseIfRemote(
        interceptor.head(`/users/${1}`).respond({
          status: 200,
        }),
        interceptor,
      );
      expect(specificHeadTracker).toBeInstanceOf(Tracker);

      let specificHeadRequests = await promiseIfRemote(specificHeadTracker.requests(), interceptor);
      expect(specificHeadRequests).toHaveLength(0);

      const specificHeadResponse = await fetch(joinURL(baseURL, `/users/${1}`), { method: 'HEAD' });
      expect(specificHeadResponse.status).toBe(200);

      specificHeadRequests = await promiseIfRemote(specificHeadTracker.requests(), interceptor);
      expect(specificHeadRequests).toHaveLength(1);
      const [specificHeadRequest] = specificHeadRequests;
      expect(specificHeadRequest).toBeInstanceOf(Request);

      expectTypeOf(specificHeadRequest.body).toEqualTypeOf<null>();
      expect(specificHeadRequest.body).toBe(null);

      expectTypeOf(specificHeadRequest.response.status).toEqualTypeOf<200>();
      expect(specificHeadRequest.response.status).toEqual(200);

      expectTypeOf(specificHeadRequest.response.body).toEqualTypeOf<null>();
      expect(specificHeadRequest.response.body).toBe(null);

      const unmatchedHeadPromise = fetch(joinURL(baseURL, `/users/${2}`), { method: 'HEAD' });
      await expectFetchError(unmatchedHeadPromise);
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
      let fetchPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      await expectFetchError(fetchPromise);

      const headTrackerWithoutResponse = await promiseIfRemote(interceptor.head('/users'), interceptor);
      expect(headTrackerWithoutResponse).toBeInstanceOf(Tracker);

      let headRequestsWithoutResponse = await promiseIfRemote(headTrackerWithoutResponse.requests(), interceptor);
      expect(headRequestsWithoutResponse).toHaveLength(0);

      let [headRequestWithoutResponse] = headRequestsWithoutResponse;
      expectTypeOf<typeof headRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof headRequestWithoutResponse.response>().toEqualTypeOf<never>();

      fetchPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      await expectFetchError(fetchPromise);

      headRequestsWithoutResponse = await promiseIfRemote(headTrackerWithoutResponse.requests(), interceptor);
      expect(headRequestsWithoutResponse).toHaveLength(0);

      [headRequestWithoutResponse] = headRequestsWithoutResponse;
      expectTypeOf<typeof headRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof headRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const headTrackerWithResponse = headTrackerWithoutResponse.respond({
        status: 200,
      });

      const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      expect(headRequestsWithoutResponse).toHaveLength(0);
      const headRequestsWithResponse = await promiseIfRemote(headTrackerWithResponse.requests(), interceptor);
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
    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
            204: {};
            500: {};
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
        interceptor,
      );

      let headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(204);

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
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
        }),
        interceptor,
      );

      let errorHeadRequests = await promiseIfRemote(errorHeadTracker.requests(), interceptor);
      expect(errorHeadRequests).toHaveLength(0);

      const otherHeadResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(otherHeadResponse.status).toBe(500);

      expect(await otherHeadResponse.text()).toBe('');

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(1);

      errorHeadRequests = await promiseIfRemote(errorHeadTracker.requests(), interceptor);
      expect(errorHeadRequests).toHaveLength(1);
      const [errorHeadRequest] = errorHeadRequests;
      expect(errorHeadRequest).toBeInstanceOf(Request);

      expectTypeOf(errorHeadRequest.body).toEqualTypeOf<null>();
      expect(errorHeadRequest.body).toBe(null);

      expectTypeOf(errorHeadRequest.response.status).toEqualTypeOf<500>();
      expect(errorHeadRequest.response.status).toEqual(500);

      expectTypeOf(errorHeadRequest.response.body).toEqualTypeOf<null>();
      expect(errorHeadRequest.response.body).toBe(null);
    });
  });

  it('should ignore trackers with bypassed responses when intercepting HEAD requests', async () => {
    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
            204: {};
            500: {};
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
        interceptor,
      );

      let initialHeadRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(initialHeadRequests).toHaveLength(0);

      const headPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      await expectFetchError(headPromise);

      const noContentHeadTracker = await promiseIfRemote(
        headTracker.respond({
          status: 204,
        }),
        interceptor,
      );

      initialHeadRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(initialHeadRequests).toHaveLength(0);
      let headRequests = await promiseIfRemote(noContentHeadTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      let headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(204);

      headRequests = await promiseIfRemote(noContentHeadTracker.requests(), interceptor);
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
        }),
        interceptor,
      );

      let errorHeadRequests = await promiseIfRemote(errorHeadTracker.requests(), interceptor);
      expect(errorHeadRequests).toHaveLength(0);

      const otherHeadResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(otherHeadResponse.status).toBe(500);

      expect(await otherHeadResponse.text()).toBe('');

      headRequests = await promiseIfRemote(noContentHeadTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(1);

      errorHeadRequests = await promiseIfRemote(errorHeadTracker.requests(), interceptor);
      expect(errorHeadRequests).toHaveLength(1);
      const [errorHeadRequest] = errorHeadRequests;
      expect(errorHeadRequest).toBeInstanceOf(Request);

      expectTypeOf(errorHeadRequest.body).toEqualTypeOf<null>();
      expect(errorHeadRequest.body).toBe(null);

      expectTypeOf(errorHeadRequest.response.status).toEqualTypeOf<500>();
      expect(errorHeadRequest.response.status).toEqual(500);

      expectTypeOf(errorHeadRequest.response.body).toEqualTypeOf<null>();
      expect(errorHeadRequest.response.body).toBe(null);

      await promiseIfRemote(errorHeadTracker.bypass(), interceptor);

      headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(204);

      errorHeadRequests = await promiseIfRemote(errorHeadTracker.requests(), interceptor);
      expect(errorHeadRequests).toHaveLength(1);

      headRequests = await promiseIfRemote(noContentHeadTracker.requests(), interceptor);
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
        interceptor,
      );

      let headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(1);

      await promiseIfRemote(interceptor.clear(), interceptor);

      const headPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      await expectFetchError(headPromise);

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(1);
    });
  });

  it('should ignore all trackers after restarted when intercepting HEAD requests', async () => {
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
        interceptor,
      );

      let headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(1);

      expect(interceptor.isRunning()).toBe(true);
      await interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);

      let headPromise = fetchWithTimeout(joinURL(baseURL, '/users'), {
        method: 'HEAD',
        timeout: 200,
      });
      await expectFetchError(headPromise, { canBeAborted: true });

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(1);

      await interceptor.start();
      expect(interceptor.isRunning()).toBe(true);

      headPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      await expectFetchError(headPromise);

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(1);
    });
  });

  it('should ignore all trackers after restarted when intercepting HEAD requests, even if another interceptor is still running', async () => {
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
        interceptor,
      );

      let headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(1);

      await usingHttpInterceptor(interceptorOptions, async (otherInterceptor) => {
        expect(interceptor.isRunning()).toBe(true);
        expect(otherInterceptor.isRunning()).toBe(true);

        await interceptor.stop();
        expect(interceptor.isRunning()).toBe(false);
        expect(otherInterceptor.isRunning()).toBe(true);

        let headPromise = fetchWithTimeout(joinURL(baseURL, '/users'), {
          method: 'HEAD',
          timeout: 200,
        });
        await expectFetchError(headPromise, { canBeAborted: true });

        headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
        expect(headRequests).toHaveLength(1);

        await interceptor.start();
        expect(interceptor.isRunning()).toBe(true);
        expect(otherInterceptor.isRunning()).toBe(true);

        headPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
        await expectFetchError(headPromise);

        headRequests = await promiseIfRemote(headTracker.requests(), interceptor);
        expect(headRequests).toHaveLength(1);
      });
    });
  });

  it('should throw an error when trying to create a HEAD request tracker if not running', async () => {
    const interceptor = createInternalHttpInterceptor(interceptorOptions);
    expect(interceptor.isRunning()).toBe(false);

    await expect(async () => {
      await interceptor.head('/');
    }).rejects.toThrowError(new NotStartedHttpInterceptorError());
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
        interceptor,
      );

      await promiseIfRemote(interceptor.clear(), interceptor);

      const noContentHeadTracker = await promiseIfRemote(
        interceptor.head('/users').respond({
          status: 204,
        }),
        interceptor,
      );

      let headRequests = await promiseIfRemote(noContentHeadTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(204);

      headRequests = await promiseIfRemote(noContentHeadTracker.requests(), interceptor);
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
      const headTracker = await promiseIfRemote(interceptor.head('/users'), interceptor);

      await promiseIfRemote(
        headTracker.respond({
          status: 200,
        }),
        interceptor,
      );

      await promiseIfRemote(interceptor.clear(), interceptor);

      const noContentHeadTracker = await promiseIfRemote(
        headTracker.respond({
          status: 204,
        }),
        interceptor,
      );

      let headRequests = await promiseIfRemote(noContentHeadTracker.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(204);

      headRequests = await promiseIfRemote(noContentHeadTracker.requests(), interceptor);
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
