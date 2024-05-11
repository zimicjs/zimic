import { beforeEach, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestTracker from '@/interceptor/http/requestTracker/LocalHttpRequestTracker';
import RemoteHttpRequestTracker from '@/interceptor/http/requestTracker/RemoteHttpRequestTracker';
import { DEFAULT_ACCESS_CONTROL_HEADERS, AccessControlHeaders } from '@/server/constants';
import { JSONValue } from '@/types/json';
import { fetchWithTimeout, joinURL } from '@/utils/fetch';
import { expectFetchError, expectFetchErrorOrPreflightResponse } from '@tests/utils/fetch';
import { createInternalHttpInterceptor, usingHttpInterceptor } from '@tests/utils/interceptors';

import NotStartedHttpInterceptorError from '../../../errors/NotStartedHttpInterceptorError';
import { HttpInterceptorOptions } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../types';

export function declareOptionsHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, getBaseURL, getInterceptorOptions } = options;

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Tracker: typeof LocalHttpRequestTracker | typeof RemoteHttpRequestTracker;

  let overridesPreflightResponse: boolean;
  let numberOfRequestsIncludingPrefetch: number;

  type MessageResponseBody = JSONValue<{
    message?: string;
  }>;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Tracker = options.type === 'local' ? LocalHttpRequestTracker : RemoteHttpRequestTracker;

    overridesPreflightResponse = options.type === 'remote';
    numberOfRequestsIncludingPrefetch = platform === 'browser' && options.type === 'remote' ? 2 : 1;
  });

  it('should support intercepting OPTIONS requests with a static response body', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: { headers: AccessControlHeaders };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
        }),
        interceptor,
      );
      expect(optionsTracker).toBeInstanceOf(Tracker);

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
      const optionsRequest = optionsRequests[numberOfRequestsIncludingPrefetch - 1];
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
          response: {
            200: { headers: AccessControlHeaders };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          };
        }),
        interceptor,
      );
      expect(optionsTracker).toBeInstanceOf(Tracker);

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });

      expect(optionsResponse.status).toBe(200);

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
      const optionsRequest = optionsRequests[numberOfRequestsIncludingPrefetch - 1];
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<null>();
      expect(optionsRequest.body).toBe(null);

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

    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          request: {
            headers: FilterOptionsRequestHeaders;
          };
          response: {
            200: {
              headers: AccessControlHeaders;
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
          expect(['application/json', '*/*']).toContain(acceptHeader);

          return {
            status: 200,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          };
        }),
        interceptor,
      );
      expect(optionsTracker).toBeInstanceOf(Tracker);

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(joinURL(baseURL, '/filters'), {
        method: 'OPTIONS',
        headers: {
          accept: 'application/json',
        } satisfies FilterOptionsRequestHeaders,
      });
      expect(optionsResponse.status).toBe(200);

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
      const optionsRequest = optionsRequests[numberOfRequestsIncludingPrefetch - 1];
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.headers).toEqualTypeOf<HttpHeaders<FilterOptionsRequestHeaders>>();
      expect(optionsRequest.headers).toBeInstanceOf(HttpHeaders);
      expect(optionsRequest.headers.get('accept')).toBe('application/json');

      expectTypeOf(optionsRequest.response.headers).toEqualTypeOf<HttpHeaders<AccessControlHeaders>>();
      expect(optionsRequest.response.headers).toBeInstanceOf(HttpHeaders);
      expect(Object.fromEntries(optionsRequest.response.headers.entries())).toEqual(
        expect.objectContaining(DEFAULT_ACCESS_CONTROL_HEADERS),
      );
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
            200: { headers: AccessControlHeaders };
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
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          };
        }),
        interceptor,
      );
      expect(optionsTracker).toBeInstanceOf(Tracker);

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<FiltersOptionsSearchParams>({
        tag: 'admin',
      });

      const optionsResponse = await fetch(joinURL(baseURL, `/filters?${searchParams.toString()}`), {
        method: 'OPTIONS',
      });
      expect(optionsResponse.status).toBe(200);

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
      const optionsRequest = optionsRequests[numberOfRequestsIncludingPrefetch - 1];
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
            200: { headers: AccessControlHeaders };
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

            const acceptHeader = request.headers.get('accept');
            return acceptHeader ? acceptHeader.includes('application/json') : false;
          })
          .respond((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<FiltersOptionsHeaders>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            return {
              status: 200,
              headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            };
          }),
        interceptor,
      );
      expect(optionsTracker).toBeInstanceOf(Tracker);

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(0);

      const headers = new HttpHeaders<FiltersOptionsHeaders>({
        'content-type': 'application/json',
        accept: 'application/json',
      });

      let optionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS', headers });
      expect(optionsResponse.status).toBe(200);
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(1);

      headers.append('accept', 'application/xml');

      optionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS', headers });
      expect(optionsResponse.status).toBe(200);
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(2);

      headers.delete('accept');

      let optionsResponsePromise = fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS', headers });
      await expectFetchErrorOrPreflightResponse(optionsResponsePromise, {
        shouldBePreflight: overridesPreflightResponse,
      });
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(2);

      headers.delete('content-type');

      optionsResponsePromise = fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS', headers });
      await expectFetchErrorOrPreflightResponse(optionsResponsePromise, {
        shouldBePreflight: overridesPreflightResponse,
      });
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(2);

      headers.set('accept', 'application/json');
      headers.set('content-type', 'text/plain');

      optionsResponsePromise = fetch(joinURL(baseURL, `/users`), { method: 'OPTIONS', headers });
      await expectFetchErrorOrPreflightResponse(optionsResponsePromise, {
        shouldBePreflight: overridesPreflightResponse,
      });
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
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
            200: {
              headers: AccessControlHeaders;
            };
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
              headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            };
          }),
        interceptor,
      );
      expect(optionsTracker).toBeInstanceOf(Tracker);

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<FiltersOptionsSearchParams>({
        tag: 'admin',
      });

      const optionsResponse = await fetch(joinURL(baseURL, `/filters?${searchParams.toString()}`), {
        method: 'OPTIONS',
      });
      expect(optionsResponse.status).toBe(200);
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);

      searchParams.delete('tag');

      const optionsResponsePromise = fetch(joinURL(baseURL, `/filters?${searchParams.toString()}`), {
        method: 'OPTIONS',
      });
      await expectFetchErrorOrPreflightResponse(optionsResponsePromise, {
        shouldBePreflight: overridesPreflightResponse,
      });
      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
    });
  });

  it('should support intercepting OPTIONS requests with a dynamic path', async () => {
    await usingHttpInterceptor<{
      '/filters/:id': {
        OPTIONS: {
          response: {
            200: { headers: AccessControlHeaders };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const genericOptionsTracker = await promiseIfRemote(
        interceptor.options('/filters/:id').respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
        }),
        interceptor,
      );
      expect(genericOptionsTracker).toBeInstanceOf(Tracker);

      let genericOptionsRequests = await promiseIfRemote(genericOptionsTracker.requests(), interceptor);
      expect(genericOptionsRequests).toHaveLength(0);

      const genericOptionsResponse = await fetch(joinURL(baseURL, `/filters/${1}`), { method: 'OPTIONS' });
      expect(genericOptionsResponse.status).toBe(200);

      genericOptionsRequests = await promiseIfRemote(genericOptionsTracker.requests(), interceptor);
      expect(genericOptionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
      const genericOptionsRequest = genericOptionsRequests[numberOfRequestsIncludingPrefetch - 1];
      expect(genericOptionsRequest).toBeInstanceOf(Request);

      expectTypeOf(genericOptionsRequest.body).toEqualTypeOf<null>();
      expect(genericOptionsRequest.body).toBe(null);

      expectTypeOf(genericOptionsRequest.response.status).toEqualTypeOf<200>();
      expect(genericOptionsRequest.response.status).toEqual(200);

      expectTypeOf(genericOptionsRequest.response.body).toEqualTypeOf<null>();
      expect(genericOptionsRequest.response.body).toBe(null);

      await promiseIfRemote(genericOptionsTracker.bypass(), interceptor);

      const specificOptionsTracker = await promiseIfRemote(
        interceptor.options(`/filters/${1}`).respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
        }),
        interceptor,
      );
      expect(specificOptionsTracker).toBeInstanceOf(Tracker);

      let specificOptionsRequests = await promiseIfRemote(specificOptionsTracker.requests(), interceptor);
      expect(specificOptionsRequests).toHaveLength(0);

      const specificOptionsResponse = await fetch(joinURL(baseURL, `/filters/${1}`), { method: 'OPTIONS' });
      expect(specificOptionsResponse.status).toBe(200);

      specificOptionsRequests = await promiseIfRemote(specificOptionsTracker.requests(), interceptor);
      expect(specificOptionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
      const specificOptionsRequest = specificOptionsRequests[numberOfRequestsIncludingPrefetch - 1];
      expect(specificOptionsRequest).toBeInstanceOf(Request);

      expectTypeOf(specificOptionsRequest.body).toEqualTypeOf<null>();
      expect(specificOptionsRequest.body).toBe(null);

      expectTypeOf(specificOptionsRequest.response.status).toEqualTypeOf<200>();
      expect(specificOptionsRequest.response.status).toEqual(200);

      expectTypeOf(specificOptionsRequest.response.body).toEqualTypeOf<null>();
      expect(specificOptionsRequest.response.body).toBe(null);

      const unmatchedOptionsPromise = fetch(joinURL(baseURL, `/filters/${2}`), { method: 'OPTIONS' });
      await expectFetchErrorOrPreflightResponse(unmatchedOptionsPromise, {
        shouldBePreflight: overridesPreflightResponse,
      });
    });
  });

  it('should result in a browser error after returning a remote OPTIONS request without proper access-control headers', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: { headers: {} };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 200,
          headers: {},
        }),
        interceptor,
      );

      const initialOptionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(initialOptionsRequests).toHaveLength(0);

      const optionsPromise = fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });

      if (options.type === 'remote' && platform === 'browser') {
        await expectFetchError(optionsPromise);
      } else {
        const optionsResponse = await optionsPromise;
        expect(optionsResponse.status).toBe(200);
      }
    });
  });

  it('should not intercept an OPTIONS request without a registered response', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: { headers: AccessControlHeaders };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      let fetchPromise = fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      await expectFetchErrorOrPreflightResponse(fetchPromise, {
        shouldBePreflight: overridesPreflightResponse,
      });

      const optionsTrackerWithoutResponse = await promiseIfRemote(interceptor.options('/filters'), interceptor);
      expect(optionsTrackerWithoutResponse).toBeInstanceOf(Tracker);

      let optionsRequestsWithoutResponse = await promiseIfRemote(optionsTrackerWithoutResponse.requests(), interceptor);
      expect(optionsRequestsWithoutResponse).toHaveLength(0);

      let optionsRequestWithoutResponse = optionsRequestsWithoutResponse[numberOfRequestsIncludingPrefetch - 1];
      expectTypeOf<typeof optionsRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof optionsRequestWithoutResponse.response>().toEqualTypeOf<never>();

      fetchPromise = fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      await expectFetchErrorOrPreflightResponse(fetchPromise, {
        shouldBePreflight: overridesPreflightResponse,
      });

      optionsRequestsWithoutResponse = await promiseIfRemote(optionsTrackerWithoutResponse.requests(), interceptor);
      expect(optionsRequestsWithoutResponse).toHaveLength(0);

      optionsRequestWithoutResponse = optionsRequestsWithoutResponse[numberOfRequestsIncludingPrefetch];
      expectTypeOf<typeof optionsRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof optionsRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const optionsTrackerWithResponse = optionsTrackerWithoutResponse.respond({
        status: 200,
        headers: DEFAULT_ACCESS_CONTROL_HEADERS,
      });

      const optionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);

      expect(optionsRequestsWithoutResponse).toHaveLength(0);
      const optionsRequestsWithResponse = await promiseIfRemote(optionsTrackerWithResponse.requests(), interceptor);
      expect(optionsRequestsWithResponse).toHaveLength(numberOfRequestsIncludingPrefetch);

      const optionsRequestWithResponse = optionsRequestsWithResponse[numberOfRequestsIncludingPrefetch - 1];
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
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: {
              headers: AccessControlHeaders;
              body: MessageResponseBody;
            };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          body: {},
        }),
        interceptor,
      );

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);

      const optionsResponseBody = (await optionsResponse.json()) as MessageResponseBody;
      expect(optionsResponseBody).toEqual<MessageResponseBody>({});

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
      const optionsRequest = optionsRequests[numberOfRequestsIncludingPrefetch - 1];
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<null>();
      expect(optionsRequest.body).toBe(null);

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<200>();
      expect(optionsRequest.response.status).toEqual(200);

      expectTypeOf(optionsRequest.response.body).toEqualTypeOf<MessageResponseBody>();
      expect(optionsRequest.response.body).toEqual<MessageResponseBody>({});

      const optionsWithMessageTracker = await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          body: { message: 'ok' },
        }),
        interceptor,
      );

      let optionsWithMessageRequests = await promiseIfRemote(optionsWithMessageTracker.requests(), interceptor);
      expect(optionsWithMessageRequests).toHaveLength(0);

      const otherOptionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      expect(otherOptionsResponse.status).toBe(200);

      const otherOptionsResponseBody = (await otherOptionsResponse.json()) as MessageResponseBody;
      expect(otherOptionsResponseBody).toEqual<MessageResponseBody>({ message: 'ok' });

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);

      optionsWithMessageRequests = await promiseIfRemote(optionsWithMessageTracker.requests(), interceptor);
      expect(optionsWithMessageRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
      const optionsWithMessageRequest = optionsWithMessageRequests[numberOfRequestsIncludingPrefetch - 1];
      expect(optionsWithMessageRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsWithMessageRequest.body).toEqualTypeOf<null>();
      expect(optionsWithMessageRequest.body).toBe(null);

      expectTypeOf(optionsWithMessageRequest.response.status).toEqualTypeOf<200>();
      expect(optionsWithMessageRequest.response.status).toEqual(200);

      expectTypeOf(optionsWithMessageRequest.response.body).toEqualTypeOf<MessageResponseBody>();
      expect(optionsWithMessageRequest.response.body).toEqual<MessageResponseBody>({ message: 'ok' });
    });
  });

  it('should ignore trackers with bypassed responses when intercepting OPTIONS requests', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: {
              headers: AccessControlHeaders;
              body: MessageResponseBody;
            };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor
          .options('/filters')
          .respond({
            status: 200,
            headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            body: {},
          })
          .bypass(),
        interceptor,
      );

      let initialOptionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(initialOptionsRequests).toHaveLength(0);

      const optionsPromise = fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      await expectFetchErrorOrPreflightResponse(optionsPromise, {
        shouldBePreflight: overridesPreflightResponse,
      });

      const otherOptionsTracker = await promiseIfRemote(
        optionsTracker.respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          body: { message: 'ok' },
        }),
        interceptor,
      );

      initialOptionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(initialOptionsRequests).toHaveLength(0);
      let optionsRequests = await promiseIfRemote(otherOptionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(0);

      let optionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);

      let optionsResponseBody = (await optionsResponse.json()) as MessageResponseBody;
      expect(optionsResponseBody).toEqual<MessageResponseBody>({ message: 'ok' });

      optionsRequests = await promiseIfRemote(otherOptionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
      let optionsRequest = optionsRequests[numberOfRequestsIncludingPrefetch - 1];
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<null>();
      expect(optionsRequest.body).toBe(null);

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<200>();
      expect(optionsRequest.response.status).toEqual(200);

      expectTypeOf(optionsRequest.response.body).toEqualTypeOf<MessageResponseBody>();
      expect(optionsRequest.response.body).toEqual<MessageResponseBody>({ message: 'ok' });

      const optionsTrackerWithMessage = await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
          body: { message: 'other-ok' },
        }),
        interceptor,
      );

      let optionsWithMessageRequests = await promiseIfRemote(optionsTrackerWithMessage.requests(), interceptor);
      expect(optionsWithMessageRequests).toHaveLength(0);

      const otherOptionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      expect(otherOptionsResponse.status).toBe(200);

      optionsResponseBody = (await otherOptionsResponse.json()) as MessageResponseBody;
      expect(optionsResponseBody).toEqual<MessageResponseBody>({ message: 'other-ok' });

      optionsRequests = await promiseIfRemote(otherOptionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);

      optionsWithMessageRequests = await promiseIfRemote(optionsTrackerWithMessage.requests(), interceptor);
      expect(optionsWithMessageRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
      const optionsWithMessageRequest = optionsWithMessageRequests[numberOfRequestsIncludingPrefetch - 1];
      expect(optionsWithMessageRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsWithMessageRequest.body).toEqualTypeOf<null>();
      expect(optionsWithMessageRequest.body).toBe(null);

      expectTypeOf(optionsWithMessageRequest.response.status).toEqualTypeOf<200>();
      expect(optionsWithMessageRequest.response.status).toEqual(200);

      expectTypeOf(optionsWithMessageRequest.response.body).toEqualTypeOf<MessageResponseBody>();
      expect(optionsWithMessageRequest.response.body).toEqual<MessageResponseBody>({ message: 'other-ok' });

      await promiseIfRemote(optionsTrackerWithMessage.bypass(), interceptor);

      optionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);

      optionsResponseBody = (await optionsResponse.json()) as MessageResponseBody;
      expect(optionsResponseBody).toEqual<MessageResponseBody>({ message: 'ok' });

      optionsWithMessageRequests = await promiseIfRemote(optionsTrackerWithMessage.requests(), interceptor);
      expect(optionsWithMessageRequests).toHaveLength(numberOfRequestsIncludingPrefetch);

      optionsRequests = await promiseIfRemote(otherOptionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch * 2);
      optionsRequest = optionsRequests[numberOfRequestsIncludingPrefetch - 1];
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<null>();
      expect(optionsRequest.body).toBe(null);

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<200>();
      expect(optionsRequest.response.status).toEqual(200);

      expectTypeOf(optionsRequest.response.body).toEqualTypeOf<MessageResponseBody>();
      expect(optionsRequest.response.body).toEqual<MessageResponseBody>({ message: 'ok' });
    });
  });

  it('should ignore all trackers after cleared when intercepting OPTIONS requests', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: { headers: AccessControlHeaders };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
        }),
        interceptor,
      );

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);

      await promiseIfRemote(interceptor.clear(), interceptor);

      const optionsPromise = fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      await expectFetchErrorOrPreflightResponse(optionsPromise, {
        shouldBePreflight: overridesPreflightResponse,
      });

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
    });
  });

  it('should ignore all trackers after restarted when intercepting OPTIONS requests', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: { headers: AccessControlHeaders };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
        }),
        interceptor,
      );

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);

      expect(interceptor.isRunning()).toBe(true);
      await interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);

      let optionsPromise = fetchWithTimeout(joinURL(baseURL, '/filters'), {
        method: 'OPTIONS',
        timeout: 200,
      });
      await expectFetchErrorOrPreflightResponse(optionsPromise, {
        shouldBePreflight: overridesPreflightResponse,
        canBeAborted: true,
      });

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);

      await interceptor.start();
      expect(interceptor.isRunning()).toBe(true);

      optionsPromise = fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      await expectFetchErrorOrPreflightResponse(optionsPromise, {
        shouldBePreflight: overridesPreflightResponse,
      });

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
    });
  });

  it('should ignore all trackers after restarted when intercepting OPTIONS requests, even if another interceptor is still running', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: { headers: AccessControlHeaders };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
        }),
        interceptor,
      );

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);

      await usingHttpInterceptor(interceptorOptions, async (otherInterceptor) => {
        expect(interceptor.isRunning()).toBe(true);
        expect(otherInterceptor.isRunning()).toBe(true);

        await interceptor.stop();
        expect(interceptor.isRunning()).toBe(false);
        expect(otherInterceptor.isRunning()).toBe(true);

        let optionsPromise = fetchWithTimeout(joinURL(baseURL, '/filters'), {
          method: 'OPTIONS',
          timeout: 200,
        });
        await expectFetchErrorOrPreflightResponse(optionsPromise, {
          shouldBePreflight: overridesPreflightResponse,
          canBeAborted: true,
        });

        optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
        expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);

        await interceptor.start();
        expect(interceptor.isRunning()).toBe(true);
        expect(otherInterceptor.isRunning()).toBe(true);

        optionsPromise = fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
        await expectFetchErrorOrPreflightResponse(optionsPromise, {
          shouldBePreflight: overridesPreflightResponse,
        });

        optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
        expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
      });
    });
  });

  it('should throw an error when trying to create a OPTIONS request tracker if not running', async () => {
    const interceptor = createInternalHttpInterceptor(interceptorOptions);
    expect(interceptor.isRunning()).toBe(false);

    await expect(async () => {
      await interceptor.options('/');
    }).rejects.toThrowError(new NotStartedHttpInterceptorError());
  });

  it('should support creating new trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: { headers: AccessControlHeaders };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
        }),
        interceptor,
      );

      await promiseIfRemote(interceptor.clear(), interceptor);

      const optionsTracker = await promiseIfRemote(
        interceptor.options('/filters').respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
        }),
        interceptor,
      );

      let optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);

      optionsRequests = await promiseIfRemote(optionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
      const optionsRequest = optionsRequests[numberOfRequestsIncludingPrefetch - 1];
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<null>();
      expect(optionsRequest.body).toBe(null);

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<200>();
      expect(optionsRequest.response.status).toEqual(200);

      expectTypeOf(optionsRequest.response.body).toEqualTypeOf<null>();
      expect(optionsRequest.response.body).toBe(null);
    });
  });

  it('should support reusing previous trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/filters': {
        OPTIONS: {
          response: {
            200: { headers: AccessControlHeaders };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const optionsTracker = await promiseIfRemote(interceptor.options('/filters'), interceptor);

      await promiseIfRemote(
        optionsTracker.respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
        }),
        interceptor,
      );

      await promiseIfRemote(interceptor.clear(), interceptor);

      const otherOptionsTracker = await promiseIfRemote(
        optionsTracker.respond({
          status: 200,
          headers: DEFAULT_ACCESS_CONTROL_HEADERS,
        }),
        interceptor,
      );

      let optionsRequests = await promiseIfRemote(otherOptionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(0);

      const optionsResponse = await fetch(joinURL(baseURL, '/filters'), { method: 'OPTIONS' });
      expect(optionsResponse.status).toBe(200);

      optionsRequests = await promiseIfRemote(otherOptionsTracker.requests(), interceptor);
      expect(optionsRequests).toHaveLength(numberOfRequestsIncludingPrefetch);
      const optionsRequest = optionsRequests[numberOfRequestsIncludingPrefetch - 1];
      expect(optionsRequest).toBeInstanceOf(Request);

      expectTypeOf(optionsRequest.body).toEqualTypeOf<null>();
      expect(optionsRequest.body).toBe(null);

      expectTypeOf(optionsRequest.response.status).toEqualTypeOf<200>();
      expect(optionsRequest.response.status).toEqual(200);

      expectTypeOf(optionsRequest.response.body).toEqualTypeOf<null>();
      expect(optionsRequest.response.body).toBe(null);
    });
  });
}
