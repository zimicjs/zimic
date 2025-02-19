import { HTTP_METHODS_WITH_REQUEST_BODY, HttpSchema, HttpRequest, HttpResponse } from '@zimic/http';
import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import InvalidJSONError from '@/interceptor/http/interceptorWorker/errors/InvalidJSONError';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { JSONSerialized, JSONValue } from '@/types/json';
import { importCrypto } from '@/utils/crypto';
import { joinURL } from '@/utils/urls';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../utils';

export async function declareJSONBodyHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

  const crypto = await importCrypto();

  type UserAsType = JSONValue<{
    id: string;
    name: string;
  }>;

  interface UserAsInterface {
    id: string;
    name: string;
  }

  const users: UserAsType[] = [
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

    const invalidRequestJSONString = '<invalid-request-json>';
    const invalidResponseJSONString = '<invalid-response-json>';

    it(`should support intercepting ${method} requests having a JSON body declared as a type`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: UserAsType;
        };
        response: {
          200: {
            headers?: { 'content-type'?: string };
            body: UserAsType;
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
            expectTypeOf(request.body).toEqualTypeOf<UserAsType>();
            expect(request.body).toEqual(users[0]);

            return { status: 200, body: users[0] };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(users[0]),
        });
        expect(response.status).toBe(200);

        const fetchedUser = (await response.json()) as UserAsType;
        expect(fetchedUser).toEqual(users[0]);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.body).toEqualTypeOf<UserAsType>();
        expect(request.body).toEqual(users[0]);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.response.body).toEqualTypeOf<UserAsType>();
        expect(request.response.body).toEqual(users[0]);

        expectTypeOf(request.raw).toEqualTypeOf<HttpRequest<UserAsType>>();
        expect(request.raw).toBeInstanceOf(Request);
        expect(request.raw.url).toBe(request.url);
        expect(request.raw.method).toBe(method);
        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<UserAsType>>();
        expect(await request.raw.json()).toEqual<UserAsType>(users[0]);
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();

        expectTypeOf(request.response.raw).toEqualTypeOf<HttpResponse<UserAsType, 200>>();
        expect(request.response.raw).toBeInstanceOf(Response);
        expectTypeOf(request.response.raw.status).toEqualTypeOf<200>();
        expect(request.response.raw.status).toBe(200);
        expect(Object.fromEntries(response.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.response.raw.headers)),
        );
        expectTypeOf(request.response.raw.json).toEqualTypeOf<() => Promise<UserAsType>>();
        expect(await request.response.raw.json()).toEqual<UserAsType>(users[0]);
        expectTypeOf(request.response.raw.formData).toEqualTypeOf<() => Promise<FormData>>();
      });
    });

    it(`should support intercepting ${method} requests having a JSON body declared as an interface`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: UserAsInterface;
        };
        response: {
          200: {
            headers?: { 'content-type'?: string };
            body: UserAsInterface;
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
            expectTypeOf(request.body).toEqualTypeOf<UserAsInterface>();
            expect(request.body).toEqual(users[0]);

            return { status: 200, body: users[0] };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(users[0]),
        });
        expect(response.status).toBe(200);

        const fetchedUser = (await response.json()) as UserAsInterface;
        expect(fetchedUser).toEqual(users[0]);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.body).toEqualTypeOf<UserAsInterface>();
        expect(request.body).toEqual(users[0]);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.response.body).toEqualTypeOf<UserAsInterface>();
        expect(request.response.body).toEqual(users[0]);

        expectTypeOf(request.raw).toEqualTypeOf<HttpRequest<UserAsInterface>>();
        expect(request.raw).toBeInstanceOf(Request);
        expect(request.raw.url).toBe(request.url);
        expect(request.raw.method).toBe(method);
        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<UserAsInterface>>();
        expect(await request.raw.json()).toEqual<UserAsInterface>(users[0]);
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();

        expectTypeOf(request.response.raw).toEqualTypeOf<HttpResponse<UserAsInterface, 200>>();
        expect(request.response.raw).toBeInstanceOf(Response);
        expectTypeOf(request.response.raw.status).toEqualTypeOf<200>();
        expect(request.response.raw.status).toBe(200);
        expect(Object.fromEntries(response.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.response.raw.headers)),
        );
        expectTypeOf(request.response.raw.json).toEqualTypeOf<() => Promise<UserAsInterface>>();
        expect(await request.response.raw.json()).toEqual<UserAsInterface>(users[0]);
        expectTypeOf(request.response.raw.formData).toEqualTypeOf<() => Promise<FormData>>();
      });
    });

    it(`should support intercepting ${method} requests having a JSON body declared as type or interface not strictly compatible with JSON`, async () => {
      interface UserAsNonJSONInterface extends UserAsInterface {
        date: Date; // Forcing an invalid type
        method: () => void; // Forcing an invalid type
      }

      type UserAsNonJSONType = UserAsType & {
        date: Date; // Forcing an invalid type
        method: () => void; // Forcing an invalid type
      };

      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: UserAsNonJSONInterface;
        };
        response: {
          200: {
            headers?: { 'content-type'?: string };
            body: UserAsNonJSONType;
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
        const requestDate = new Date().toISOString();
        const responseDate = new Date().toISOString();

        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users/:id').respond((request) => {
            expectTypeOf(request.body).not.toEqualTypeOf<UserAsNonJSONInterface>();
            expectTypeOf(request.body).toEqualTypeOf<JSONSerialized<UserAsNonJSONInterface>>();
            expect(request.body).toEqual({ ...users[0], date: requestDate });

            return {
              status: 200,
              body: { ...users[0], date: responseDate },
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...users[0], date: requestDate }),
        });
        expect(response.status).toBe(200);

        const fetchedUser = (await response.json()) as UserAsInterface;
        expect(fetchedUser).toEqual({ ...users[0], date: responseDate });

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.body).not.toEqualTypeOf<UserAsNonJSONInterface>();
        expectTypeOf(request.body).toEqualTypeOf<JSONSerialized<UserAsNonJSONInterface>>();
        expect(request.body).toEqual({ ...users[0], date: requestDate });

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.response.body).not.toEqualTypeOf<UserAsNonJSONType>();
        expectTypeOf(request.response.body).toEqualTypeOf<JSONSerialized<UserAsNonJSONType>>();
        expect(request.response.body).toEqual({ ...users[0], date: responseDate });

        expectTypeOf(request.raw).not.toEqualTypeOf<HttpRequest<UserAsNonJSONInterface>>();
        expectTypeOf(request.raw).toEqualTypeOf<HttpRequest<JSONSerialized<UserAsNonJSONInterface>>>();
        expect(request.raw).toBeInstanceOf(Request);
        expect(request.raw.url).toBe(request.url);
        expect(request.raw.method).toBe(method);
        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).not.toEqualTypeOf<() => Promise<UserAsNonJSONInterface>>();
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<JSONSerialized<UserAsNonJSONInterface>>>();
        expect(await request.raw.json()).toEqual<JSONSerialized<UserAsNonJSONInterface>>({
          ...users[0],
          date: requestDate,
        });
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();

        expectTypeOf(request.response.raw).toEqualTypeOf<HttpResponse<JSONSerialized<UserAsNonJSONType>, 200>>();
        expect(request.response.raw).toBeInstanceOf(Response);
        expectTypeOf(request.response.raw.status).toEqualTypeOf<200>();
        expect(request.response.raw.status).toBe(200);
        expect(Object.fromEntries(response.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.response.raw.headers)),
        );
        expectTypeOf(request.response.raw.json).toEqualTypeOf<() => Promise<JSONSerialized<UserAsNonJSONType>>>();
        expect(await request.response.raw.json()).toEqual<JSONSerialized<UserAsNonJSONType>>({
          ...users[0],
          date: responseDate,
        });
        expectTypeOf(request.response.raw.formData).toEqualTypeOf<() => Promise<FormData>>();
      });
    });

    it(`should support intercepting ${method} requests having a number as JSON body`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: number;
        };
        response: {
          200: {
            headers?: { 'content-type'?: string };
            body: number;
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
            expectTypeOf(request.body).toEqualTypeOf<number>();
            expect(request.body).toBe(1);

            return { status: 200, body: 2 };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(1),
        });
        expect(response.status).toBe(200);

        const fetchedBody = (await response.json()) as number;
        expect(fetchedBody).toBe(2);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.body).toEqualTypeOf<number>();
        expect(request.body).toBe(1);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.response.body).toEqualTypeOf<number>();
        expect(request.response.body).toBe(2);

        expectTypeOf(request.raw).toEqualTypeOf<HttpRequest<number>>();
        expect(request.raw).toBeInstanceOf(Request);
        expect(request.raw.url).toBe(request.url);
        expect(request.raw.method).toBe(method);
        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<number>>();
        expect(await request.raw.json()).toEqual<number>(1);
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();

        expectTypeOf(request.response.raw).toEqualTypeOf<HttpResponse<number, 200>>();
        expect(request.response.raw).toBeInstanceOf(Response);
        expectTypeOf(request.response.raw.status).toEqualTypeOf<200>();
        expect(request.response.raw.status).toBe(200);
        expect(Object.fromEntries(response.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.response.raw.headers)),
        );
        expectTypeOf(request.response.raw.json).toEqualTypeOf<() => Promise<number>>();
        expect(await request.response.raw.json()).toEqual<number>(2);
        expectTypeOf(request.response.raw.formData).toEqualTypeOf<() => Promise<FormData>>();
      });
    });

    it(`should support intercepting ${method} requests having a boolean as JSON body`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: boolean;
        };
        response: {
          200: {
            headers?: { 'content-type'?: string };
            body: boolean;
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
            expectTypeOf(request.body).toEqualTypeOf<boolean>();
            expect(request.body).toBe(true);

            return { status: 200, body: false };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(true),
        });
        expect(response.status).toBe(200);

        const fetchedBody = (await response.json()) as boolean;
        expect(fetchedBody).toBe(false);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.body).toEqualTypeOf<boolean>();
        expect(request.body).toBe(true);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.response.body).toEqualTypeOf<boolean>();
        expect(request.response.body).toBe(false);

        expectTypeOf(request.raw).toEqualTypeOf<HttpRequest<boolean>>();
        expect(request.raw).toBeInstanceOf(Request);
        expect(request.raw.url).toBe(request.url);
        expect(request.raw.method).toBe(method);
        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<boolean>>();
        expect(await request.raw.json()).toEqual<boolean>(true);
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();

        expectTypeOf(request.response.raw).toEqualTypeOf<HttpResponse<boolean, 200>>();
        expect(request.response.raw).toBeInstanceOf(Response);
        expectTypeOf(request.response.raw.status).toEqualTypeOf<200>();
        expect(request.response.raw.status).toBe(200);
        expect(Object.fromEntries(response.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.response.raw.headers)),
        );
        expectTypeOf(request.response.raw.json).toEqualTypeOf<() => Promise<boolean>>();
        expect(await request.response.raw.json()).toEqual<boolean>(false);
        expectTypeOf(request.response.raw.formData).toEqualTypeOf<() => Promise<FormData>>();
      });
    });

    it(`should try to parse the body of a ${method} request or response as JSON if no content type exists`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: UserAsType;
        };
        response: {
          200: {
            headers: { 'content-type': string };
            body: UserAsType;
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
            expectTypeOf(request.body).toEqualTypeOf<UserAsType>();
            expect(request.body).toEqual(users[0]);

            return {
              status: 200,
              headers: { 'content-type': '' },
              body: users[0],
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': '' },
          body: JSON.stringify(users[0]),
        });
        expect(response.status).toBe(200);

        const fetchedUser = (await response.json()) as UserAsType;
        expect(fetchedUser).toEqual(users[0]);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('');
        expectTypeOf(request.body).toEqualTypeOf<UserAsType>();
        expect(request.body).toEqual(users[0]);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('');
        expectTypeOf(request.response.body).toEqualTypeOf<UserAsType>();
        expect(request.response.body).toEqual(users[0]);
      });
    });

    it(`should fallback the body of a ${method} request or response to text if could not be parsed as JSON and no content type exists`, async () => {
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
            expect(request.body).toBe(invalidRequestJSONString);

            return {
              status: 200,
              headers: { 'content-type': '' },
              body: invalidResponseJSONString,
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': '' },
          body: invalidRequestJSONString,
        });
        expect(response.status).toBe(200);

        const fetchedBody = await response.text();
        expect(fetchedBody).toBe(invalidResponseJSONString);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('');
        expectTypeOf(request.body).toEqualTypeOf<string>();
        expect(request.body).toBe(invalidRequestJSONString);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('');
        expectTypeOf(request.response.body).toEqualTypeOf<string>();
        expect(request.response.body).toBe(invalidResponseJSONString);
      });
    });

    it(`should try to parse the body of a ${method} request or response as JSON if the body contains an unknown content type`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: UserAsType;
        };
        response: {
          200: {
            headers: { 'content-type': string };
            body: UserAsType;
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
            expectTypeOf(request.body).toEqualTypeOf<UserAsType>();
            expect(request.body).toEqual(users[0]);

            return {
              status: 200,
              headers: { 'content-type': 'unknown' },
              body: users[0],
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'unknown' },
          body: JSON.stringify(users[0]),
        });
        expect(response.status).toBe(200);

        const fetchedUser = (await response.json()) as UserAsType;
        expect(fetchedUser).toEqual(users[0]);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('unknown');
        expectTypeOf(request.body).toEqualTypeOf<UserAsType>();
        expect(request.body).toEqual(users[0]);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('unknown');
        expectTypeOf(request.response.body).toEqualTypeOf<UserAsType>();
        expect(request.response.body).toEqual(users[0]);
      });
    });

    it(`should fallback the body of a ${method} request or response to text if could not be parsed as JSON and the content type is unknown`, async () => {
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
            expect(request.body).toBe(invalidRequestJSONString);

            return {
              status: 200,
              headers: { 'content-type': 'unknown' },
              body: invalidResponseJSONString,
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'unknown' },
          body: invalidRequestJSONString,
        });
        expect(response.status).toBe(200);

        const fetchedBody = await response.text();
        expect(fetchedBody).toBe(invalidResponseJSONString);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('unknown');
        expectTypeOf(request.body).toEqualTypeOf<string>();
        expect(request.body).toBe(invalidRequestJSONString);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('unknown');
        expectTypeOf(request.response.body).toEqualTypeOf<string>();
        expect(request.response.body).toBe(invalidResponseJSONString);
      });
    });

    it(`should show an error and skip parsing if the body of a ${method} request or response is defined as JSON, but it is not valid`, async () => {
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
            expect(request.body).toBe(null);

            return {
              status: 200,
              headers: { 'content-type': 'application/json' },
              body: invalidResponseJSONString,
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        await usingIgnoredConsole(['error'], async (spies) => {
          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            headers: { 'content-type': 'application/json' },
            body: invalidRequestJSONString,
          });
          expect(response.status).toBe(200);

          const fetchedBody = await response.text();
          expect(fetchedBody).toBe(invalidResponseJSONString);

          expect(spies.error).toHaveBeenCalledTimes(2);
          expect(spies.error.mock.calls).toEqual([
            [new InvalidJSONError(invalidRequestJSONString)],
            [new InvalidJSONError(invalidResponseJSONString)],
          ]);
        });

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.body).toEqualTypeOf<string>();
        expect(request.body).toBe(null);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.response.body).toEqualTypeOf<string>();
        expect(request.response.body).toBe(null);
      });
    });

    it(`should consider empty ${method} request or response JSON bodies as null`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body?: UserAsType;
        };
        response: {
          200: {
            headers: { 'content-type': string };
            body?: UserAsType;
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
            expectTypeOf(request.body).toEqualTypeOf<UserAsType | null>();
            expect(request.body).toBe(null);

            return {
              status: 200,
              headers: { 'content-type': 'application/json' },
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/json' },
        });
        expect(response.status).toBe(200);

        const fetchedBody = await response.text();
        expect(fetchedBody).toBe('');

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.body).toEqualTypeOf<UserAsType | null>();
        expect(request.body).toBe(null);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.response.body).toEqualTypeOf<UserAsType | null>();
        expect(request.response.body).toBe(null);
      });
    });
  });
}
