import { expectTypeOf, expect, vi, it, beforeAll, afterAll, describe } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpRequest, HttpResponse } from '@/http/types/requests';
import { HttpSchema } from '@/http/types/schema';
import { SharedHttpInterceptorClient } from '@/interceptor/http/interceptor/HttpInterceptorClient';
import LocalHttpInterceptor from '@/interceptor/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/interceptor/http/interceptor/RemoteHttpInterceptor';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import HttpInterceptorWorker from '@/interceptor/http/interceptorWorker/HttpInterceptorWorker';
import LocalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/RemoteHttpInterceptorWorker';
import {
  HttpInterceptorWorkerPlatform,
  HttpInterceptorWorkerType,
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from '@/interceptor/http/interceptorWorker/types/options';
import { PossiblePromise } from '@/types/utils';
import { createInternalHttpInterceptorWorker, createInternalHttpInterceptor } from '@tests/utils/interceptors';
import { AccessResources } from '@tests/utils/workers';

import NoResponseDefinitionError from '../../errors/NoResponseDefinitionError';
import LocalHttpRequestTracker from '../../LocalHttpRequestTracker';
import RemoteHttpRequestTracker from '../../RemoteHttpRequestTracker';
import {
  HttpInterceptorRequest,
  HttpRequestTrackerResponseDeclaration,
  HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES,
  HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES,
} from '../../types/requests';

export function declareSharedHttpRequestTrackerTests(options: {
  platform: HttpInterceptorWorkerPlatform;
  startServer?: () => PossiblePromise<void>;
  getAccessResources: (type: HttpInterceptorWorkerType) => Promise<AccessResources>;
  stopServer?: () => PossiblePromise<void>;
}) {
  const { platform, startServer, getAccessResources, stopServer } = options;

  const optionsArray: (
    | { Tracker: typeof LocalHttpRequestTracker; workerOptions: LocalHttpInterceptorWorkerOptions }
    | { Tracker: typeof RemoteHttpRequestTracker; workerOptions: RemoteHttpInterceptorWorkerOptions }
  )[] = [
    {
      Tracker: LocalHttpRequestTracker,
      workerOptions: { type: 'local' },
    },
    {
      Tracker: RemoteHttpRequestTracker,
      workerOptions: { type: 'remote', serverURL: '<temporary>' },
    },
  ];

  describe.each(optionsArray)('Shared (type $workerOptions.type)', ({ Tracker, workerOptions }) => {
    type HeadersSchema = HttpSchema.Headers<{
      accept?: string;
      'content-type'?: string;
    }>;

    type SearchParamsSchema = HttpSchema.SearchParams<{
      name?: string;
      other?: string;
    }>;

    type MethodSchema = HttpSchema.Method<{
      request: {
        headers: HeadersSchema;
        searchParams: SearchParamsSchema;
        body: {
          name?: string;
          value?: number[];
        };
      };
      response: {
        200: {
          body: { success: true };
        };
      };
    }>;

    type Schema = HttpSchema.Paths<{
      '/users': {
        POST: MethodSchema;
      };
    }>;

    let baseURL: string;
    let pathPrefix: string;

    let worker: LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker;
    let interceptor: LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>;
    let interceptorClient: SharedHttpInterceptorClient<Schema>;

    beforeAll(async () => {
      if (workerOptions.type === 'remote') {
        await startServer?.();
      }

      ({ baseURL, pathPrefix } = await getAccessResources(workerOptions.type));

      worker = createInternalHttpInterceptorWorker(
        workerOptions.type === 'local' ? workerOptions : { ...workerOptions, serverURL: baseURL },
      );

      interceptor = createInternalHttpInterceptor<Schema>(
        worker instanceof LocalHttpInterceptorWorker ? { worker, baseURL } : { worker, pathPrefix },
      );

      interceptorClient = interceptor.client() as SharedHttpInterceptorClient<Schema>;

      await worker.start();
      expect(worker.platform()).toBe(platform);
    });

    afterAll(async () => {
      await worker.stop();

      if (workerOptions.type === 'remote') {
        await stopServer?.();
      }
    });

    it('should provide access to the method and path', () => {
      const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

      expectTypeOf<typeof tracker.method>().toEqualTypeOf<() => 'POST'>();
      expect(tracker.method()).toBe('POST');

      expectTypeOf<typeof tracker.path>().toEqualTypeOf<() => '/users'>();
      expect(tracker.path()).toBe('/users');
    });

    it('should not match any request if contains no declared response', async () => {
      const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

      const request = new Request(baseURL);
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);
    });

    it('should match any request if contains a declared response and no restrictions', async () => {
      const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
        status: 200,
        body: { success: true },
      });

      const request = new Request(baseURL);
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
      expect(tracker.matchesRequest(parsedRequest)).toBe(true);

      await promiseIfRemote(tracker.with({}), worker);

      expect(tracker.matchesRequest(parsedRequest)).toBe(true);
    });

    it('should not match any request if bypassed', async () => {
      const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

      const request = new Request(baseURL);
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      await promiseIfRemote(tracker.bypass(), worker);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      await promiseIfRemote(
        tracker.respond({
          status: 200,
          body: { success: true },
        }),
        worker,
      );
      expect(tracker.matchesRequest(parsedRequest)).toBe(true);

      await promiseIfRemote(tracker.bypass(), worker);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      await promiseIfRemote(
        tracker.respond({
          status: 200,
          body: { success: true },
        }),
        worker,
      );
      expect(tracker.matchesRequest(parsedRequest)).toBe(true);
    });

    it('should not match any request if cleared', async () => {
      const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

      const request = new Request(baseURL);
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      await promiseIfRemote(tracker.clear(), worker);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      await promiseIfRemote(
        tracker.respond({
          status: 200,
          body: { success: true },
        }),
        worker,
      );
      expect(tracker.matchesRequest(parsedRequest)).toBe(true);

      await promiseIfRemote(tracker.clear(), worker);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      await promiseIfRemote(
        tracker.respond({
          status: 200,
          body: { success: true },
        }),
        worker,
      );
      expect(tracker.matchesRequest(parsedRequest)).toBe(true);
    });

    it('should create response with declared status and body', async () => {
      const responseStatus = 200;
      const responseBody = { success: true } as const;

      const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
        status: responseStatus,
        body: responseBody,
      });

      const request = new Request(baseURL);
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
      const response = await tracker.applyResponseDeclaration(parsedRequest);

      expect(response.status).toBe(responseStatus);
      expect(response.body).toEqual(responseBody);
    });

    it('should create response with declared status and body factory', async () => {
      const responseStatus = 200;
      const responseBody = { success: true } as const;

      const responseFactory = vi.fn<
        [HttpInterceptorRequest<MethodSchema>],
        HttpRequestTrackerResponseDeclaration<MethodSchema, 200>
      >(() => ({
        status: responseStatus,
        body: responseBody,
      }));

      const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');
      await promiseIfRemote(tracker.respond(responseFactory), worker);

      const request = new Request(baseURL);
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
      const response = await tracker.applyResponseDeclaration(parsedRequest);

      expect(response.status).toBe(responseStatus);
      expect(response.body).toEqual(responseBody);

      expect(responseFactory).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if trying to create a response without a declared response', async () => {
      const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

      const request = new Request(baseURL);
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);

      await expect(async () => {
        await tracker.applyResponseDeclaration(parsedRequest);
      }).rejects.toThrowError(new NoResponseDefinitionError());
    });

    it('should keep track of the intercepted requests and responses', async () => {
      const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
        status: 200,
        body: { success: true },
      });

      const firstRequest = new Request(baseURL);
      const parsedFirstRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(firstRequest);

      const firstResponseDeclaration = await tracker.applyResponseDeclaration(parsedFirstRequest);
      const firstResponse = Response.json(firstResponseDeclaration.body, {
        status: firstResponseDeclaration.status,
      });
      const firstResponseClone = firstResponse.clone();
      const parsedFirstResponse = await LocalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(firstResponse);

      tracker.registerInterceptedRequest(parsedFirstRequest, parsedFirstResponse);

      let interceptedRequests = await promiseIfRemote(tracker.requests(), worker);
      expect(interceptedRequests).toHaveLength(1);

      expect(interceptedRequests[0].url).toEqual(firstRequest.url);
      expect(interceptedRequests[0].method).toEqual(firstRequest.method);
      expect(interceptedRequests[0].response.status).toEqual(firstResponse.status);
      expect(interceptedRequests[0].response.body).toEqual(await firstResponse.json());

      const secondRequest = new Request(`${baseURL}/path`);
      const parsedSecondRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(secondRequest);
      const secondResponseDeclaration = await tracker.applyResponseDeclaration(parsedSecondRequest);

      const secondResponse = Response.json(secondResponseDeclaration.body, {
        status: secondResponseDeclaration.status,
      });
      const parsedSecondResponse = await LocalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(secondResponse);

      tracker.registerInterceptedRequest(parsedSecondRequest, parsedSecondResponse);

      expect(interceptedRequests).toHaveLength(1);
      interceptedRequests = await promiseIfRemote(tracker.requests(), worker);
      expect(interceptedRequests).toHaveLength(2);

      expect(interceptedRequests[0].url).toEqual(firstRequest.url);
      expect(interceptedRequests[0].method).toEqual(firstRequest.method);
      expect(interceptedRequests[0].response.status).toEqual(firstResponse.status);
      expect(interceptedRequests[0].response.body).toEqual(await firstResponseClone.json());

      expect(interceptedRequests[1].url).toEqual(secondRequest.url);
      expect(interceptedRequests[1].method).toEqual(secondRequest.method);
      expect(interceptedRequests[1].response.status).toEqual(secondResponse.status);
      expect(interceptedRequests[1].response.body).toEqual(await secondResponse.json());
    });

    it('should clear the intercepted requests and responses after cleared', async () => {
      const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
        status: 200,
        body: { success: true },
      });

      const firstRequest = new Request(baseURL);
      const parsedFirstRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(firstRequest);

      const firstResponseDeclaration = await tracker.applyResponseDeclaration(parsedFirstRequest);
      const firstResponse = Response.json(firstResponseDeclaration.body, {
        status: firstResponseDeclaration.status,
      });
      const firstResponseClone = firstResponse.clone();
      const parsedFirstResponse = await LocalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(firstResponse);

      tracker.registerInterceptedRequest(parsedFirstRequest, parsedFirstResponse);

      let interceptedRequests = await promiseIfRemote(tracker.requests(), worker);
      expect(interceptedRequests).toHaveLength(1);

      expect(interceptedRequests[0].url).toEqual(firstRequest.url);
      expect(interceptedRequests[0].method).toEqual(firstRequest.method);
      expect(interceptedRequests[0].response.status).toEqual(firstResponse.status);
      expect(interceptedRequests[0].response.body).toEqual(await firstResponseClone.json());

      await promiseIfRemote(tracker.clear(), worker);

      expect(interceptedRequests).toHaveLength(1);
      interceptedRequests = await promiseIfRemote(tracker.requests(), worker);
      expect(interceptedRequests).toHaveLength(0);
    });

    it('should provide access to the raw intercepted requests and responses', async () => {
      const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
        status: 200,
        body: { success: true },
      });

      const request = new Request(baseURL, {
        method: 'POST',
        body: JSON.stringify({ name: 'User' } satisfies MethodSchema['request']['body']),
      });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);

      const responseDeclaration = await tracker.applyResponseDeclaration(parsedRequest);
      const response = Response.json(responseDeclaration.body, { status: responseDeclaration.status });
      const parsedResponse = await LocalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(response);

      tracker.registerInterceptedRequest(parsedRequest, parsedResponse);

      const interceptedRequests = await promiseIfRemote(tracker.requests(), worker);
      expect(interceptedRequests).toHaveLength(1);

      expect(interceptedRequests[0]).toEqual(parsedRequest);

      expectTypeOf(interceptedRequests[0].raw).toEqualTypeOf<HttpRequest<MethodSchema['request']['body']>>();
      expect(interceptedRequests[0].raw).toBeInstanceOf(Request);
      expect(interceptedRequests[0].raw.url).toBe(request.url);
      expect(interceptedRequests[0].raw.method).toBe('POST');
      expect(interceptedRequests[0].raw.headers).toEqual(request.headers);
      expectTypeOf(interceptedRequests[0].raw.json).toEqualTypeOf<() => Promise<MethodSchema['request']['body']>>();
      expect(await interceptedRequests[0].raw.json()).toEqual<MethodSchema['request']['body']>({ name: 'User' });

      expect(interceptedRequests[0].response).toEqual(parsedResponse);

      expectTypeOf(interceptedRequests[0].response.raw).toEqualTypeOf<HttpResponse<{ success: true }, 200>>();
      expect(interceptedRequests[0].response.raw).toBeInstanceOf(Response);
      expect(interceptedRequests[0].response.raw.status).toBe(200);
      expect(interceptedRequests[0].response.raw.headers).toEqual(response.headers);
      expectTypeOf(interceptedRequests[0].response.raw.json).toEqualTypeOf<() => Promise<{ success: true }>>();
      expect(await interceptedRequests[0].response.raw.json()).toEqual<MethodSchema['response'][200]['body']>({
        success: true,
      });
    });

    it('should provide no access to hidden properties in raw intercepted requests and responses', async () => {
      const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
        status: 200,
        body: { success: true },
      });

      const request = new Request(baseURL);
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);

      const responseDeclaration = await tracker.applyResponseDeclaration(parsedRequest);
      const response = Response.json(responseDeclaration.body, { status: responseDeclaration.status });
      const parsedResponse = await LocalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(response);

      tracker.registerInterceptedRequest(parsedRequest, parsedResponse);

      const interceptedRequests = await promiseIfRemote(tracker.requests(), worker);
      expect(interceptedRequests).toHaveLength(1);

      expect(interceptedRequests[0]).toEqual(parsedRequest);

      for (const hiddenProperty of HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES) {
        expect(interceptedRequests[0]).not.toHaveProperty(hiddenProperty);
        // @ts-expect-error Trying to access the hidden property.
        expect(interceptedRequests[0][hiddenProperty]).toBe(undefined);
      }

      expect(interceptedRequests[0].response).toEqual(parsedResponse);

      for (const hiddenProperty of HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES) {
        expect(interceptedRequests[0].response).not.toHaveProperty(hiddenProperty);
        // @ts-expect-error Trying to access the hidden property.
        expect(interceptedRequests[0].response[hiddenProperty]).toBe(undefined);
      }
    });

    describe('Restrictions', () => {
      describe('By search params', () => {
        it.each([{ exact: true }])(
          'should match only specific requests if contains a declared response, a static search param restriction, and exact: $exact',
          async ({ exact }) => {
            const name = 'User';

            const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
              .with({
                searchParams: { name },
                exact,
              })
              .respond({
                status: 200,
                body: { success: true },
              });

            for (const matchingSearchParams of [new HttpSearchParams<SearchParamsSchema>({ name })]) {
              const matchingRequest = new Request(`${baseURL}?${matchingSearchParams.toString()}`);
              const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(matchingRequest);
              expect(tracker.matchesRequest(parsedRequest)).toBe(true);
            }

            for (const mismatchingSearchParams of [
              new HttpSearchParams<SearchParamsSchema>({ name, other: 'param' }),
              new HttpSearchParams<SearchParamsSchema>({ name: `${name} other` }),
              new HttpSearchParams<SearchParamsSchema>({}),
            ]) {
              const request = new Request(`${baseURL}?${mismatchingSearchParams.toString()}`);
              const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
              expect(tracker.matchesRequest(parsedRequest)).toBe(false);
            }
          },
        );

        it.each([{ exact: false }, { exact: undefined }])(
          'should match only specific requests if contains a declared response, a static search param restriction, and exact: $exact',
          async ({ exact }) => {
            const name = 'User';

            const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
              .with({
                searchParams: { name },
                exact,
              })
              .respond({
                status: 200,
                body: { success: true },
              });

            for (const matchingSearchParams of [
              new HttpSearchParams<SearchParamsSchema>({ name }),
              new HttpSearchParams<SearchParamsSchema>({ name, other: 'param' }),
            ]) {
              const matchingRequest = new Request(`${baseURL}?${matchingSearchParams.toString()}`);
              const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(matchingRequest);
              expect(tracker.matchesRequest(parsedRequest)).toBe(true);
            }

            for (const mismatchingSearchParams of [
              new HttpSearchParams<SearchParamsSchema>({ name: `${name} other` }),
              new HttpSearchParams<SearchParamsSchema>({}),
            ]) {
              const request = new Request(`${baseURL}?${mismatchingSearchParams.toString()}`);
              const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
              expect(tracker.matchesRequest(parsedRequest)).toBe(false);
            }
          },
        );

        it('should match only specific requests if contains a declared response and a computed search params restriction', async () => {
          const name = 'User';

          const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
            .with((request) => {
              expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<SearchParamsSchema>>();
              expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

              const nameParam = request.searchParams.get('name');
              return nameParam?.startsWith(name) ?? false;
            })
            .respond({
              status: 200,
              body: { success: true },
            });

          for (const matchingSearchParams of [
            new HttpSearchParams<SearchParamsSchema>({ name }),
            new HttpSearchParams<SearchParamsSchema>({ name, other: 'param' }),
            new HttpSearchParams<SearchParamsSchema>({ name: `${name} other` }),
          ]) {
            const matchingRequest = new Request(`${baseURL}?${matchingSearchParams.toString()}`);
            const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(matchingRequest);
            expect(tracker.matchesRequest(parsedRequest)).toBe(true);
          }

          for (const mismatchingSearchParams of [
            new HttpSearchParams<SearchParamsSchema>({ name: `Other ${name}` }),
            new HttpSearchParams<SearchParamsSchema>({}),
          ]) {
            const request = new Request(`${baseURL}?${mismatchingSearchParams.toString()}`);
            const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
            expect(tracker.matchesRequest(parsedRequest)).toBe(false);
          }
        });
      });

      describe('By headers', () => {
        it.each([{ exact: true }])(
          'should match only specific requests if contains a declared response, a static header restriction, and exact: $exact',
          async ({ exact }) => {
            const contentType = 'application/json';

            const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
              .with({
                headers: { 'content-type': contentType },
                exact,
              })
              .respond({
                status: 200,
                body: { success: true },
              });

            for (const matchingHeaders of [new HttpHeaders<HeadersSchema>({ 'content-type': contentType })]) {
              const matchingRequest = new Request(baseURL, { headers: matchingHeaders });
              const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(matchingRequest);
              expect(tracker.matchesRequest(parsedRequest)).toBe(true);
            }

            for (const mismatchingHeaders of [
              new HttpHeaders<HeadersSchema>({ 'content-type': contentType, accept: '*/*' }),
              new HttpHeaders<HeadersSchema>({ 'content-type': `${contentType}/other` }),
              new HttpHeaders<HeadersSchema>({}),
            ]) {
              const request = new Request(baseURL, { headers: mismatchingHeaders });
              const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
              expect(tracker.matchesRequest(parsedRequest)).toBe(false);
            }
          },
        );

        it.each([{ exact: false }, { exact: undefined }])(
          'should match only specific requests if contains a declared response, a static header restriction, and exact: $exact',
          async ({ exact }) => {
            const contentType = 'application/json';

            const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
              .with({
                headers: { 'content-type': contentType },
                exact,
              })
              .respond({
                status: 200,
                body: { success: true },
              });

            for (const matchingHeaders of [
              new HttpHeaders<HeadersSchema>({ 'content-type': contentType }),
              new HttpHeaders<HeadersSchema>({ 'content-type': contentType, accept: '*/*' }),
            ]) {
              const matchingRequest = new Request(baseURL, { headers: matchingHeaders });
              const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(matchingRequest);
              expect(tracker.matchesRequest(parsedRequest)).toBe(true);
            }

            for (const mismatchingHeaders of [
              new HttpHeaders<HeadersSchema>({ 'content-type': `${contentType}/other` }),
              new HttpHeaders<HeadersSchema>({}),
            ]) {
              const request = new Request(baseURL, { headers: mismatchingHeaders });
              const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
              expect(tracker.matchesRequest(parsedRequest)).toBe(false);
            }
          },
        );

        it('should match only specific requests if contains a declared response and a computed header restriction', async () => {
          const contentType = 'application/json';

          const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
            .with((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<HeadersSchema>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

              const nameParam = request.headers.get('content-type');
              return nameParam?.startsWith(contentType) ?? false;
            })
            .respond({
              status: 200,
              body: { success: true },
            });

          for (const matchingHeaders of [
            new HttpHeaders<HeadersSchema>({ 'content-type': contentType }),
            new HttpHeaders<HeadersSchema>({ 'content-type': contentType, accept: '*/*' }),
            new HttpHeaders<HeadersSchema>({ 'content-type': `${contentType}/other` }),
          ]) {
            const matchingRequest = new Request(baseURL, { headers: matchingHeaders });
            const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(matchingRequest);
            expect(tracker.matchesRequest(parsedRequest)).toBe(true);
          }

          for (const mismatchingHeaders of [
            new HttpHeaders<HeadersSchema>({ 'content-type': `other/${contentType}` }),
            new HttpHeaders<HeadersSchema>({}),
          ]) {
            const request = new Request(baseURL, { headers: mismatchingHeaders });
            const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
            expect(tracker.matchesRequest(parsedRequest)).toBe(false);
          }
        });
      });

      describe('By body', () => {
        it.each([{ exact: true }])(
          'should match only specific requests if contains a declared response, a static body restriction, and exact: $exact',
          async ({ exact }) => {
            const name = 'User';

            const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
              .with({
                body: { name },
                exact,
              })
              .respond({
                status: 200,
                body: { success: true },
              });

            for (const matchingBody of [{ name }] satisfies MethodSchema['request']['body'][]) {
              const matchingRequest = new Request(baseURL, {
                method: 'POST',
                body: JSON.stringify(matchingBody),
              });
              const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(matchingRequest);
              expect(tracker.matchesRequest(parsedRequest)).toBe(true);
            }

            for (const mismatchingBody of [
              { name, value: [] },
              { name, value: [1, 2] },
              {},
            ] satisfies MethodSchema['request']['body'][]) {
              const request = new Request(baseURL, {
                method: 'POST',
                body: JSON.stringify(mismatchingBody),
              });
              const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
              expect(tracker.matchesRequest(parsedRequest)).toBe(false);
            }
          },
        );

        it.each([{ exact: false }, { exact: undefined }])(
          'should match only specific requests if contains a declared response, a static header restriction, and exact: $exact',
          async ({ exact }) => {
            const name = 'User';

            const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
              .with({
                body: { name },
                exact,
              })
              .respond({
                status: 200,
                body: { success: true },
              });

            for (const matchingBody of [
              { name },
              { name, value: [] },
              { name, value: [1, 2] },
            ] satisfies MethodSchema['request']['body'][]) {
              const matchingRequest = new Request(baseURL, {
                method: 'POST',
                body: JSON.stringify(matchingBody),
              });
              const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(matchingRequest);
              expect(tracker.matchesRequest(parsedRequest)).toBe(true);
            }

            for (const mismatchingBody of [{}] satisfies MethodSchema['request']['body'][]) {
              const request = new Request(baseURL, {
                method: 'POST',
                body: JSON.stringify(mismatchingBody),
              });
              const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
              expect(tracker.matchesRequest(parsedRequest)).toBe(false);
            }
          },
        );

        it('should match only specific requests if contains a declared response and a computed body restriction', async () => {
          const name = 'User';

          const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
            .with((request) => {
              expectTypeOf(request.body).toEqualTypeOf<MethodSchema['request']['body']>();

              return request.body.name?.startsWith(name) ?? false;
            })
            .respond({
              status: 200,
              body: { success: true },
            });

          for (const matchingBody of [
            { name },
            { name, value: [1] },
            { name: `${name}-other` },
          ] satisfies MethodSchema['request']['body'][]) {
            const matchingRequest = new Request(baseURL, {
              method: 'POST',
              body: JSON.stringify(matchingBody),
            });
            const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(matchingRequest);
            expect(tracker.matchesRequest(parsedRequest)).toBe(true);
          }

          for (const mismatchingBody of [{ name: `Other ${name}` }, {}] satisfies MethodSchema['request']['body'][]) {
            const request = new Request(baseURL, {
              method: 'POST',
              body: JSON.stringify(mismatchingBody),
            });
            const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
            expect(tracker.matchesRequest(parsedRequest)).toBe(false);
          }
        });
      });

      it('should match only specific requests if contains a declared response and multiple restrictions', async () => {
        const name = 'User';
        const contentType = 'application/json';

        const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with({
            headers: { 'content-type': contentType },
            searchParams: { name },
          })
          .with((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<HeadersSchema>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<SearchParamsSchema>>();
            expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

            const matchesHeaders = request.headers.get('accept')?.includes('*/*') ?? false;
            const matchesSearchParams = request.searchParams.get('other')?.includes('param') ?? false;

            return matchesHeaders && matchesSearchParams;
          })
          .respond({
            status: 200,
            body: { success: true },
          });

        const matchingHeadersSamples = [
          new HttpHeaders<HeadersSchema>({ 'content-type': contentType, accept: '*/*' }),
          new HttpHeaders<HeadersSchema>({ 'content-type': contentType, accept: 'application/json, */*' }),
          new HttpHeaders<HeadersSchema>({ 'content-type': contentType, accept: '*/*, application/json' }),
        ];

        const mismatchingHeadersSamples = [
          new HttpHeaders<HeadersSchema>({ 'content-type': contentType, accept: 'application/json' }),
          new HttpHeaders<HeadersSchema>({ 'content-type': contentType }),
          new HttpHeaders<HeadersSchema>({}),
        ];

        const matchingSearchParamsSamples = [
          new HttpSearchParams<SearchParamsSchema>({ name, other: 'param' }),
          new HttpSearchParams<SearchParamsSchema>({ name, other: 'prefix-param' }),
          new HttpSearchParams<SearchParamsSchema>({ name, other: 'param-suffix' }),
          new HttpSearchParams<SearchParamsSchema>({ name, other: 'prefix-param-suffix' }),
        ];

        const mismatchingSearchParamsSamples = [
          new HttpSearchParams<SearchParamsSchema>({ name }),
          new HttpSearchParams<SearchParamsSchema>({ name: `Other ${name}` }),
          new HttpSearchParams<SearchParamsSchema>({ other: 'param' }),
          new HttpSearchParams<SearchParamsSchema>({ other: `Other param` }),
          new HttpSearchParams<SearchParamsSchema>({}),
        ];

        for (const matchingHeaders of matchingHeadersSamples) {
          for (const matchingSearchParams of matchingSearchParamsSamples) {
            const matchingRequest = new Request(`${baseURL}?${matchingSearchParams.toString()}`, {
              headers: matchingHeaders,
            });
            const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(matchingRequest);
            expect(tracker.matchesRequest(parsedRequest)).toBe(true);
          }

          for (const mismatchingSearchParams of mismatchingSearchParamsSamples) {
            const request = new Request(`${baseURL}?${mismatchingSearchParams.toString()}`, {
              headers: matchingHeaders,
            });
            const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
            expect(tracker.matchesRequest(parsedRequest)).toBe(false);
          }
        }

        for (const mismatchingHeaders of mismatchingHeadersSamples) {
          for (const matchingSearchParams of matchingSearchParamsSamples) {
            const matchingRequest = new Request(`${baseURL}?${matchingSearchParams.toString()}`, {
              headers: mismatchingHeaders,
            });
            const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(matchingRequest);
            expect(tracker.matchesRequest(parsedRequest)).toBe(false);
          }

          for (const mismatchingSearchParams of mismatchingSearchParamsSamples) {
            const request = new Request(`${baseURL}?${mismatchingSearchParams.toString()}`, {
              headers: mismatchingHeaders,
            });
            const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
            expect(tracker.matchesRequest(parsedRequest)).toBe(false);
          }
        }
      });
    });

    it('should clear restrictions after cleared', async () => {
      const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

      const request = new Request(baseURL);
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      await promiseIfRemote(tracker.clear(), worker);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      await promiseIfRemote(
        tracker
          .with((_request) => false)
          .respond({
            status: 200,
            body: { success: true },
          }),
        worker,
      );
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      await promiseIfRemote(tracker.clear(), worker);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      await promiseIfRemote(
        tracker.respond({
          status: 200,
          body: { success: true },
        }),
        worker,
      );
      expect(tracker.matchesRequest(parsedRequest)).toBe(true);
    });

    it('should not clear restrictions after bypassed', async () => {
      const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

      const request = new Request(baseURL);
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      await promiseIfRemote(tracker.bypass(), worker);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      await promiseIfRemote(
        tracker
          .with((_request) => false)
          .respond({
            status: 200,
            body: { success: true },
          }),
        worker,
      );
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      await promiseIfRemote(tracker.bypass(), worker);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      await promiseIfRemote(
        tracker.respond({
          status: 200,
          body: { success: true },
        }),
        worker,
      );
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);
    });
  });
}
