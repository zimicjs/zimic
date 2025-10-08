import { HttpSchema, HttpRequest, HttpResponse, JSONSerialized, JSONValue, InvalidJSONError } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import color from 'picocolors';
import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { importCrypto } from '@/utils/crypto';
import { HTTP_METHODS_WITH_REQUEST_BODY } from '@/utils/http';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../utils';

export async function declareJSONBodyHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

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

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  describe.each(Array.from(HTTP_METHODS_WITH_REQUEST_BODY))('Method (%s)', (method) => {
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
            headers?: { 'content-type'?: 'application/json; charset=utf-8' };
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

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(users[0]),
        });
        expect(response.status).toBe(200);

        const fetchedUser = (await response.json()) as UserAsType;
        expect(fetchedUser).toEqual(users[0]);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.body).toEqualTypeOf<UserAsType>();
        expect(request.body).toEqual(users[0]);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.response.body).toEqualTypeOf<UserAsType>();
        expect(request.response.body).toEqual(users[0]);

        expectTypeOf(request.raw).toEqualTypeOf<HttpRequest<UserAsType, { 'content-type': string }>>();
        expect(request.raw).toBeInstanceOf(Request);
        expect(request.raw.url).toBe(request.url);
        expect(request.raw.method).toBe(method);
        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<UserAsType>>();
        expect(await request.raw.json()).toEqual<UserAsType>(users[0]);
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();

        expectTypeOf(request.response.raw).toEqualTypeOf<
          HttpResponse<UserAsType, { 'content-type'?: 'application/json; charset=utf-8' }, 200>
        >();
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
            headers?: { 'content-type'?: 'application/json; charset=utf-8' };
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

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(users[0]),
        });
        expect(response.status).toBe(200);

        const fetchedUser = (await response.json()) as UserAsInterface;
        expect(fetchedUser).toEqual(users[0]);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.body).toEqualTypeOf<UserAsInterface>();
        expect(request.body).toEqual(users[0]);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.response.body).toEqualTypeOf<UserAsInterface>();
        expect(request.response.body).toEqual(users[0]);

        expectTypeOf(request.raw).toEqualTypeOf<HttpRequest<UserAsInterface, { 'content-type': string }>>();
        expect(request.raw).toBeInstanceOf(Request);
        expect(request.raw.url).toBe(request.url);
        expect(request.raw.method).toBe(method);
        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<UserAsInterface>>();
        expect(await request.raw.json()).toEqual<UserAsInterface>(users[0]);
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();

        expectTypeOf(request.response.raw).toEqualTypeOf<
          HttpResponse<UserAsInterface, { 'content-type'?: 'application/json; charset=utf-8' }, 200>
        >();
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
        date?: Date; // Forcing an invalid type
        method?: () => void; // Forcing an invalid type
      }

      type UserAsNonJSONType = UserAsType & {
        date?: Date; // Forcing an invalid type
        method?: () => void; // Forcing an invalid type
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
        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users/:id').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<UserAsNonJSONInterface>();
            expect(request.body).toEqual(users[0]);

            return { status: 200, body: users[0] };
          }),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(users[0]),
        });
        expect(response.status).toBe(200);

        const fetchedUser = (await response.json()) as UserAsInterface;
        expect(fetchedUser).toEqual(users[0]);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.body).toEqualTypeOf<UserAsNonJSONInterface>();
        expect(request.body).toEqual(users[0]);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.response.body).toEqualTypeOf<UserAsNonJSONType>();
        expect(request.response.body).toEqual(users[0]);

        expectTypeOf(request.raw).toEqualTypeOf<HttpRequest<UserAsNonJSONInterface, { 'content-type': string }>>();
        expect(request.raw).toBeInstanceOf(Request);
        expect(request.raw.url).toBe(request.url);
        expect(request.raw.method).toBe(method);
        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<UserAsNonJSONInterface>>();
        expect(await request.raw.json()).toEqual<JSONSerialized<UserAsNonJSONInterface>>(users[0]);
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();

        expectTypeOf(request.response.raw).toEqualTypeOf<
          HttpResponse<UserAsNonJSONType, { 'content-type'?: string }, 200>
        >();
        expect(request.response.raw).toBeInstanceOf(Response);
        expectTypeOf(request.response.raw.status).toEqualTypeOf<200>();
        expect(request.response.raw.status).toBe(200);
        expect(Object.fromEntries(response.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.response.raw.headers)),
        );
        expectTypeOf(request.response.raw.json).toEqualTypeOf<() => Promise<UserAsNonJSONType>>();
        expect(await request.response.raw.json()).toEqual<JSONSerialized<UserAsNonJSONType>>(users[0]);
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

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(1),
        });
        expect(response.status).toBe(200);

        const fetchedBody = (await response.json()) as number;
        expect(fetchedBody).toBe(2);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.body).toEqualTypeOf<number>();
        expect(request.body).toBe(1);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.response.body).toEqualTypeOf<number>();
        expect(request.response.body).toBe(2);

        expectTypeOf(request.raw).toEqualTypeOf<HttpRequest<number, { 'content-type': string }>>();
        expect(request.raw).toBeInstanceOf(Request);
        expect(request.raw.url).toBe(request.url);
        expect(request.raw.method).toBe(method);
        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<number>>();
        expect(await request.raw.json()).toEqual<number>(1);
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();

        expectTypeOf(request.response.raw).toEqualTypeOf<HttpResponse<number, { 'content-type'?: string }, 200>>();
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

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(true),
        });
        expect(response.status).toBe(200);

        const fetchedBody = (await response.json()) as boolean;
        expect(fetchedBody).toBe(false);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.body).toEqualTypeOf<boolean>();
        expect(request.body).toBe(true);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/json');
        expectTypeOf(request.response.body).toEqualTypeOf<boolean>();
        expect(request.response.body).toBe(false);

        expectTypeOf(request.raw).toEqualTypeOf<HttpRequest<boolean, { 'content-type': string }>>();
        expect(request.raw).toBeInstanceOf(Request);
        expect(request.raw.url).toBe(request.url);
        expect(request.raw.method).toBe(method);
        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<boolean>>();
        expect(await request.raw.json()).toEqual<boolean>(true);
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();

        expectTypeOf(request.response.raw).toEqualTypeOf<HttpResponse<boolean, { 'content-type'?: string }, 200>>();
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

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': '' },
          body: JSON.stringify(users[0]),
        });
        expect(response.status).toBe(200);

        const fetchedUser = (await response.json()) as UserAsType;
        expect(fetchedUser).toEqual(users[0]);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

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
          body: Blob;
        };
        response: {
          200: {
            headers: { 'content-type': string };
            body: Blob;
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
          interceptor[lowerMethod]('/users/:id').respond(async (request) => {
            expectTypeOf(request.body).toEqualTypeOf<Blob>();
            expect(request.body).toBeInstanceOf(Blob);
            expect(request.body.size).toBe(invalidRequestJSONString.length);
            expect(await request.body.text()).toBe(invalidRequestJSONString);

            return {
              status: 200,
              headers: { 'content-type': '' },
              body: new Blob([invalidResponseJSONString]),
            };
          }),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': '' },
          body: invalidRequestJSONString,
        });
        expect(response.status).toBe(200);

        const fetchedBody = await response.text();
        expect(fetchedBody).toBe(invalidResponseJSONString);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('');
        expectTypeOf(request.body).toEqualTypeOf<Blob>();
        expect(request.body).toBeInstanceOf(Blob);
        expect(request.body.size).toBe(invalidRequestJSONString.length);
        expect(await request.body.text()).toBe(invalidRequestJSONString);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('');
        expectTypeOf(request.response.body).toEqualTypeOf<Blob>();
        expect(request.response.body).toBeInstanceOf(Blob);
        expect(request.response.body.size).toBe(invalidResponseJSONString.length);
        expect(await request.response.body.text()).toBe(invalidResponseJSONString);
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

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'unknown' },
          body: JSON.stringify(users[0]),
        });
        expect(response.status).toBe(200);

        const fetchedUser = (await response.json()) as UserAsType;
        expect(fetchedUser).toEqual(users[0]);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

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
          body: Blob;
        };
        response: {
          200: {
            headers: { 'content-type': string };
            body: Blob;
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
          interceptor[lowerMethod]('/users/:id').respond(async (request) => {
            expectTypeOf(request.body).toEqualTypeOf<Blob>();
            expect(request.body).toBeInstanceOf(Blob);
            expect(request.body.size).toBe(invalidRequestJSONString.length);
            expect(await request.body.text()).toBe(invalidRequestJSONString);

            return {
              status: 200,
              headers: { 'content-type': 'unknown' },
              body: new Blob([invalidResponseJSONString]),
            };
          }),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'unknown' },
          body: invalidRequestJSONString,
        });
        expect(response.status).toBe(200);

        const fetchedBody = await response.text();
        expect(fetchedBody).toBe(invalidResponseJSONString);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('unknown');
        expectTypeOf(request.body).toEqualTypeOf<Blob>();
        expect(request.body).toBeInstanceOf(Blob);
        expect(request.body.size).toBe(invalidRequestJSONString.length);
        expect(await request.body.text()).toBe(invalidRequestJSONString);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('unknown');
        expectTypeOf(request.response.body).toEqualTypeOf<Blob>();
        expect(request.response.body).toBeInstanceOf(Blob);
        expect(request.response.body.size).toBe(invalidResponseJSONString.length);
        expect(await request.response.body.text()).toBe(invalidResponseJSONString);
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

        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['error'], async (console) => {
          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            headers: { 'content-type': 'application/json' },
            body: invalidRequestJSONString,
          });
          expect(response.status).toBe(200);

          const fetchedBody = await response.text();
          expect(fetchedBody).toBe(invalidResponseJSONString);

          expect(console.error).toHaveBeenCalledTimes(2);
          expect(console.error.mock.calls).toEqual([
            [
              color.cyan('[@zimic/interceptor]'),
              'Failed to parse request body:',
              new InvalidJSONError(invalidRequestJSONString),
            ],
            [
              color.cyan('[@zimic/interceptor]'),
              'Failed to parse response body:',
              new InvalidJSONError(invalidResponseJSONString),
            ],
          ]);
        });

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

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

    it.each(['', undefined, null])(
      `should consider empty ${method} request or response JSON bodies as null`,
      async (body) => {
        type MethodSchema = HttpSchema.Method<{
          request: {
            headers: { 'content-type': string };
            body?: string | null;
          };
          response: {
            200: {
              headers: { 'content-type': string };
              body?: string | null;
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
                headers: { 'content-type': 'application/json' },
                body,
              };
            }),
            interceptor,
          );

          expect(handler.requests).toHaveLength(0);

          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            headers: { 'content-type': 'application/json' },
          });
          expect(response.status).toBe(200);

          const fetchedBody = await response.text();
          expect(fetchedBody).toBe('');

          expect(handler.requests).toHaveLength(1);
          const [request] = handler.requests;

          expect(request).toBeInstanceOf(Request);
          expect(request.headers.get('content-type')).toBe('application/json');
          expectTypeOf(request.body).toEqualTypeOf<string | null>();
          expect(request.body).toBe(null);

          expect(request.response).toBeInstanceOf(Response);
          expect(request.response.headers.get('content-type')).toBe('application/json');
          expectTypeOf(request.response.body).toEqualTypeOf<string | null>();
          expect(request.response.body).toBe(null);
        });
      },
    );
  });
}
