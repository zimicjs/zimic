import { describe, expect, expectTypeOf, it } from 'vitest';

import { HttpSchema, MergeHttpResponsesByStatusCode } from '@/http';
import { joinURL } from '@/utils/urls';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import FetchResponseError from '../errors/FetchResponseError';
import createFetch from '../factory';
import { InferFetchSchema } from '../types/public';
import { FetchResponse, FetchResponsePerStatusCode } from '../types/requests';

describe('FetchClient (node) > Types', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  it('should correctly type responses with merged status codes', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: MergeHttpResponsesByStatusCode<
            [
              {
                200: { headers: { 'content-type': string }; body: User[] };
                204: { body: '204' };
                400: { body: { message: string } };
              },
              {
                201: { body: '201' };
                400: { body: '400' };
              },
              { 401: {} },
            ]
          >;
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .respond({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: users,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200 | 201 | 204 | 400 | 401>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.json).toEqualTypeOf<
        (() => Promise<User[]>) | (() => Promise<never>) | (() => Promise<null>) | (() => Promise<{ message: string }>)
      >();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 200>)
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 201>)
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 204>)
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 400>)
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 401>)
      >();

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<'/users', 'GET', Schema['/users']['GET']> | null>();

      expect(response.ok).toBe(true);

      /* istanbul ignore if -- @preserve
       * response.ok is true. This if is necessary to narrow the response to a successful type. */
      if (!response.ok) {
        expectTypeOf(response.status).toEqualTypeOf<400 | 401>();
        expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<'/users', 'GET', Schema['/users']['GET']>>();

        throw response.error;
      }

      expectTypeOf(response.status).toEqualTypeOf<200 | 201 | 204>();

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        | FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 200>
        | FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 201>
        | FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 204>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.clone).toEqualTypeOf<
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 200>)
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 201>)
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 204>)
      >();

      expectTypeOf(response.error).toEqualTypeOf<null>();
      expect(response.error).toBe(null);
    });
  });

  it('should support declaring schemas using type composition', () => {
    const _inlineFetch = createFetch<{
      '/users': {
        POST: {
          request: { body: User };
          response: {
            201: { body: User };
          };
        };
      };

      '/users/:id': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ baseURL });

    type UserCreationRequest = HttpSchema.Request<{
      body: User;
    }>;

    type UserCreationResponse = HttpSchema.Response<{
      body: User;
    }>;

    type UserCreationResponseByStatusCode = HttpSchema.ResponseByStatusCode<{
      201: UserCreationResponse;
    }>;

    type UserCreationMethod = HttpSchema.Method<{
      request: UserCreationRequest;
      response: UserCreationResponseByStatusCode;
    }>;

    type UserCreationMethods = HttpSchema.Methods<{
      POST: UserCreationMethod;
    }>;

    type UserGetResponse = HttpSchema.Response<{
      body: User;
    }>;

    type UserGetResponseByStatusCode = HttpSchema.ResponseByStatusCode<{
      200: UserGetResponse;
    }>;

    type UserGetMethod = HttpSchema.Method<{
      response: UserGetResponseByStatusCode;
    }>;

    type UserGetMethods = HttpSchema.Methods<{
      GET: UserGetMethod;
    }>;

    type UserPaths = HttpSchema<{
      '/users': UserCreationMethods;
    }>;

    type UserByIdPaths = HttpSchema<{
      '/users/:id': UserGetMethods;
    }>;

    type Schema = HttpSchema<UserPaths & UserByIdPaths>;

    const _compositeFetch = createFetch<Schema>({ baseURL });

    type CompositeFetchSchema = InferFetchSchema<typeof _compositeFetch>;
    type InlineFetchSchema = InferFetchSchema<typeof _inlineFetch>;
    expectTypeOf<CompositeFetchSchema>().toEqualTypeOf<InlineFetchSchema>();
  });
});
