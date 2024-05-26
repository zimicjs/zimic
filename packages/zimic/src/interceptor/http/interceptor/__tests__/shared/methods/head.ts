import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema } from '@/http/types/schema';
import { http } from '@/interceptor';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { fetchWithTimeout } from '@/utils/fetch';
import { joinURL } from '@/utils/urls';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectFetchError } from '@tests/utils/fetch';
import { createInternalHttpInterceptor, usingHttpInterceptor } from '@tests/utils/interceptors';

import NotStartedHttpInterceptorError from '../../../errors/NotStartedHttpInterceptorError';
import { HttpInterceptorOptions, UnhandledRequestStrategy } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../types';
import { verifyUnhandledRequestMessage } from '../utils';

export function declareHeadHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Handler = options.type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;
  });

  it('should support intercepting HEAD requests with a static response', async () => {
    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const headHandler = await promiseIfRemote(
        interceptor.head('/users').respond({
          status: 200,
        }),
        interceptor,
      );
      expect(headHandler).toBeInstanceOf(Handler);

      let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
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

  it('should support intercepting HEAD requests with a computed response', async () => {
    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const headHandler = await promiseIfRemote(
        interceptor.head('/users').respond(() => ({
          status: 200,
        })),
        interceptor,
      );
      expect(headHandler).toBeInstanceOf(Handler);

      let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
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

  it('should ignore response bodies in HEAD requests', async () => {
    // @ts-expect-error Forcing a HEAD response to incorrectly have a body.
    await usingHttpInterceptor<{
      '/users': {
        HEAD: {
          response: {
            200: { body: string };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const headHandler = await promiseIfRemote(
        interceptor.head('/users').respond(() => ({
          status: 200,
          body: 'HEAD responses should not have a body.',
        })),
        interceptor,
      );
      expect(headHandler).toBeInstanceOf(Handler);

      let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
      expect(headRequests).toHaveLength(1);
      const [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.body).toEqualTypeOf<null>();
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<200>();
      expect(headRequest.response.status).toEqual(200);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<200>();
      expect(headRequest.response.status).toEqual(200);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<string>();
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
      const headHandler = await promiseIfRemote(
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
      expect(headHandler).toBeInstanceOf(Handler);

      let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(joinURL(baseURL, '/users'), {
        method: 'HEAD',
        headers: {
          accept: 'application/json',
        } satisfies UserHeadRequestHeaders,
      });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
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
      const headHandler = await promiseIfRemote(
        interceptor.head('/users').respond((request) => {
          expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserHeadSearchParams>>();
          expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

          return {
            status: 200,
          };
        }),
        interceptor,
      );
      expect(headHandler).toBeInstanceOf(Handler);

      let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserHeadSearchParams>({
        tag: 'admin',
      });

      const headResponse = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
      expect(headRequests).toHaveLength(1);
      const [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.searchParams).toEqualTypeOf<HttpSearchParams<UserHeadSearchParams>>();
      expect(headRequest.searchParams).toBeInstanceOf(HttpSearchParams);
      expect(headRequest.searchParams).toEqual(searchParams);
      expect(headRequest.searchParams.get('tag')).toBe('admin');
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

      const headHandlerWithoutResponse = await promiseIfRemote(interceptor.head('/users'), interceptor);
      expect(headHandlerWithoutResponse).toBeInstanceOf(Handler);

      let headRequestsWithoutResponse = await promiseIfRemote(headHandlerWithoutResponse.requests(), interceptor);
      expect(headRequestsWithoutResponse).toHaveLength(0);

      let [headRequestWithoutResponse] = headRequestsWithoutResponse;
      expectTypeOf<typeof headRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof headRequestWithoutResponse.response>().toEqualTypeOf<never>();

      fetchPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      await expectFetchError(fetchPromise);

      headRequestsWithoutResponse = await promiseIfRemote(headHandlerWithoutResponse.requests(), interceptor);
      expect(headRequestsWithoutResponse).toHaveLength(0);

      [headRequestWithoutResponse] = headRequestsWithoutResponse;
      expectTypeOf<typeof headRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof headRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const headHandlerWithResponse = headHandlerWithoutResponse.respond({
        status: 200,
      });

      const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(200);

      expect(headRequestsWithoutResponse).toHaveLength(0);
      const headRequestsWithResponse = await promiseIfRemote(headHandlerWithResponse.requests(), interceptor);
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
      const headHandler = await promiseIfRemote(
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

      let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
      expect(headRequests).toHaveLength(0);

      const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(headResponse.status).toBe(204);

      headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
      expect(headRequests).toHaveLength(1);
      const [headRequest] = headRequests;
      expect(headRequest).toBeInstanceOf(Request);

      expectTypeOf(headRequest.body).toEqualTypeOf<null>();
      expect(headRequest.body).toBe(null);

      expectTypeOf(headRequest.response.status).toEqualTypeOf<204>();
      expect(headRequest.response.status).toEqual(204);

      expectTypeOf(headRequest.response.body).toEqualTypeOf<null>();
      expect(headRequest.response.body).toBe(null);

      const errorHeadHandler = await promiseIfRemote(
        interceptor.head('/users').respond({
          status: 500,
        }),
        interceptor,
      );

      let errorHeadRequests = await promiseIfRemote(errorHeadHandler.requests(), interceptor);
      expect(errorHeadRequests).toHaveLength(0);

      const otherHeadResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
      expect(otherHeadResponse.status).toBe(500);

      expect(await otherHeadResponse.text()).toBe('');

      headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
      expect(headRequests).toHaveLength(1);

      errorHeadRequests = await promiseIfRemote(errorHeadHandler.requests(), interceptor);
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

  describe('Dynamic paths', () => {
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
        const genericHeadHandler = await promiseIfRemote(
          interceptor.head('/users/:id').respond((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<{ id: string }>();
            expect(request.pathParams).toEqual({ id: '1' });

            return {
              status: 200,
            };
          }),
          interceptor,
        );
        expect(genericHeadHandler).toBeInstanceOf(Handler);

        let genericHeadRequests = await promiseIfRemote(genericHeadHandler.requests(), interceptor);
        expect(genericHeadRequests).toHaveLength(0);

        const genericHeadResponse = await fetch(joinURL(baseURL, `/users/${1}`), { method: 'HEAD' });
        expect(genericHeadResponse.status).toBe(200);

        genericHeadRequests = await promiseIfRemote(genericHeadHandler.requests(), interceptor);
        expect(genericHeadRequests).toHaveLength(1);
        const [genericHeadRequest] = genericHeadRequests;
        expect(genericHeadRequest).toBeInstanceOf(Request);

        expectTypeOf(genericHeadRequest.pathParams).toEqualTypeOf<{ id: string }>();
        expect(genericHeadRequest.pathParams).toEqual({ id: '1' });

        expectTypeOf(genericHeadRequest.body).toEqualTypeOf<null>();
        expect(genericHeadRequest.body).toBe(null);

        expectTypeOf(genericHeadRequest.response.status).toEqualTypeOf<200>();
        expect(genericHeadRequest.response.status).toEqual(200);

        expectTypeOf(genericHeadRequest.response.body).toEqualTypeOf<null>();
        expect(genericHeadRequest.response.body).toBe(null);

        await promiseIfRemote(genericHeadHandler.bypass(), interceptor);

        const specificHeadHandler = await promiseIfRemote(
          interceptor.head(`/users/${1}`).respond((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<{ id: string }>();
            expect(request.pathParams).toEqual({});

            return {
              status: 200,
            };
          }),
          interceptor,
        );
        expect(specificHeadHandler).toBeInstanceOf(Handler);

        let specificHeadRequests = await promiseIfRemote(specificHeadHandler.requests(), interceptor);
        expect(specificHeadRequests).toHaveLength(0);

        const specificHeadResponse = await fetch(joinURL(baseURL, `/users/${1}`), { method: 'HEAD' });
        expect(specificHeadResponse.status).toBe(200);

        specificHeadRequests = await promiseIfRemote(specificHeadHandler.requests(), interceptor);
        expect(specificHeadRequests).toHaveLength(1);
        const [specificHeadRequest] = specificHeadRequests;
        expect(specificHeadRequest).toBeInstanceOf(Request);

        expectTypeOf(specificHeadRequest.pathParams).toEqualTypeOf<{ id: string }>();
        expect(specificHeadRequest.pathParams).toEqual({});

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
  });

  describe('Restrictions', () => {
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
        const headHandler = interceptor
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
        expect(headHandler).toBeInstanceOf(Handler);

        let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(0);

        const headers = new HttpHeaders<UserHeadHeaders>({
          'content-type': 'application/json',
          accept: 'application/json',
        });

        let headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD', headers });
        expect(headResponse.status).toBe(200);
        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(1);

        headers.append('accept', 'application/xml');

        headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD', headers });
        expect(headResponse.status).toBe(200);

        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(2);

        headers.delete('accept');

        let headPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD', headers });
        await expectFetchError(headPromise);

        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(2);

        headers.set('accept', 'application/json');
        headers.set('content-type', 'text/plain');

        headPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD', headers });
        await expectFetchError(headPromise);

        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
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
        const headHandler = interceptor
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
        expect(headHandler).toBeInstanceOf(Handler);

        let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(0);

        const searchParams = new HttpSearchParams<UserHeadSearchParams>({
          tag: 'admin',
        });

        const headResponse = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'HEAD' });
        expect(headResponse.status).toBe(200);
        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(1);

        searchParams.delete('tag');

        const headPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'HEAD' });
        await expectFetchError(headPromise);
        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(1);
      });
    });
  });

  describe('Bypass', () => {
    it('should ignore handlers with bypassed responses when intercepting HEAD requests', async () => {
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
        const headHandler = await promiseIfRemote(
          interceptor
            .head('/users')
            .respond({
              status: 200,
            })
            .bypass(),
          interceptor,
        );

        let initialHeadRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(initialHeadRequests).toHaveLength(0);

        const headPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
        await expectFetchError(headPromise);

        const noContentHeadHandler = await promiseIfRemote(
          headHandler.respond({
            status: 204,
          }),
          interceptor,
        );

        initialHeadRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(initialHeadRequests).toHaveLength(0);
        let headRequests = await promiseIfRemote(noContentHeadHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(0);

        let headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
        expect(headResponse.status).toBe(204);

        headRequests = await promiseIfRemote(noContentHeadHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(1);
        let [headRequest] = headRequests;
        expect(headRequest).toBeInstanceOf(Request);

        expectTypeOf(headRequest.body).toEqualTypeOf<null>();
        expect(headRequest.body).toBe(null);

        expectTypeOf(headRequest.response.status).toEqualTypeOf<204>();
        expect(headRequest.response.status).toEqual(204);

        expectTypeOf(headRequest.response.body).toEqualTypeOf<null>();
        expect(headRequest.response.body).toBe(null);

        const errorHeadHandler = await promiseIfRemote(
          interceptor.head('/users').respond({
            status: 500,
          }),
          interceptor,
        );

        let errorHeadRequests = await promiseIfRemote(errorHeadHandler.requests(), interceptor);
        expect(errorHeadRequests).toHaveLength(0);

        const otherHeadResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
        expect(otherHeadResponse.status).toBe(500);

        expect(await otherHeadResponse.text()).toBe('');

        headRequests = await promiseIfRemote(noContentHeadHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(1);

        errorHeadRequests = await promiseIfRemote(errorHeadHandler.requests(), interceptor);
        expect(errorHeadRequests).toHaveLength(1);
        const [errorHeadRequest] = errorHeadRequests;
        expect(errorHeadRequest).toBeInstanceOf(Request);

        expectTypeOf(errorHeadRequest.body).toEqualTypeOf<null>();
        expect(errorHeadRequest.body).toBe(null);

        expectTypeOf(errorHeadRequest.response.status).toEqualTypeOf<500>();
        expect(errorHeadRequest.response.status).toEqual(500);

        expectTypeOf(errorHeadRequest.response.body).toEqualTypeOf<null>();
        expect(errorHeadRequest.response.body).toBe(null);

        await promiseIfRemote(errorHeadHandler.bypass(), interceptor);

        headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
        expect(headResponse.status).toBe(204);

        errorHeadRequests = await promiseIfRemote(errorHeadHandler.requests(), interceptor);
        expect(errorHeadRequests).toHaveLength(1);

        headRequests = await promiseIfRemote(noContentHeadHandler.requests(), interceptor);
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
  });

  describe('Clear', () => {
    it('should ignore all handlers after cleared when intercepting HEAD requests', async () => {
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
        const headHandler = await promiseIfRemote(
          interceptor.head('/users').respond({
            status: 200,
          }),
          interceptor,
        );

        let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(0);

        const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
        expect(headResponse.status).toBe(200);

        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(1);

        await promiseIfRemote(interceptor.clear(), interceptor);

        const headPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
        await expectFetchError(headPromise);

        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(1);
      });
    });

    it('should support creating new handlers after cleared', async () => {
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

        const noContentHeadHandler = await promiseIfRemote(
          interceptor.head('/users').respond({
            status: 204,
          }),
          interceptor,
        );

        let headRequests = await promiseIfRemote(noContentHeadHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(0);

        const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
        expect(headResponse.status).toBe(204);

        headRequests = await promiseIfRemote(noContentHeadHandler.requests(), interceptor);
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

    it('should support reusing previous handlers after cleared', async () => {
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
        const headHandler = await promiseIfRemote(interceptor.head('/users'), interceptor);

        await promiseIfRemote(
          headHandler.respond({
            status: 200,
          }),
          interceptor,
        );

        await promiseIfRemote(interceptor.clear(), interceptor);

        const noContentHeadHandler = await promiseIfRemote(
          headHandler.respond({
            status: 204,
          }),
          interceptor,
        );

        let headRequests = await promiseIfRemote(noContentHeadHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(0);

        const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
        expect(headResponse.status).toBe(204);

        headRequests = await promiseIfRemote(noContentHeadHandler.requests(), interceptor);
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
  });

  describe('Life cycle', () => {
    it('should ignore all handlers after restarted when intercepting HEAD requests', async () => {
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
        const headHandler = await promiseIfRemote(
          interceptor.head('/users').respond({
            status: 200,
          }),
          interceptor,
        );

        let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(0);

        const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
        expect(headResponse.status).toBe(200);

        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(1);

        expect(interceptor.isRunning()).toBe(true);
        await interceptor.stop();
        expect(interceptor.isRunning()).toBe(false);

        let headPromise = fetchWithTimeout(joinURL(baseURL, '/users'), {
          method: 'HEAD',
          timeout: 200,
        });
        await expectFetchError(headPromise, { canBeAborted: true });

        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(1);

        await interceptor.start();
        expect(interceptor.isRunning()).toBe(true);

        headPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
        await expectFetchError(headPromise);

        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(1);
      });
    });

    it('should ignore all handlers after restarted when intercepting HEAD requests, even if another interceptor is still running', async () => {
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
        const headHandler = await promiseIfRemote(
          interceptor.head('/users').respond({
            status: 200,
          }),
          interceptor,
        );

        let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(0);

        const headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
        expect(headResponse.status).toBe(200);

        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
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

          headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
          expect(headRequests).toHaveLength(1);

          await interceptor.start();
          expect(interceptor.isRunning()).toBe(true);
          expect(otherInterceptor.isRunning()).toBe(true);

          headPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD' });
          await expectFetchError(headPromise);

          headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
          expect(headRequests).toHaveLength(1);
        });
      });
    });

    it('should throw an error when trying to create a HEAD request handler if not running', async () => {
      const interceptor = createInternalHttpInterceptor(interceptorOptions);
      expect(interceptor.isRunning()).toBe(false);

      await expect(async () => {
        await interceptor.head('/');
      }).rejects.toThrowError(new NotStartedHttpInterceptorError());
    });
  });

  describe('Unhandled requests', () => {
    describe.each([
      { overrideDefault: false as const },
      { overrideDefault: 'static' as const },
      { overrideDefault: 'static-empty' as const },
      { overrideDefault: 'function' as const },
    ])('Logging enabled or disabled: override default $overrideDefault', ({ overrideDefault }) => {
      beforeEach(() => {
        if (overrideDefault === 'static') {
          http.default.onUnhandledRequest({ log: true });
        } else if (overrideDefault === 'static-empty') {
          http.default.onUnhandledRequest({});
        } else if (overrideDefault === 'function') {
          http.default.onUnhandledRequest(async (_request, context) => {
            await context.log();
          });
        }
      });

      if (type === 'local') {
        it('should show a warning when logging is enabled and a HEAD request is unhandled and bypassed', async () => {
          await usingHttpInterceptor<{
            '/users': {
              HEAD: {
                request: { headers: { 'x-value': string } };
                response: {
                  200: {};
                };
              };
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const headHandler = await promiseIfRemote(
                interceptor
                  .head('/users')
                  .with({ headers: { 'x-value': '1' } })
                  .respond({
                    status: 200,
                  }),
                interceptor,
              );

              let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
              expect(headRequests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const headResponse = await fetch(joinURL(baseURL, '/users'), {
                  method: 'HEAD',
                  headers: { 'x-value': '1' },
                });
                expect(headResponse.status).toBe(200);

                headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
                expect(headRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const headRequest = new Request(joinURL(baseURL, '/users'), { method: 'HEAD' });
                const headPromise = fetch(headRequest);
                await expectFetchError(headPromise);

                headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
                expect(headRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(1);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const warnMessage = spies.warn.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(warnMessage, {
                  type: 'warn',
                  platform,
                  request: headRequest,
                });
              });
            },
          );
        });
      }

      if (type === 'remote') {
        it('should show an error when logging is enabled and a HEAD request is unhandled and rejected', async () => {
          await usingHttpInterceptor<{
            '/users': {
              HEAD: {
                request: { headers: { 'x-value': string } };
                response: {
                  200: {};
                };
              };
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const headHandler = await promiseIfRemote(
                interceptor
                  .head('/users')
                  .with({ headers: { 'x-value': '1' } })
                  .respond({
                    status: 200,
                  }),
                interceptor,
              );

              let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
              expect(headRequests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const headResponse = await fetch(joinURL(baseURL, '/users'), {
                  method: 'HEAD',
                  headers: { 'x-value': '1' },
                });
                expect(headResponse.status).toBe(200);

                headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
                expect(headRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const headRequest = new Request(joinURL(baseURL, '/users'), {
                  method: 'HEAD',
                  headers: { 'x-value': '2' },
                });
                const headPromise = fetch(headRequest);
                await expectFetchError(headPromise);

                headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
                expect(headRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(1);

                const errorMessage = spies.error.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(errorMessage, {
                  type: 'error',
                  platform,
                  request: headRequest,
                });
              });
            },
          );
        });
      }
    });

    it.each([{ overrideDefault: false }, { overrideDefault: 'static' }, { overrideDefault: 'function' }])(
      'should not show a warning or error when logging is disabled and a HEAD request is unhandled: override default $overrideDefault',
      async ({ overrideDefault }) => {
        if (overrideDefault === 'static') {
          http.default.onUnhandledRequest({ log: false });
        } else if (overrideDefault === 'function') {
          http.default.onUnhandledRequest(vi.fn());
        }

        await usingHttpInterceptor<{
          '/users': {
            HEAD: {
              request: { headers: { 'x-value': string } };
              response: {
                200: {};
              };
            };
          };
        }>(
          {
            ...interceptorOptions,
            onUnhandledRequest: overrideDefault === false ? { log: false } : {},
          },
          async (interceptor) => {
            const headHandler = await promiseIfRemote(
              interceptor
                .head('/users')
                .with({ headers: { 'x-value': '1' } })
                .respond({
                  status: 200,
                }),
              interceptor,
            );

            let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
            expect(headRequests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (spies) => {
              const headResponse = await fetch(joinURL(baseURL, '/users'), {
                method: 'HEAD',
                headers: { 'x-value': '1' },
              });
              expect(headResponse.status).toBe(200);

              headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
              expect(headRequests).toHaveLength(1);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);

              const headRequest = new Request(joinURL(baseURL, '/users'), {
                method: 'HEAD',
                headers: { 'x-value': '2' },
              });
              const headPromise = fetch(headRequest);
              await expectFetchError(headPromise);

              headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
              expect(headRequests).toHaveLength(1);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);
            });
          },
        );
      },
    );

    it('should support a custom unhandled HEAD request handler', async () => {
      const onUnhandledRequest = vi.fn(async (request: Request, context: UnhandledRequestStrategy.HandlerContext) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          await context.log();
        }
      });

      await usingHttpInterceptor<{
        '/users': {
          HEAD: {
            request: {
              headers: { 'x-value': string };
              searchParams: { name?: string };
            };
            response: {
              200: {};
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const headHandler = await promiseIfRemote(
          interceptor
            .head('/users')
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 200,
            }),
          interceptor,
        );

        let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const headResponse = await fetch(joinURL(baseURL, '/users'), {
            method: 'HEAD',
            headers: { 'x-value': '1' },
          });
          expect(headResponse.status).toBe(200);

          headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
          expect(headRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const searchParams = new HttpSearchParams({ name: 'User 1' });

          let headPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method: 'HEAD',
            headers: { 'x-value': '2' },
          });
          await expectFetchError(headPromise);

          headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
          expect(headRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const headRequest = new Request(joinURL(baseURL, '/users'), {
            method: 'HEAD',
            headers: { 'x-value': '2' },
          });
          headPromise = fetch(headRequest);
          await expectFetchError(headPromise);

          headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
          expect(headRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

          const messageType = type === 'local' ? 'warn' : 'error';
          expect(spies.warn).toHaveBeenCalledTimes(messageType === 'warn' ? 1 : 0);
          expect(spies.error).toHaveBeenCalledTimes(messageType === 'error' ? 1 : 0);

          const errorMessage = spies[messageType].mock.calls[0].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, {
            type: messageType,
            platform,
            request: headRequest,
          });
        });
      });
    });

    it('should log an error if a custom unhandled HEAD request handler throws', async () => {
      const error = new Error('Unhandled request.');

      const onUnhandledRequest = vi.fn((request: Request) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          throw error;
        }
      });

      await usingHttpInterceptor<{
        '/users': {
          HEAD: {
            request: {
              headers: { 'x-value': string };
              searchParams: { name?: string };
            };
            response: {
              200: {};
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const headHandler = await promiseIfRemote(
          interceptor
            .head('/users')
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 200,
            }),
          interceptor,
        );

        let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const headResponse = await fetch(joinURL(baseURL, '/users'), {
            method: 'HEAD',
            headers: { 'x-value': '1' },
          });
          expect(headResponse.status).toBe(200);

          headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
          expect(headRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const searchParams = new HttpSearchParams({ name: 'User 1' });

          let headPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method: 'HEAD',
            headers: { 'x-value': '2' },
          });
          await expectFetchError(headPromise);

          headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
          expect(headRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const headRequest = new Request(joinURL(baseURL, '/users'), {
            method: 'HEAD',
            headers: { 'x-value': '2' },
          });
          headPromise = fetch(headRequest);
          await expectFetchError(headPromise);

          headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
          expect(headRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(1);

          expect(spies.error).toHaveBeenCalledWith(error);
        });
      });
    });
  });
}
