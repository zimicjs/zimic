import { expectTypeOf, expect, vi, it, beforeAll, afterAll, describe } from 'vitest';

import { HttpRequest, HttpResponse } from '@/http/types/requests';
import { SharedHttpInterceptorClient } from '@/interceptor/http/interceptor/HttpInterceptorClient';
import LocalHttpInterceptor from '@/interceptor/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/interceptor/http/interceptor/RemoteHttpInterceptor';
import { HttpInterceptorType } from '@/interceptor/http/interceptor/types/options';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import HttpInterceptorWorker from '@/interceptor/http/interceptorWorker/HttpInterceptorWorker';
import LocalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/LocalHttpInterceptorWorker';
import { joinURL } from '@/utils/fetch';
import { waitForDelay } from '@/utils/time';
import { createInternalHttpInterceptor } from '@tests/utils/interceptors';

import NoResponseDefinitionError from '../../errors/NoResponseDefinitionError';
import LocalHttpRequestTracker from '../../LocalHttpRequestTracker';
import RemoteHttpRequestTracker from '../../RemoteHttpRequestTracker';
import {
  HttpInterceptorRequest,
  HttpRequestTrackerResponseDeclaration,
  HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES,
  HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES,
} from '../../types/requests';
import { SharedHttpRequestTrackerTestOptions, Schema, MethodSchema } from './types';

