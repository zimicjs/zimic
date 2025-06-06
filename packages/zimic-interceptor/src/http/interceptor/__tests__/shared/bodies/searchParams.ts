import { HttpSearchParams, HttpRequest, HttpResponse, StrictFormData, HttpSchema } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/http/requestHandler/RemoteHttpRequestHandler';
import { importCrypto } from '@/utils/crypto';
import { HTTP_METHODS_WITH_REQUEST_BODY } from '@/utils/http';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../utils';

export async function declareSearchParamsBodyHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
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

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  const Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  describe.each(Array.from(HTTP_METHODS_WITH_REQUEST_BODY))('Method (%s)', (method) => {
    const lowerMethod = method.toLowerCase<'POST'>();

    const invalidRequestURLSearchParamsString = '<invalid-request-url-search-params>';
    const invalidResponseURLSearchParamsString = '<invalid-response-url-search-params>';

    type UserSearchParamsSchema = HttpSchema.SearchParams<{
      tag?: string;
    }>;

    it(`should support intercepting ${method} requests having a URL search params body`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: HttpSearchParams<UserSearchParamsSchema>;
        };
        response: {
          200: {
            headers?: { 'content-type'?: string };
            body: HttpSearchParams<UserSearchParamsSchema>;
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
        const responseSearchParams = new HttpSearchParams<UserSearchParamsSchema>({ tag: 'admin-response' });

        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users/:id').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<HttpSearchParams<UserSearchParamsSchema>>();
            expect(request.body).toBeInstanceOf(HttpSearchParams);

            return { status: 200, body: responseSearchParams };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        expect(handler.requests).toHaveLength(0);

        const searchParams = new HttpSearchParams<UserSearchParamsSchema>({ tag: 'admin' });

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          body: searchParams,
        });
        expect(response.status).toBe(200);

        const fetchedSearchParams = await response.formData();
        expect(fetchedSearchParams).toBeInstanceOf(FormData);
        expect(Array.from(fetchedSearchParams.keys())).toEqual(Array.from(responseSearchParams.keys()));

        const fetchedTag = fetchedSearchParams.get('tag')!;
        expect(fetchedTag).toBe(responseSearchParams.get('tag'));

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/x-www-form-urlencoded;charset=UTF-8');
        expectTypeOf(request.body).toEqualTypeOf<HttpSearchParams<UserSearchParamsSchema>>();
        expect(request.body).toBeInstanceOf(HttpSearchParams);
        expect(request.body).toEqual(searchParams);
        expect(request.body.get('tag')).toEqual('admin');

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/x-www-form-urlencoded;charset=UTF-8');
        expectTypeOf(request.response.body).toEqualTypeOf<HttpSearchParams<UserSearchParamsSchema>>();
        expect(request.response.body).toBeInstanceOf(HttpSearchParams);
        expect(request.response.body).toEqual(responseSearchParams);

        expectTypeOf(request.raw).toEqualTypeOf<
          HttpRequest<HttpSearchParams<UserSearchParamsSchema>, { 'content-type': string }>
        >();
        expect(request.raw).toBeInstanceOf(Request);
        expect(request.raw.url).toBe(request.url);
        expect(request.raw.method).toBe(method);
        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<StrictFormData<UserSearchParamsSchema>>>();

        expectTypeOf(request.response.raw).toEqualTypeOf<
          HttpResponse<HttpSearchParams<UserSearchParamsSchema>, { 'content-type'?: string }, 200>
        >();
        expect(request.response.raw).toBeInstanceOf(Response);
        expectTypeOf(request.response.raw.status).toEqualTypeOf<200>();
        expect(request.response.raw.status).toBe(200);
        expect(Object.fromEntries(response.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.response.raw.headers)),
        );
        expectTypeOf(request.response.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.response.raw.formData).toEqualTypeOf<
          () => Promise<StrictFormData<UserSearchParamsSchema>>
        >();
      });
    });

    it(`should not show an error and skip parsing if the body of a ${method} request or response is defined as URL search params, but it is not valid`, async () => {
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
            expect(request.body).toBeInstanceOf(HttpSearchParams);
            expect(request.body).toEqual(new HttpSearchParams({ [invalidRequestURLSearchParamsString]: '' }));

            return {
              status: 200,
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              body: invalidResponseURLSearchParamsString,
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['error'], async (console) => {
          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: invalidRequestURLSearchParamsString,
          });
          expect(response.status).toBe(200);

          expect(console.error).not.toHaveBeenCalled();
        });

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
        expectTypeOf(request.body).toEqualTypeOf<string>();
        expect(request.body).toBeInstanceOf(HttpSearchParams);
        expect(request.body).toEqual(new HttpSearchParams({ [invalidRequestURLSearchParamsString]: '' }));

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
        expectTypeOf(request.response.body).toEqualTypeOf<string>();
        expect(request.response.body).toBeInstanceOf(HttpSearchParams);
        expect(request.response.body).toEqual(new HttpSearchParams({ [invalidResponseURLSearchParamsString]: '' }));
      });
    });

    it(`should consider empty ${method} request or response URL search params bodies as null`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body?: HttpSearchParams<UserSearchParamsSchema>;
        };
        response: {
          200: {
            headers: { 'content-type': string };
            body?: HttpSearchParams<UserSearchParamsSchema>;
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
            expectTypeOf(request.body).toEqualTypeOf<HttpSearchParams<UserSearchParamsSchema> | null>();
            expect(request.body).toBe(null);

            return {
              status: 200,
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        });
        expect(response.status).toBe(200);

        const fetchedSearchParams = await response.text();
        expect(fetchedSearchParams).toBe('');

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
        expectTypeOf(request.body).toEqualTypeOf<HttpSearchParams<UserSearchParamsSchema> | null>();
        expect(request.body).toBe(null);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
        expectTypeOf(request.response.body).toEqualTypeOf<HttpSearchParams<UserSearchParamsSchema> | null>();
        expect(request.response.body).toBe(null);
      });
    });
  });
}
