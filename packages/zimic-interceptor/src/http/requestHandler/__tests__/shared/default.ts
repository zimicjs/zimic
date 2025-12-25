import { HttpRequest, HttpResponse, StrictFormData } from '@zimic/http';
import waitForDelay from '@zimic/utils/time/waitForDelay';
import joinURL from '@zimic/utils/url/joinURL';
import { expectTypeOf, expect, vi, it, beforeAll, afterAll, describe, beforeEach, afterEach } from 'vitest';

import { SharedHttpInterceptorClient } from '@/http/interceptor/HttpInterceptorClient';
import LocalHttpInterceptor from '@/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/http/interceptor/RemoteHttpInterceptor';
import { HttpInterceptorType } from '@/http/interceptor/types/options';
import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import HttpInterceptorWorker from '@/http/interceptorWorker/HttpInterceptorWorker';
import LocalHttpInterceptorWorker from '@/http/interceptorWorker/LocalHttpInterceptorWorker';
import { createInternalHttpInterceptor } from '@tests/utils/interceptors';

import { HttpRequestHandlerRequestMatch } from '../../HttpRequestHandlerClient';
import type LocalHttpRequestHandler from '../../LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '../../RemoteHttpRequestHandler';
import {
  HttpInterceptorRequest,
  HttpRequestHandlerResponseDeclaration,
  HTTP_INTERCEPTOR_REQUEST_HIDDEN_PROPERTIES,
  HTTP_INTERCEPTOR_RESPONSE_HIDDEN_PROPERTIES,
} from '../../types/requests';
import { SharedHttpRequestHandlerTestOptions, Schema, MethodSchema, HeadersSchema } from './types';

