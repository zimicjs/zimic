import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { HttpRequest, HttpResponse } from '@/http/types/requests';
import { HTTP_METHODS_WITH_REQUEST_BODY, HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { importCrypto } from '@/utils/crypto';
import { urlJoin } from '@/utils/urls';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../utils';

export async function declarePlainTextBodyHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

  const crypto = await importCrypto();

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: crypto.randomUUID(), name: 'User 1' },
    { id: crypto.randomUUID(), name: 'User 2' },
  ];

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  const Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  describe.each(HTTP_METHODS_WITH_REQUEST_BODY)('Method (%s)', (method) => {
    const lowerMethod = method.toLowerCase<'POST'>();

    it(`should support intercepting ${method} requests having a plain text body`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: string;
        };
        response: {
          200: {
            headers?: { 'content-type'?: string };
            body: string;
          };
        };
      }>;

      await usingHttpInterceptor<{
        '/users/:id': {
          POST: MethodSchema;
          PUT: MethodSchema;
          PATCH: MethodSchema;
          DELETE: MethodSchema;
        };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users/:id').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<string>();
            expect(request.body).toBe('content');

            return { status: 200, body: 'content-response' };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(urlJoin(baseURL, `/users/${users[0].id}`), {
          method,
          body: 'content',
        });
        expect(response.status).toBe(200);

        const fetchedBody = await response.text();
        expect(fetchedBody).toBe('content-response');

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('text/plain;charset=UTF-8');
        expectTypeOf(request.body).toEqualTypeOf<string>();
        expect(request.body).toBe('content');

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('text/plain;charset=UTF-8');
        expectTypeOf(request.response.body).toEqualTypeOf<string>();
        expect(request.response.body).toBe('content-response');

        expectTypeOf(request.raw).toEqualTypeOf<HttpRequest<string>>();
        expect(request.raw).toBeInstanceOf(Request);
        expect(request.raw.url).toBe(request.url);
        expect(request.raw.method).toBe(method);
        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();

        expectTypeOf(request.response.raw).toEqualTypeOf<HttpResponse<string, 200>>();
        expect(request.response.raw).toBeInstanceOf(Response);
        expectTypeOf(request.response.raw.status).toEqualTypeOf<200>();
        expect(request.response.raw.status).toBe(200);
        expect(Object.fromEntries(response.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.response.raw.headers)),
        );
        expectTypeOf(request.response.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.response.raw.formData).toEqualTypeOf<() => Promise<FormData>>();
      });
    });

    it(`should consider ${method} request or response XML bodies as plain text`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: string;
        };
        response: {
          200: {
            headers: { 'content-type': string };
            body: string;
          };
        };
      }>;

      await usingHttpInterceptor<{
        '/users/:id': {
          POST: MethodSchema;
          PUT: MethodSchema;
          PATCH: MethodSchema;
          DELETE: MethodSchema;
        };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users/:id').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<string>();
            expect(request.body).toBe('<request>content</request>');

            return {
              status: 200,
              headers: { 'content-type': 'application/xml' },
              body: '<response>content-response</response>',
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(urlJoin(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/xml' },
          body: '<request>content</request>',
        });
        expect(response.status).toBe(200);

        const fetchedBody = await response.text();
        expect(fetchedBody).toBe('<response>content-response</response>');

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/xml');
        expectTypeOf(request.body).toEqualTypeOf<string>();
        expect(request.body).toBe('<request>content</request>');

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/xml');
        expectTypeOf(request.response.body).toEqualTypeOf<string>();
        expect(request.response.body).toBe('<response>content-response</response>');
      });
    });

    it(`should consider empty ${method} request or response plain text bodies as null`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body?: string;
        };
        response: {
          200: {
            headers: { 'content-type': string };
            body?: string;
          };
        };
      }>;

      await usingHttpInterceptor<{
        '/users/:id': {
          POST: MethodSchema;
          PUT: MethodSchema;
          PATCH: MethodSchema;
          DELETE: MethodSchema;
        };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users/:id').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<string | null>();
            expect(request.body).toBe(null);

            return {
              status: 200,
              headers: { 'content-type': 'text/plain;charset=UTF-8' },
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(urlJoin(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'text/plain;charset=UTF-8' },
        });
        expect(response.status).toBe(200);

        const fetchedBody = await response.text();
        expect(fetchedBody).toBe('');

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('text/plain;charset=UTF-8');
        expectTypeOf(request.body).toEqualTypeOf<string | null>();
        expect(request.body).toBe(null);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('text/plain;charset=UTF-8');
        expectTypeOf(request.response.body).toEqualTypeOf<string | null>();
        expect(request.response.body).toBe(null);
      });
    });
  });
}
