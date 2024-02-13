import { expectTypeOf, expect, vi, it, beforeAll, afterAll, describe } from 'vitest';

import { createHttpInterceptor } from '@/interceptor/http/interceptor/factory';
import InternalHttpInterceptor from '@/interceptor/http/interceptor/InternalHttpInterceptor';
import { HttpInterceptorSchema } from '@/interceptor/http/interceptor/types/schema';
import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';
import InternalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/InternalHttpInterceptorWorker';
import { HttpInterceptorWorkerPlatform } from '@/interceptor/http/interceptorWorker/types/options';
import { HttpRequest, HttpResponse } from '@/interceptor/http/interceptorWorker/types/requests';

import NoResponseDefinitionError from '../../errors/NoResponseDefinitionError';
import InternalHttpRequestTracker from '../../InternalHttpRequestTracker';
import {
  HttpInterceptorRequest,
  HttpRequestTrackerResponseDeclaration,
  HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES,
  HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES,
} from '../../types/requests';

export function declareSharedHttpRequestTrackerTests(options: { platform: HttpInterceptorWorkerPlatform }) {
  const { platform } = options;

  describe('Shared', () => {
    const baseURL = 'http://localhost:3000';

    type MethodSchema = HttpInterceptorSchema.Method<{
      request: {
        body: { success?: undefined };
      };
      response: {
        200: {
          body: { success: true };
        };
      };
    }>;

    type Schema = HttpInterceptorSchema.Root<{
      '/users': {
        GET: MethodSchema;
      };
    }>;

    const worker = createHttpInterceptorWorker({ platform });
    const interceptor = createHttpInterceptor<Schema>({ worker, baseURL }) as InternalHttpInterceptor<Schema>;

    beforeAll(async () => {
      await worker.start();
    });

    afterAll(async () => {
      await worker.stop();
    });

    it('should provide access to the method and path', () => {
      const tracker = new InternalHttpRequestTracker<Schema, 'GET', '/users'>(interceptor, 'GET', '/users');

      expectTypeOf<typeof tracker.method>().toEqualTypeOf<() => 'GET'>();
      expect(tracker.method()).toBe('GET');

      expectTypeOf<typeof tracker.path>().toEqualTypeOf<() => '/users'>();
      expect(tracker.path()).toBe('/users');
    });

    it('should not match any request if contains no declared response', async () => {
      const tracker = new InternalHttpRequestTracker<Schema, 'GET', '/users'>(interceptor, 'GET', '/users');

      const request = new Request(baseURL);
      const parsedRequest = await InternalHttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);
    });

    it('should match any request if contains declared response', async () => {
      const tracker = new InternalHttpRequestTracker<Schema, 'GET', '/users'>(interceptor, 'GET', '/users').respond({
        status: 200,
        body: { success: true },
      });

      const request = new Request(baseURL);
      const parsedRequest = await InternalHttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
      expect(tracker.matchesRequest(parsedRequest)).toBe(true);
    });

    it('should not match any request if bypassed', async () => {
      const tracker = new InternalHttpRequestTracker<Schema, 'GET', '/users'>(interceptor, 'GET', '/users');

      const request = new Request(baseURL);
      const parsedRequest = await InternalHttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      tracker.bypass();
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);

      tracker.respond({
        status: 200,
        body: { success: true },
      });
      expect(tracker.matchesRequest(parsedRequest)).toBe(true);

      tracker.bypass();
      expect(tracker.matchesRequest(parsedRequest)).toBe(false);
    });

    it('should create response with declared status and body', async () => {
      const responseStatus = 200;
      const responseBody = { success: true } as const;

      const tracker = new InternalHttpRequestTracker<Schema, 'GET', '/users'>(interceptor, 'GET', '/users').respond({
        status: responseStatus,
        body: responseBody,
      });

      const request = new Request(baseURL);
      const parsedRequest = await InternalHttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
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

      const tracker = new InternalHttpRequestTracker<Schema, 'GET', '/users'>(interceptor, 'GET', '/users');
      tracker.respond(responseFactory);

      const request = new Request(baseURL);
      const parsedRequest = await InternalHttpInterceptorWorker.parseRawRequest<MethodSchema>(request);
      const response = await tracker.applyResponseDeclaration(parsedRequest);

      expect(response.status).toBe(responseStatus);
      expect(response.body).toEqual(responseBody);

      expect(responseFactory).toHaveBeenCalledTimes(1);
      expect(responseFactory).toHaveBeenCalledWith(request);
    });

    it('should throw an error if trying to create a response without a declared response', async () => {
      const tracker = new InternalHttpRequestTracker<Schema, 'GET', '/users'>(interceptor, 'GET', '/users');

      const request = new Request(baseURL);
      const parsedRequest = await InternalHttpInterceptorWorker.parseRawRequest<MethodSchema>(request);

      await expect(async () => {
        await tracker.applyResponseDeclaration(parsedRequest);
      }).rejects.toThrowError(new NoResponseDefinitionError());
    });

    it('should keep track of the intercepted requests and responses', async () => {
      const tracker = new InternalHttpRequestTracker<Schema, 'GET', '/users'>(interceptor, 'GET', '/users').respond({
        status: 200,
        body: { success: true },
      });

      const firstRequest = new Request(baseURL);
      const parsedFirstRequest = await InternalHttpInterceptorWorker.parseRawRequest<MethodSchema>(firstRequest);

      const firstResponseDeclaration = await tracker.applyResponseDeclaration(parsedFirstRequest);
      const firstResponse = Response.json(firstResponseDeclaration.body, {
        status: firstResponseDeclaration.status,
      });
      const parsedFirstResponse = await InternalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(
        firstResponse,
      );

      tracker.registerInterceptedRequest(parsedFirstRequest, parsedFirstResponse);

      const interceptedRequests = tracker.requests();
      expect(interceptedRequests).toHaveLength(1);

      expect(interceptedRequests[0]).toEqual(firstRequest);
      expect(interceptedRequests[0].response).toEqual(firstResponse);

      const secondRequest = new Request(`${baseURL}/path`);
      const parsedSecondRequest = await InternalHttpInterceptorWorker.parseRawRequest<MethodSchema>(secondRequest);
      const secondResponseDeclaration = await tracker.applyResponseDeclaration(parsedSecondRequest);

      const secondResponse = Response.json(secondResponseDeclaration.body, {
        status: secondResponseDeclaration.status,
      });
      const parsedSecondResponse = await InternalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(
        secondResponse,
      );

      tracker.registerInterceptedRequest(parsedSecondRequest, parsedSecondResponse);

      expect(interceptedRequests).toHaveLength(2);

      expect(interceptedRequests[0]).toEqual(firstRequest);
      expect(interceptedRequests[0].response).toEqual(firstResponse);

      expect(interceptedRequests[1]).toEqual(secondRequest);
      expect(interceptedRequests[1].response).toEqual(secondResponse);
    });

    it('should provide access to the raw intercepted requests and responses', async () => {
      const tracker = new InternalHttpRequestTracker<Schema, 'GET', '/users'>(interceptor, 'GET', '/users').respond({
        status: 200,
        body: { success: true },
      });

      const request = new Request(baseURL, {
        method: 'POST',
        body: JSON.stringify({ success: undefined } satisfies MethodSchema['request']['body']),
      });
      const parsedRequest = await InternalHttpInterceptorWorker.parseRawRequest<MethodSchema>(request);

      const responseDeclaration = await tracker.applyResponseDeclaration(parsedRequest);
      const response = Response.json(responseDeclaration.body, { status: responseDeclaration.status });
      const parsedResponse = await InternalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(response);

      tracker.registerInterceptedRequest(parsedRequest, parsedResponse);

      const interceptedRequests = tracker.requests();
      expect(interceptedRequests).toHaveLength(1);

      expect(interceptedRequests[0]).toEqual(parsedRequest);

      expectTypeOf(interceptedRequests[0].raw).toEqualTypeOf<HttpRequest<{ success?: undefined }>>();
      expect(interceptedRequests[0].raw).toBeInstanceOf(Request);
      expect(interceptedRequests[0].raw.url).toBe(`${baseURL}/`);
      expect(interceptedRequests[0].raw.method).toBe('POST');
      expect(interceptedRequests[0].raw.headers).toEqual(request.headers);
      expectTypeOf(interceptedRequests[0].raw.json).toEqualTypeOf<() => Promise<{ success?: undefined }>>();
      expect(await interceptedRequests[0].raw.json()).toEqual<MethodSchema['request']['body']>({ success: undefined });

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
      const tracker = new InternalHttpRequestTracker<Schema, 'GET', '/users'>(interceptor, 'GET', '/users').respond({
        status: 200,
        body: { success: true },
      });

      const request = new Request(baseURL);
      const parsedRequest = await InternalHttpInterceptorWorker.parseRawRequest<MethodSchema>(request);

      const responseDeclaration = await tracker.applyResponseDeclaration(parsedRequest);
      const response = Response.json(responseDeclaration.body, { status: responseDeclaration.status });
      const parsedResponse = await InternalHttpInterceptorWorker.parseRawResponse<MethodSchema, 200>(response);

      tracker.registerInterceptedRequest(parsedRequest, parsedResponse);

      const interceptedRequests = tracker.requests();
      expect(interceptedRequests).toHaveLength(1);

      expect(interceptedRequests[0]).toEqual(parsedRequest);

      for (const hiddenProperty of HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES) {
        expect(interceptedRequests[0]).not.toHaveProperty(hiddenProperty);
        expect((interceptedRequests[0] as unknown as Request)[hiddenProperty]).toBe(undefined);
      }

      expect(interceptedRequests[0].response).toEqual(parsedResponse);

      for (const hiddenProperty of HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES) {
        expect(interceptedRequests[0].response).not.toHaveProperty(hiddenProperty);
        expect((interceptedRequests[0].response as unknown as Response)[hiddenProperty]).toBe(undefined);
      }
    });
  });
}