export function declareDefaultHttpRequestHandlerTests(
  options: SharedHttpRequestHandlerTestOptions & {
    type: HttpInterceptorType;
    Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;
  },
) {
  const { platform, type, startServer, stopServer, getBaseURL, Handler } = options;

  let baseURL: string;

  let interceptor: LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>;
  let interceptorClient: SharedHttpInterceptorClient<Schema>;

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);

    interceptor = createInternalHttpInterceptor<Schema>({ type, baseURL });
    interceptorClient = interceptor.client as SharedHttpInterceptorClient<Schema>;

    expect(interceptor.platform).toBe(null);

    await interceptor.start();

    expect(interceptor.platform).toBe(platform);
  });

  afterEach(async () => {
    await interceptor.stop();
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  it('should provide access to the method and path', () => {
    const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

    expectTypeOf<typeof handler.method>().toEqualTypeOf<'POST'>();
    expect(handler.method).toBe('POST');

    expectTypeOf<typeof handler.path>().toEqualTypeOf<'/users'>();
    expect(handler.path).toBe('/users');
  });

  it('should not match any request if contains no declared response', async () => {
    const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

    const request = new Request(baseURL);
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
    expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
      success: false,
      cause: 'missingResponseDeclaration',
    });
  });

  it('should match any request if contains a declared response and no restrictions', async () => {
    const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
      status: 200,
      body: { success: true },
    });

    const request = new Request(baseURL);
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
    expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({ success: true });

    await promiseIfRemote(handler.with({}), interceptor);

    expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({ success: true });
  });

  it('should not match any request if cleared', async () => {
    const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

    const request = new Request(baseURL);
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
    expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
      success: false,
      cause: 'missingResponseDeclaration',
    });

    await promiseIfRemote(handler.clear(), interceptor);
    expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
      success: false,
      cause: 'missingResponseDeclaration',
    });

    await promiseIfRemote(
      handler.respond({
        status: 200,
        body: { success: true },
      }),
      interceptor,
    );
    expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({ success: true });

    await promiseIfRemote(handler.clear(), interceptor);
    expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
      success: false,
      cause: 'missingResponseDeclaration',
    });

    await promiseIfRemote(
      handler.respond({
        status: 200,
        body: { success: true },
      }),
      interceptor,
    );
    expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({ success: true });
  });

  it('should create response with declared status and body', async () => {
    const responseStatus = 200;
    const responseBody = { success: true } as const;

    const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
      status: responseStatus,
      body: responseBody,
    });

    const request = new Request(baseURL);
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
    const responseDeclaration = (await handler.applyResponseDeclaration(parsedRequest))!;

    expect(responseDeclaration.status).toBe(responseStatus);
    expect(responseDeclaration.body).toEqual(responseBody);
  });

  it('should create response with declared status and body factory', async () => {
    const responseStatus = 200;
    const responseBody = { success: true } as const;

    const responseFactory = vi.fn<
      (
        request: HttpInterceptorRequest<'/users', MethodSchema>,
      ) => HttpRequestHandlerResponseDeclaration<MethodSchema, 200>
    >(() => ({
      status: responseStatus,
      body: responseBody,
    }));

    const handler = new Handler<Schema, 'POST', '/users', 200>(interceptorClient, 'POST', '/users');
    await promiseIfRemote(handler.respond(responseFactory), interceptor);

    const request = new Request(baseURL);
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
    const responseDeclaration = (await handler.applyResponseDeclaration(parsedRequest))!;

    expect(responseDeclaration.status).toBe(responseStatus);
    expect(responseDeclaration.body).toEqual(responseBody);

    expect(responseFactory).toHaveBeenCalledTimes(1);
  });

  it('should not throw an error if trying to create a response without a declared response', async () => {
    const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

    const request = new Request(baseURL);
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

    const responseDeclarationPromise = handler.applyResponseDeclaration(parsedRequest);
    await expect(responseDeclarationPromise).resolves.toBe(undefined);
  });

  it('should keep track of the intercepted requests and responses', async () => {
    const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
      status: 200,
      body: { success: true },
    });

    const firstRequest = new Request(baseURL);
    const parsedFirstRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(firstRequest);

    const firstResponseDeclaration = (await handler.applyResponseDeclaration(parsedFirstRequest))!;
    const firstResponse = Response.json(firstResponseDeclaration.body, {
      status: firstResponseDeclaration.status,
    });
    const firstResponseClone = firstResponse.clone();
    const parsedFirstResponse = await LocalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(firstResponse);

    handler.saveInterceptedRequest(parsedFirstRequest, parsedFirstResponse);

    expect(handler.requests).toHaveLength(1);

    expect(handler.requests[0].url).toEqual(firstRequest.url);
    expect(handler.requests[0].method).toEqual(firstRequest.method);
    expect(handler.requests[0].response.status).toBe(firstResponse.status);
    expect(handler.requests[0].response.body).toEqual(await firstResponse.json());

    const secondRequest = new Request(joinURL(baseURL, '/path'));
    const parsedSecondRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(secondRequest);
    const secondResponseDeclaration = (await handler.applyResponseDeclaration(parsedSecondRequest))!;

    const secondResponse = Response.json(secondResponseDeclaration.body, {
      status: secondResponseDeclaration.status,
    });
    const parsedSecondResponse = await LocalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(secondResponse);

    handler.saveInterceptedRequest(parsedSecondRequest, parsedSecondResponse);

    expect(handler.requests).toHaveLength(2);

    expect(handler.requests[0].url).toEqual(firstRequest.url);
    expect(handler.requests[0].method).toEqual(firstRequest.method);
    expect(handler.requests[0].response.status).toBe(firstResponse.status);
    expect(handler.requests[0].response.body).toEqual(await firstResponseClone.json());

    expect(handler.requests[1].url).toEqual(secondRequest.url);
    expect(handler.requests[1].method).toEqual(secondRequest.method);
    expect(handler.requests[1].response.status).toBe(secondResponse.status);
    expect(handler.requests[1].response.body).toEqual(await secondResponse.json());
  });

  it('should clear the intercepted requests and responses after cleared', async () => {
    const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
      status: 200,
      body: { success: true },
    });

    const firstRequest = new Request(baseURL);
    const parsedFirstRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(firstRequest);

    const firstResponseDeclaration = (await handler.applyResponseDeclaration(parsedFirstRequest))!;
    const firstResponse = Response.json(firstResponseDeclaration.body, {
      status: firstResponseDeclaration.status,
    });
    const firstResponseClone = firstResponse.clone();
    const parsedFirstResponse = await LocalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(firstResponse);

    handler.saveInterceptedRequest(parsedFirstRequest, parsedFirstResponse);

    expect(handler.requests).toHaveLength(1);

    expect(handler.requests[0].url).toEqual(firstRequest.url);
    expect(handler.requests[0].method).toEqual(firstRequest.method);
    expect(handler.requests[0].response.status).toBe(firstResponse.status);
    expect(handler.requests[0].response.body).toEqual(await firstResponseClone.json());

    await promiseIfRemote(handler.clear(), interceptor);

    expect(handler.requests).toHaveLength(0);
  });

  it('should provide access to the raw intercepted requests and responses', async () => {
    const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
      status: 200,
      body: { success: true },
    });

    const request = new Request(baseURL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'User' } satisfies MethodSchema['request']['body']),
    });
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

    const responseDeclaration = (await handler.applyResponseDeclaration(parsedRequest))!;
    const response = Response.json(responseDeclaration.body, { status: responseDeclaration.status });
    const parsedResponse = await LocalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(response);

    handler.saveInterceptedRequest(parsedRequest, parsedResponse);

    expect(handler.requests).toHaveLength(1);

    expect(handler.requests[0]).toEqual(parsedRequest);

    expectTypeOf(handler.requests[0].raw).toEqualTypeOf<HttpRequest<MethodSchema['request']['body'], HeadersSchema>>();
    expect(handler.requests[0].raw).toBeInstanceOf(Request);
    expect(handler.requests[0].raw.url).toBe(request.url);
    expect(handler.requests[0].raw.method).toBe('POST');
    expect(handler.requests[0].raw.headers).toEqual(request.headers);
    expectTypeOf(handler.requests[0].raw.json).toEqualTypeOf<() => Promise<{ name?: string; value?: number[] }>>();
    expect(await handler.requests[0].raw.json()).toEqual<MethodSchema['request']['body']>({ name: 'User' });
    expectTypeOf(handler.requests[0].raw.formData).toEqualTypeOf<
      () => Promise<FormData | StrictFormData<{ name: string }>>
    >();

    expect(handler.requests[0].response).toEqual(parsedResponse);

    expectTypeOf(handler.requests[0].response.raw).toEqualTypeOf<
      HttpResponse<{ success: true }, { 'content-type': 'application/json' }, 200>
    >();

    expect(handler.requests[0].response.raw).toBeInstanceOf(Response);
    expectTypeOf(handler.requests[0].response.raw.status).toEqualTypeOf<200>();
    expect(handler.requests[0].response.raw.status).toBe(200);
    expect(handler.requests[0].response.raw.headers).toEqual(response.headers);
    expectTypeOf(handler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<{ success: true }>>();
    expect(await handler.requests[0].response.raw.json()).toEqual<MethodSchema['response'][200]['body']>({
      success: true,
    });
    expectTypeOf(handler.requests[0].response.raw.formData).toEqualTypeOf<() => Promise<FormData>>();
  });

  it('should provide no access to hidden properties in raw intercepted requests and responses', async () => {
    const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
      status: 200,
      body: { success: true },
    });

    const request = new Request(baseURL);
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

    const responseDeclaration = (await handler.applyResponseDeclaration(parsedRequest))!;
    const response = Response.json(responseDeclaration.body, { status: responseDeclaration.status });
    const parsedResponse = await LocalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(response);

    handler.saveInterceptedRequest(parsedRequest, parsedResponse);

    expect(handler.requests).toHaveLength(1);

    expect(handler.requests[0]).toEqual(parsedRequest);

    for (const hiddenProperty of HTTP_INTERCEPTOR_REQUEST_HIDDEN_PROPERTIES) {
      expect(handler.requests[0]).not.toHaveProperty(hiddenProperty);
      // @ts-expect-error Trying to access the hidden property.
      expect(handler.requests[0][hiddenProperty]).toBe(undefined);
    }

    expect(handler.requests[0].response).toEqual(parsedResponse);

    for (const hiddenProperty of HTTP_INTERCEPTOR_RESPONSE_HIDDEN_PROPERTIES) {
      expect(handler.requests[0].response).not.toHaveProperty(hiddenProperty);
      // @ts-expect-error Trying to access the hidden property.
      expect(handler.requests[0].response[hiddenProperty]).toBe(undefined);
    }
  });

  it('should clear restrictions after cleared', async () => {
    const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

    const request = new Request(baseURL);
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
    expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
      success: false,
      cause: 'missingResponseDeclaration',
    });

    await promiseIfRemote(handler.clear(), interceptor);
    expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
      success: false,
      cause: 'missingResponseDeclaration',
    });

    await promiseIfRemote(
      handler
        .with((_request) => false)
        .respond({
          status: 200,
          body: { success: true },
        }),
      interceptor,
    );
    expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
      success: false,
      cause: 'unmatchedRestrictions',
      diff: {
        computed: { expected: true, received: false },
      },
    });

    await promiseIfRemote(handler.clear(), interceptor);
    expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
      success: false,
      cause: 'missingResponseDeclaration',
    });

    await promiseIfRemote(
      handler.respond({
        status: 200,
        body: { success: true },
      }),
      interceptor,
    );
    expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({ success: true });
  });

  if (Handler === RemoteHttpRequestHandler) {
    describe('Promise-like', () => {
      it('should be then-able', async () => {
        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
          status: 200,
          body: { success: true },
        });

        await handler;

        expect(handler).toHaveProperty('then', expect.any(Function));
        expect(handler).toHaveProperty('catch', expect.any(Function));
        expect(handler).toHaveProperty('finally', expect.any(Function));

        const fulfillmentListener = vi.fn((syncedHandler) => {
          expect(syncedHandler).toEqual(handler);
          expect(handler.isSynced).toBe(true);

          expect(syncedHandler).not.toHaveProperty('then');
          expect(syncedHandler).toHaveProperty('catch', expect.any(Function));
          expect(syncedHandler).toHaveProperty('finally', expect.any(Function));
        });

        expect(handler.isSynced).toBe(true);

        const pendingHandler = handler.with({});
        expect(pendingHandler).toEqual(handler);

        expect(handler.isSynced).toBe(true);
        handler.registerSyncPromise(waitForDelay(100));
        expect(handler.isSynced).toBe(false);

        await pendingHandler.then(fulfillmentListener);

        expect(handler.isSynced).toBe(true);
        expect(pendingHandler.isSynced).toBe(true);

        expect(fulfillmentListener).toHaveBeenCalledTimes(1);
      });

      it('should wait until synced before resolving, even if new sync promises were added while waiting', async () => {
        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
          status: 200,
          body: { success: true },
        });

        await handler;

        expect(handler).toHaveProperty('then', expect.any(Function));
        expect(handler).toHaveProperty('catch', expect.any(Function));
        expect(handler).toHaveProperty('finally', expect.any(Function));

        const fulfillmentListener = vi.fn((syncedHandler) => {
          expect(handler).toEqual(syncedHandler);
          expect(handler.isSynced).toBe(true);

          expect(syncedHandler).not.toHaveProperty('then');
          expect(syncedHandler).toHaveProperty('catch', expect.any(Function));
          expect(syncedHandler).toHaveProperty('finally', expect.any(Function));
        });

        const delayedSyncPromises = [waitForDelay(200), waitForDelay(100), waitForDelay(300)];

        expect(handler.isSynced).toBe(true);
        handler.registerSyncPromise(delayedSyncPromises[0]);
        expect(handler.isSynced).toBe(false);

        const thenPromise = handler.with({}).then(fulfillmentListener);

        handler.registerSyncPromise(delayedSyncPromises[1]);
        handler.registerSyncPromise(delayedSyncPromises[2]);
        expect(handler.isSynced).toBe(false);

        await thenPromise;

        expect(handler.isSynced).toBe(true);

        expect(fulfillmentListener).toHaveBeenCalledTimes(1);
      });

      it('should be catch-able', async () => {
        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
          status: 200,
          body: { success: true },
        });

        expect(handler).toHaveProperty('then', expect.any(Function));
        expect(handler).toHaveProperty('catch', expect.any(Function));
        expect(handler).toHaveProperty('finally', expect.any(Function));

        // @ts-expect-error Forcing an exception in an internal method
        handler.syncPromises = 'not-an-array';

        const rejectionListener = vi.fn((error: unknown) => {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty('message', 'this.syncPromises.filter is not a function');
        });

        await handler.with({}).catch(rejectionListener);

        expect(rejectionListener).toHaveBeenCalledTimes(1);
      });

      it('should be finally-able', async () => {
        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
          status: 200,
          body: { success: true },
        });

        await handler;

        expect(handler).toHaveProperty('then', expect.any(Function));
        expect(handler).toHaveProperty('catch', expect.any(Function));
        expect(handler).toHaveProperty('finally', expect.any(Function));

        const finallyListener = vi.fn();

        expect(handler.isSynced).toBe(true);

        const pendingHandler = handler.with({});
        expect(pendingHandler).toEqual(handler);

        expect(handler.isSynced).toBe(true);
        handler.registerSyncPromise(waitForDelay(100));
        expect(handler.isSynced).toBe(false);

        await pendingHandler.finally(finallyListener);

        expect(handler.isSynced).toBe(true);
        expect(pendingHandler.isSynced).toBe(true);

        expect(finallyListener).toHaveBeenCalledTimes(1);
      });
    });
  }
}