export function declareDefaultHttpRequestTrackerTests(
  options: SharedHttpRequestTrackerTestOptions & {
    type: HttpInterceptorType;
    Tracker: typeof LocalHttpRequestTracker | typeof RemoteHttpRequestTracker;
  },
) {
  const { platform, type, startServer, getBaseURL, stopServer, Tracker } = options;

  let baseURL: URL;

  let interceptor: LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>;
  let interceptorClient: SharedHttpInterceptorClient<Schema>;

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }

    baseURL = await getBaseURL(type);

    interceptor = createInternalHttpInterceptor<Schema>({ type, baseURL });
    interceptorClient = interceptor.client() as SharedHttpInterceptorClient<Schema>;

    await interceptor.start();
    expect(interceptor.platform()).toBe(platform);
  });

  afterAll(async () => {
    await interceptor.stop();

    if (type === 'remote') {
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

    await promiseIfRemote(tracker.with({}), interceptor);

    expect(tracker.matchesRequest(parsedRequest)).toBe(true);
  });

  it('should not match any request if bypassed', async () => {
    const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

    const request = new Request(baseURL);
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);

    await promiseIfRemote(tracker.bypass(), interceptor);
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);

    await promiseIfRemote(
      tracker.respond({
        status: 200,
        body: { success: true },
      }),
      interceptor,
    );
    expect(tracker.matchesRequest(parsedRequest)).toBe(true);

    await promiseIfRemote(tracker.bypass(), interceptor);
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);

    await promiseIfRemote(
      tracker.respond({
        status: 200,
        body: { success: true },
      }),
      interceptor,
    );
    expect(tracker.matchesRequest(parsedRequest)).toBe(true);
  });

  it('should not match any request if cleared', async () => {
    const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

    const request = new Request(baseURL);
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);

    await promiseIfRemote(tracker.clear(), interceptor);
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);

    await promiseIfRemote(
      tracker.respond({
        status: 200,
        body: { success: true },
      }),
      interceptor,
    );
    expect(tracker.matchesRequest(parsedRequest)).toBe(true);

    await promiseIfRemote(tracker.clear(), interceptor);
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);

    await promiseIfRemote(
      tracker.respond({
        status: 200,
        body: { success: true },
      }),
      interceptor,
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
    await promiseIfRemote(tracker.respond(responseFactory), interceptor);

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

    const error = new NoResponseDefinitionError();
    expect(error).toBeInstanceOf(TypeError);

    await expect(async () => {
      await tracker.applyResponseDeclaration(parsedRequest);
    }).rejects.toThrowError(error);
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

    let interceptedRequests = await promiseIfRemote(tracker.requests(), interceptor);
    expect(interceptedRequests).toHaveLength(1);

    expect(interceptedRequests[0].url).toEqual(firstRequest.url);
    expect(interceptedRequests[0].method).toEqual(firstRequest.method);
    expect(interceptedRequests[0].response.status).toEqual(firstResponse.status);
    expect(interceptedRequests[0].response.body).toEqual(await firstResponse.json());

    const secondRequest = new Request(joinURL(baseURL, '/path'));
    const parsedSecondRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(secondRequest);
    const secondResponseDeclaration = await tracker.applyResponseDeclaration(parsedSecondRequest);

    const secondResponse = Response.json(secondResponseDeclaration.body, {
      status: secondResponseDeclaration.status,
    });
    const parsedSecondResponse = await LocalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(secondResponse);

    tracker.registerInterceptedRequest(parsedSecondRequest, parsedSecondResponse);

    expect(interceptedRequests).toHaveLength(1);
    interceptedRequests = await promiseIfRemote(tracker.requests(), interceptor);
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

    let interceptedRequests = await promiseIfRemote(tracker.requests(), interceptor);
    expect(interceptedRequests).toHaveLength(1);

    expect(interceptedRequests[0].url).toEqual(firstRequest.url);
    expect(interceptedRequests[0].method).toEqual(firstRequest.method);
    expect(interceptedRequests[0].response.status).toEqual(firstResponse.status);
    expect(interceptedRequests[0].response.body).toEqual(await firstResponseClone.json());

    await promiseIfRemote(tracker.clear(), interceptor);

    expect(interceptedRequests).toHaveLength(1);
    interceptedRequests = await promiseIfRemote(tracker.requests(), interceptor);
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

    const interceptedRequests = await promiseIfRemote(tracker.requests(), interceptor);
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

    const interceptedRequests = await promiseIfRemote(tracker.requests(), interceptor);
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

  it('should clear restrictions after cleared', async () => {
    const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

    const request = new Request(baseURL);
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);

    await promiseIfRemote(tracker.clear(), interceptor);
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);

    await promiseIfRemote(
      tracker
        .with((_request) => false)
        .respond({
          status: 200,
          body: { success: true },
        }),
      interceptor,
    );
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);

    await promiseIfRemote(tracker.clear(), interceptor);
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);

    await promiseIfRemote(
      tracker.respond({
        status: 200,
        body: { success: true },
      }),
      interceptor,
    );
    expect(tracker.matchesRequest(parsedRequest)).toBe(true);
  });

  it('should not clear restrictions after bypassed', async () => {
    const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users');

    const request = new Request(baseURL);
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);

    await promiseIfRemote(tracker.bypass(), interceptor);
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);

    await promiseIfRemote(
      tracker
        .with((_request) => false)
        .respond({
          status: 200,
          body: { success: true },
        }),
      interceptor,
    );
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);

    await promiseIfRemote(tracker.bypass(), interceptor);
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);

    await promiseIfRemote(
      tracker.respond({
        status: 200,
        body: { success: true },
      }),
      interceptor,
    );
    expect(tracker.matchesRequest(parsedRequest)).toBe(false);
  });

  if (Tracker === RemoteHttpRequestTracker) {
    describe('Promise-like', () => {
      it('should be then-able', async () => {
        const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
          status: 200,
          body: { success: true },
        });

        expect(tracker).toHaveProperty('then', expect.any(Function));
        expect(tracker).toHaveProperty('catch', expect.any(Function));
        expect(tracker).toHaveProperty('finally', expect.any(Function));

        const fulfillmentListener = vi.fn((syncedTracker) => {
          expect(syncedTracker).toEqual(tracker);
          expect(tracker.isSynced()).toBe(true);

          expect(syncedTracker).not.toHaveProperty('then');
          expect(syncedTracker).toHaveProperty('catch', expect.any(Function));
          expect(syncedTracker).toHaveProperty('finally', expect.any(Function));
        });

        expect(tracker.isSynced()).toBe(true);

        const pendingTracker = tracker.with({});
        expect(pendingTracker).toEqual(tracker);

        expect(tracker.isSynced()).toBe(true);
        tracker.registerSyncPromise(waitForDelay(100));
        expect(tracker.isSynced()).toBe(false);

        await pendingTracker.then(fulfillmentListener);

        expect(tracker.isSynced()).toBe(true);
        expect(pendingTracker.isSynced()).toBe(true);

        expect(fulfillmentListener).toHaveBeenCalledTimes(1);
      });

      it('should wait until synced before resolving, even if new sync promises were added while waiting', async () => {
        const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
          status: 200,
          body: { success: true },
        });

        expect(tracker).toHaveProperty('then', expect.any(Function));
        expect(tracker).toHaveProperty('catch', expect.any(Function));
        expect(tracker).toHaveProperty('finally', expect.any(Function));

        const fulfillmentListener = vi.fn((syncedTracker) => {
          expect(tracker).toEqual(syncedTracker);
          expect(tracker.isSynced()).toBe(true);

          expect(syncedTracker).not.toHaveProperty('then');
          expect(syncedTracker).toHaveProperty('catch', expect.any(Function));
          expect(syncedTracker).toHaveProperty('finally', expect.any(Function));
        });

        const delayedSyncPromises = [waitForDelay(200), waitForDelay(100), waitForDelay(300)];

        expect(tracker.isSynced()).toBe(true);
        tracker.registerSyncPromise(delayedSyncPromises[0]);
        expect(tracker.isSynced()).toBe(false);

        const thenPromise = tracker.with({}).then(fulfillmentListener);

        tracker.registerSyncPromise(delayedSyncPromises[1]);
        tracker.registerSyncPromise(delayedSyncPromises[2]);
        expect(tracker.isSynced()).toBe(false);

        await thenPromise;

        expect(tracker.isSynced()).toBe(true);

        expect(fulfillmentListener).toHaveBeenCalledTimes(1);
      });

      it('should be catch-able', async () => {
        const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
          status: 200,
          body: { success: true },
        });

        expect(tracker).toHaveProperty('then', expect.any(Function));
        expect(tracker).toHaveProperty('catch', expect.any(Function));
        expect(tracker).toHaveProperty('finally', expect.any(Function));

        // @ts-expect-error Forcing an exception in an internal method
        tracker.syncPromises = 'not-an-array';

        const rejectionListener = vi.fn((error: Error) => {
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toBe('this.syncPromises.filter is not a function');
        });

        await tracker.with({}).catch(rejectionListener);

        expect(rejectionListener).toHaveBeenCalledTimes(1);
      });

      it('should be finally-able', async () => {
        const tracker = new Tracker<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').respond({
          status: 200,
          body: { success: true },
        });

        expect(tracker).toHaveProperty('then', expect.any(Function));
        expect(tracker).toHaveProperty('catch', expect.any(Function));
        expect(tracker).toHaveProperty('finally', expect.any(Function));

        const finallyListener = vi.fn();

        expect(tracker.isSynced()).toBe(true);

        const pendingTracker = tracker.with({});
        expect(pendingTracker).toEqual(tracker);

        expect(tracker.isSynced()).toBe(true);
        tracker.registerSyncPromise(waitForDelay(100));
        expect(tracker.isSynced()).toBe(false);

        await pendingTracker.finally(finallyListener);

        expect(tracker.isSynced()).toBe(true);
        expect(pendingTracker.isSynced()).toBe(true);

        expect(finallyListener).toHaveBeenCalledTimes(1);
      });
    });
  }
}
