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

export function declareOptionsHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { baseURL, worker, interceptorOptions } = options;

  type Filters = JSONValue<{
    name: string;
  }>;

  it('should support intercepting OPTIONS requests with a static response body', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 200,
        }),
        worker,
      );
      expect(optionsTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(`${baseURL}/filters`, { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(1);
      const [optionsRequest] = optionsRequests;
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<null>();
      expect(optionsRequest.body).toBe(null);

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<200>();
      expect(optionsRequest.response.status).toEqual(200);

      expectTypeOf(optionsRequest.response.body).toEqualTypeOf<null>();
      expect(optionsRequest.response.body).toBe(null);
    });
  });

  it('should support intercepting OPTIONS requests with a computed response body', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          request: { body: Filters };
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<Filters>();

          return {
            status: 200,
          };
        }),
        worker,
      );
      expect(optionsTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(0);

      const userName = 'User (other)';

      const optionsResponse = await fetch(`${baseURL}/filters`, {
        method: 'OPTIONS',
        body: JSON.stringify({ name: userName } satisfies Filters),
      });

      expect(optionsResponse.status).toBe(200);

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(1);
      const [optionsRequest] = optionsRequests;
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<Filters>();
      expect(optionsRequest.body).toEqual<Filters>({ name: userName });

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<200>();
      expect(optionsRequest.response.status).toEqual(200);

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<200>();
      expect(optionsRequest.response.status).toEqual(200);

      expectTypeOf(optionsRequest.response.body).toEqualTypeOf<null>();
      expect(optionsRequest.response.body).toBe(null);
    });
  });

  it('should support intercepting OPTIONS requests having headers', async () => {
    type FilterOptionsRequestHeaders = HttpSchema.Headers<{
      accept?: string;
    }>;
    type FilterOptionsResponseHeaders = HttpSchema.Headers<{
      'content-type'?: `application/${string}`;
      'cache-control'?: string;
    }>;

    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          request: {
            headers: FilterOptionsRequestHeaders;
          };
          response: {
            200: {
              headers: FilterOptionsResponseHeaders;
            };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond((request) => {
          expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<FilterOptionsRequestHeaders>>();
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
      expect(optionsTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(`${baseURL}/filters`, {
        method: 'OPTIONS',
        headers: {
          accept: 'application/json',
        } satisfies FilterOptionsRequestHeaders,
      });
      expect(optionsResponse.status).toBe(200);

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(1);
      const [optionsRequest] = optionsRequests;
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.headers).toEqualTypeOf<HttpHeaders<FilterOptionsRequestHeaders>>();
      expect(optionsRequest.headers).toBeInstanceOf(HttpHeaders);
      expect(optionsRequest.headers.get('accept')).toBe('application/json');

      expectTypeOf(optionsRequest.response.headers).toEqualTypeOf<HttpHeaders<FilterOptionsResponseHeaders>>();
      expect(optionsRequest.response.headers).toBeInstanceOf(HttpHeaders);
      expect(optionsRequest.response.headers.get('content-type')).toBe('application/json');
      expect(optionsRequest.response.headers.get('cache-control')).toBe('no-cache');
    });
  });

  it('should support intercepting OPTIONS requests having search params', async () => {
    type FiltersOptionsSearchParams = HttpSchema.SearchParams<{
      tag?: string;
    }>;

    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          request: {
            searchParams: FiltersOptionsSearchParams;
          };
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond((request) => {
          expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<FiltersOptionsSearchParams>>();
          expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

          return {
            status: 200,
          };
        }),
        worker,
      );
      expect(optionsTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<FiltersOptionsSearchParams>({
        tag: 'admin',
      });

      const optionsResponse = await fetch(`${baseURL}/filters?${searchParams.toString()}`, { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(1);
      const [optionsRequest] = optionsRequests;
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.searchParams).toEqualTypeOf<HttpSearchParams<FiltersOptionsSearchParams>>();
      expect(optionsRequest.searchParams).toBeInstanceOf(HttpSearchParams);
      expect(optionsRequest.searchParams).toEqual(searchParams);
      expect(optionsRequest.searchParams.get('tag')).toBe('admin');
    });
  });

  it('should support intercepting OPTIONS requests having headers restrictions', async () => {
    type FiltersOptionsHeaders = HttpSchema.Headers<{
      'content-type'?: string;
      accept?: string;
    }>;

    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          request: {
            headers: FiltersOptionsHeaders;
          };
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor
          .options('/filters')
          .with({
            headers: { 'content-type': 'application/json' },
          })
          .with((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<FiltersOptionsHeaders>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            return request.headers.get('accept')?.includes('application/json') ?? false;
          })
          .respond((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<FiltersOptionsHeaders>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            return {
              status: 200,
            };
          }),
        worker,
      );
      expect(optionsTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(0);

      const headers = new HttpHeaders<FiltersOptionsHeaders>({
        'content-type': 'application/json',
        accept: 'application/json',
      });

      let optionsResponse = await fetch(`${baseURL}/filters`, { method: 'OPTIONS', headers });
      expect(optionsResponse.status).toBe(200);
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(1);

      headers.append('accept', 'application/xml');

      optionsResponse = await fetch(`${baseURL}/filters`, { method: 'OPTIONS', headers });
      expect(optionsResponse.status).toBe(200);
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(2);

      headers.delete('accept');

      let optionsResponsePromise = fetch(`${baseURL}/filters`, { method: 'OPTIONS', headers });
      await expectToThrowFetchError(optionsResponsePromise);
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(2);

      headers.set('accept', 'application/json');
      headers.set('content-type', 'text/plain');

      optionsResponsePromise = fetch(`${baseURL}/users`, { method: 'OPTIONS', headers });
      await expectToThrowFetchError(optionsResponsePromise);
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(2);
    });
  });

  it('should support intercepting OPTIONS requests having search params restrictions', async () => {
    type FiltersOptionsSearchParams = HttpSchema.SearchParams<{
      tag?: string;
    }>;

    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          request: {
            searchParams: FiltersOptionsSearchParams;
          };
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor
          .options('/filters')
          .with({
            searchParams: { tag: 'admin' },
          })
          .respond((request) => {
            expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<FiltersOptionsSearchParams>>();
            expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

            return {
              status: 200,
            };
          }),
        worker,
      );
      expect(optionsTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<FiltersOptionsSearchParams>({
        tag: 'admin',
      });

      const optionsResponse = await fetch(`${baseURL}/filters?${searchParams.toString()}`, { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(1);

      searchParams.delete('tag');

      const optionsResponsePromise = fetch(`${baseURL}/filters?${searchParams.toString()}`, { method: 'OPTIONS' });
      await expectToThrowFetchError(optionsResponsePromise);
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(1);
    });
  });

  it('should support intercepting OPTIONS requests having body restrictions', async () => {
    type FiltersOptionsBody = JSONValue<{
      tags?: string[];
      other?: string;
    }>;

    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          request: {
            body: FiltersOptionsBody;
          };
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor
          .options('/filters')
          .with({
            body: { tags: ['admin'] },
          })
          .with((request) => {
            expectTypeOf(request.body).toEqualTypeOf<FiltersOptionsBody>();

            return request.body.other?.startsWith('extra') ?? false;
          })
          .respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<FiltersOptionsBody>();

            return {
              status: 200,
            };
          }),
        worker,
      );
      expect(optionsTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(0);

      let optionsResponse = await fetch(`${baseURL}/filters`, {
        method: 'OPTIONS',
        body: JSON.stringify({
          tags: ['admin'],
          other: 'extra',
        } satisfies FiltersOptionsBody),
      });
      expect(optionsResponse.status).toBe(200);
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(1);

      optionsResponse = await fetch(`${baseURL}/filters`, {
        method: 'OPTIONS',
        body: JSON.stringify({
          tags: ['admin'],
          other: 'extra-other',
        } satisfies FiltersOptionsBody),
      });
      expect(optionsResponse.status).toBe(200);
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(2);

      let optionsResponsePromise = fetch(`${baseURL}/filters`, {
        method: 'OPTIONS',
        body: JSON.stringify({
          tags: ['admin'],
        } satisfies FiltersOptionsBody),
      });
      await expectToThrowFetchError(optionsResponsePromise);
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(2);

      optionsResponsePromise = fetch(`${baseURL}/users`, {
        method: 'OPTIONS',
        body: JSON.stringify({
          tags: [],
        } satisfies FiltersOptionsBody),
      });
      await expectToThrowFetchError(optionsResponsePromise);
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(2);
    });
  });

  it('should support intercepting OPTIONS requests with a dynamic path', async () => {
    await usingHttpInterceptor<{
      '/filters/:id': {
        OPTIONS: {
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const genericOptionsTracker = await promiseIfRemote(
        interceptor.options('/filters/:id').respond({
          status: 200,
        }),
        worker,
      );
      expect(genericOptionsTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let genericOptionsRequests = await promiseIfRemote(genericOptionsTracker.requests(), worker);
      expect(genericOptionsRequests).toHaveLength(0);

      const genericOptionsResponse = await fetch(`${baseURL}/filters/${1}`, { method: 'OPTIONS' });
      expect(genericOptionsResponse.status).toBe(200);

      genericOptionsRequests = await promiseIfRemote(genericOptionsTracker.requests(), worker);
      expect(genericOptionsRequests).toHaveLength(1);
      const [genericOptionsRequest] = genericOptionsRequests;
      expect(genericOptionsRequest).toBeInstanceOf(Request);

      expectTypeOf(genericOptionsRequest.body).toEqualTypeOf<null>();
      expect(genericOptionsRequest.body).toBe(null);

      expectTypeOf(genericOptionsRequest.response.status).toEqualTypeOf<200>();
      expect(genericOptionsRequest.response.status).toEqual(200);

      expectTypeOf(genericOptionsRequest.response.body).toEqualTypeOf<null>();
      expect(genericOptionsRequest.response.body).toBe(null);

      await promiseIfRemote(genericOptionsTracker.bypass(), worker);

      const specificOptionsTracker = await promiseIfRemote(
        interceptor.options(`/filters/${1}`).respond({
          status: 200,
        }),
        worker,
      );
      expect(specificOptionsTracker).toBeInstanceOf(LocalHttpRequestTracker);

      let specificOptionsRequests = await promiseIfRemote(specificOptionsTracker.requests(), worker);
      expect(specificOptionsRequests).toHaveLength(0);

      const specificOptionsResponse = await fetch(`${baseURL}/filters/${1}`, { method: 'OPTIONS' });
      expect(specificOptionsResponse.status).toBe(200);

      specificOptionsRequests = await promiseIfRemote(specificOptionsTracker.requests(), worker);
      expect(specificOptionsRequests).toHaveLength(1);
      const [specificOptionsRequest] = specificOptionsRequests;
      expect(specificOptionsRequest).toBeInstanceOf(Request);

      expectTypeOf(specificOptionsRequest.body).toEqualTypeOf<null>();
      expect(specificOptionsRequest.body).toBe(null);

      expectTypeOf(specificOptionsRequest.response.status).toEqualTypeOf<200>();
      expect(specificOptionsRequest.response.status).toEqual(200);

      expectTypeOf(specificOptionsRequest.response.body).toEqualTypeOf<null>();
      expect(specificOptionsRequest.response.body).toBe(null);

      const unmatchedOptionsPromise = fetch(`${baseURL}/filters/${2}`, { method: 'OPTIONS' });
      await expectToThrowFetchError(unmatchedOptionsPromise);
    });
  });

  it('should not intercept a OPTIONS request without a registered response', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      let fetchPromise = fetch(`${baseURL}/filters`, { method: 'OPTIONS' });
      await expectToThrowFetchError(fetchPromise);

      const optionsTrackerWithoutResponse = await promiseIfRemote(interceptor.options('/filters'), worker);
      expect(optionsTrackerWithoutResponse).toBeInstanceOf(LocalHttpRequestTracker);

      let optionsRequestsWithoutResponse = await promiseIfRemote(optionsTrackerWithoutResponse.requests(), worker);
      expect(optionsRequestsWithoutResponse).toHaveLength(0);

      let [optionsRequestWithoutResponse] = optionsRequestsWithoutResponse;
      expectTypeOf<typeof optionsRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof optionsRequestWithoutResponse.response>().toEqualTypeOf<never>();

      fetchPromise = fetch(`${baseURL}/filters`, { method: 'OPTIONS' });
      await expectToThrowFetchError(fetchPromise);

      optionsRequestsWithoutResponse = await promiseIfRemote(optionsTrackerWithoutResponse.requests(), worker);
      expect(optionsRequestsWithoutResponse).toHaveLength(0);

      [optionsRequestWithoutResponse] = optionsRequestsWithoutResponse;
      expectTypeOf<typeof optionsRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof optionsRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const optionsTrackerWithResponse = optionsTrackerWithoutResponse.respond({
        status: 200,
      });

      const optionsResponse = await fetch(`${baseURL}/filters`, { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);

      expect(optionsRequestsWithoutResponse).toHaveLength(0);
      const optionsRequestsWithResponse = await promiseIfRemote(optionsTrackerWithResponse.requests(), worker);
      expect(optionsRequestsWithResponse).toHaveLength(1);

      const [optionsRequestWithResponse] = optionsRequestsWithResponse;
      expect(optionsRequestWithResponse).toBeInstanceOf(Request);
      expect(optionsRequestWithResponse.response.status).toEqual(200);

      expectTypeOf(optionsRequestWithResponse.body).toEqualTypeOf<null>();
      expect(optionsRequestWithResponse.body).toBe(null);

      expectTypeOf(optionsRequestWithResponse.response.status).toEqualTypeOf<200>();
      expect(optionsRequestWithResponse.response.status).toEqual(200);

      expectTypeOf(optionsRequestWithResponse.response.body).toEqualTypeOf<null>();
      expect(optionsRequestWithResponse.response.body).toBe(null);
    });
  });

  it('should consider only the last declared response when intercepting OPTIONS requests', async () => {
    type ServerErrorResponseBody = JSONValue<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: {};
            204: {};
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor
          .options('/filters')
          .respond({
            status: 200,
          })
          .respond({
            status: 204,
          }),
        worker,
      );

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(`${baseURL}/filters`, { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(204);

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(1);
      const [optionsRequest] = optionsRequests;
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<null>();
      expect(optionsRequest.body).toBe(null);

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<204>();
      expect(optionsRequest.response.status).toEqual(204);

      expectTypeOf(optionsRequest.response.body).toEqualTypeOf<null>();
      expect(optionsRequest.response.body).toBe(null);

      const errorOptionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        worker,
      );

      let errorOptionsRequests = await promiseIfRemote(errorOptionsTracker.requests(), worker);
      expect(errorOptionsRequests).toHaveLength(0);

      const otherOptionsResponse = await fetch(`${baseURL}/filters`, { method: 'OPTIONS' });
      expect(otherOptionsResponse.status).toBe(500);

      const serverError = (await otherOptionsResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(1);

      errorOptionsRequests = await promiseIfRemote(errorOptionsTracker.requests(), worker);
      expect(errorOptionsRequests).toHaveLength(1);
      const [errorOptionsRequest] = errorOptionsRequests;
      expect(errorOptionsRequest).toBeInstanceOf(Request);

      expectTypeOf(errorOptionsRequest.body).toEqualTypeOf<null>();
      expect(errorOptionsRequest.body).toBe(null);

      expectTypeOf(errorOptionsRequest.response.status).toEqualTypeOf<500>();
      expect(errorOptionsRequest.response.status).toEqual(500);

      expectTypeOf(errorOptionsRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorOptionsRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });
    });
  });

  it('should ignore trackers with bypassed responses when intercepting OPTIONS requests', async () => {
    type ServerErrorResponseBody = JSONValue<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: {};
            204: {};
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor
          .options('/filters')
          .respond({
            status: 200,
          })
          .bypass(),
        worker,
      );

      let initialOptionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(initialOptionsRequests).toHaveLength(0);

      const optionsPromise = fetch(`${baseURL}/filters`, { method: 'OPTIONS' });
      await expectToThrowFetchError(optionsPromise);

      const noContentOptionsTracker = await promiseIfRemote(
        optionsTracker.respond({
          status: 204,
        }),
        worker,
      );

      initialOptionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(initialOptionsRequests).toHaveLength(0);
      let optionsRequests = await promiseIfRemote(noContentOptionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(0);

      let optionsResponse = await fetch(`${baseURL}/filters`, { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(204);

      optionsRequests = await promiseIfRemote(noContentOptionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(1);
      let [optionsRequest] = optionsRequests;
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<null>();
      expect(optionsRequest.body).toBe(null);

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<204>();
      expect(optionsRequest.response.status).toEqual(204);

      expectTypeOf(optionsRequest.response.body).toEqualTypeOf<null>();
      expect(optionsRequest.response.body).toBe(null);

      const errorOptionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        worker,
      );

      let errorOptionsRequests = await promiseIfRemote(errorOptionsTracker.requests(), worker);
      expect(errorOptionsRequests).toHaveLength(0);

      const otherOptionsResponse = await fetch(`${baseURL}/filters`, { method: 'OPTIONS' });
      expect(otherOptionsResponse.status).toBe(500);

      const serverError = (await otherOptionsResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      optionsRequests = await promiseIfRemote(noContentOptionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(1);

      errorOptionsRequests = await promiseIfRemote(errorOptionsTracker.requests(), worker);
      expect(errorOptionsRequests).toHaveLength(1);
      const [errorOptionsRequest] = errorOptionsRequests;
      expect(errorOptionsRequest).toBeInstanceOf(Request);

      expectTypeOf(errorOptionsRequest.body).toEqualTypeOf<null>();
      expect(errorOptionsRequest.body).toBe(null);

      expectTypeOf(errorOptionsRequest.response.status).toEqualTypeOf<500>();
      expect(errorOptionsRequest.response.status).toEqual(500);

      expectTypeOf(errorOptionsRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorOptionsRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      await promiseIfRemote(errorOptionsTracker.bypass(), worker);

      optionsResponse = await fetch(`${baseURL}/filters`, { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(204);

      errorOptionsRequests = await promiseIfRemote(errorOptionsTracker.requests(), worker);
      expect(errorOptionsRequests).toHaveLength(1);

      optionsRequests = await promiseIfRemote(noContentOptionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(2);
      [optionsRequest] = optionsRequests;
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<null>();
      expect(optionsRequest.body).toBe(null);

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<204>();
      expect(optionsRequest.response.status).toEqual(204);

      expectTypeOf(optionsRequest.response.body).toEqualTypeOf<null>();
      expect(optionsRequest.response.body).toBe(null);
    });
  });

  it('should ignore all trackers after cleared when intercepting OPTIONS requests', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: {};
            204: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 200,
        }),
        worker,
      );

      await promiseIfRemote(interceptor.clear(), worker);

      const initialOptionsRequests = await promiseIfRemote(optionsTracker.requests(), worker);
      expect(initialOptionsRequests).toHaveLength(0);

      const optionsPromise = fetch(`${baseURL}/filters`, { method: 'OPTIONS' });
      await expectToThrowFetchError(optionsPromise);
    });
  });

  it('should support creating new trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: {};
            204: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 200,
        }),
        worker,
      );

      await promiseIfRemote(interceptor.clear(), worker);

      const noContentOptionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 204,
        }),
        worker,
      );

      let optionsRequests = await promiseIfRemote(noContentOptionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(`${baseURL}/filters`, { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(204);

      optionsRequests = await promiseIfRemote(noContentOptionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(1);
      const [optionsRequest] = optionsRequests;
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<null>();
      expect(optionsRequest.body).toBe(null);

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<204>();
      expect(optionsRequest.response.status).toEqual(204);

      expectTypeOf(optionsRequest.response.body).toEqualTypeOf<null>();
      expect(optionsRequest.response.body).toBe(null);
    });
  });

  it('should support reusing previous trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: {};
            204: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(interceptor.options('/filters'), worker);

      await promiseIfRemote(
        optionsTracker.respond({
          status: 200,
        }),
        worker,
      );

      await promiseIfRemote(interceptor.clear(), worker);

      const noContentOptionsTracker = await promiseIfRemote(
        optionsTracker.respond({
          status: 204,
        }),
        worker,
      );

      let optionsRequests = await promiseIfRemote(noContentOptionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(`${baseURL}/filters`, { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(204);

      optionsRequests = await promiseIfRemote(noContentOptionsTracker.requests(), worker);
      expect(optionsRequests).toHaveLength(1);
      const [optionsRequest] = optionsRequests;
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<null>();
      expect(optionsRequest.body).toBe(null);

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<204>();
      expect(optionsRequest.response.status).toEqual(204);

      expectTypeOf(optionsRequest.response.body).toEqualTypeOf<null>();
      expect(optionsRequest.response.body).toBe(null);
    });
  });
}
