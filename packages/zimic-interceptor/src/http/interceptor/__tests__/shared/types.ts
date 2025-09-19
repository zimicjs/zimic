import { HttpHeaders, HttpSearchParams, HttpSchema, HttpStatusCode, MergeHttpResponsesByStatusCode } from '@zimic/http';
import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { HttpRequestHandlerPath } from '@/http/requestHandler/types/utils';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { createHttpInterceptor } from '../../factory';
import { UnhandledRequestStrategy } from '../../types/options';
import { HttpInterceptor } from '../../types/public';
import { InferHttpInterceptorSchema } from '../../types/schema';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareTypeHttpInterceptorTests(
  options: Omit<RuntimeSharedHttpInterceptorTestsOptions, 'getInterceptorOptions'>,
) {
  const { type, getBaseURL } = options;

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  let baseURL: string;

  beforeEach(() => {
    baseURL = getBaseURL();
  });

  it('should correctly type requests', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: { body: User };
          response: { 201: { body: User } };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const _creationHandler = await interceptor.post('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<User>();

        return {
          status: 201,
          body: users[0],
        };
      });

      type RequestBody = (typeof _creationHandler.requests)[number]['body'];
      expectTypeOf<RequestBody>().toEqualTypeOf<User>();
    });
  });

  it('should correctly type requests with search params', async () => {
    type UserListSearchParams = HttpSchema.SearchParams<{
      name: string;
      usernames: string[];
      orderBy?: ('name' | 'createdAt')[];
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          request: {
            searchParams: UserListSearchParams;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const _listHandler = await interceptor.get('/users').respond((request) => {
        expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();

        return {
          status: 200,
          body: users[0],
        };
      });

      type RequestSearchParams = (typeof _listHandler.requests)[number]['searchParams'];
      expectTypeOf<RequestSearchParams>().toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
    });
  });

  it('should correctly type requests with search params containing invalid types', async () => {
    interface UserListSearchParams {
      name: string;
      usernames: string[];
      orderBy?: ('name' | 'createdAt')[];
      date?: Date; // Forcing an invalid type
      method?: () => void; // Forcing an invalid type
    }

    await usingHttpInterceptor<
      HttpSchema<{
        '/users': {
          GET: {
            request: {
              searchParams: UserListSearchParams;
            };
            response: {
              200: { body: User };
            };
          };
        };
      }>
    >({ type, baseURL }, async (interceptor) => {
      const _listHandler = await interceptor.get('/users').respond((request) => {
        expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();

        return { status: 200, body: users[0] };
      });

      type RequestSearchParams = (typeof _listHandler.requests)[number]['searchParams'];
      expectTypeOf<RequestSearchParams>().toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
    });
  });

  it('should correctly type requests with no search params', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: { 200: { body: User } };
        } & {
          request: {};
          response: { 200: { body: User } };
        } & {
          request: never;
          response: { 200: { body: User } };
        } & {
          request: { searchParams: {} };
          response: { 200: { body: User } };
        } & {
          request: { searchParams: never };
          response: { 200: { body: User } };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const _listHandler = await interceptor.get('/users').respond((request) => {
        expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<never>>();

        return {
          status: 200,
          body: users[0],
        };
      });

      type RequestSearchParams = (typeof _listHandler.requests)[number]['searchParams'];
      expectTypeOf<RequestSearchParams>().toEqualTypeOf<HttpSearchParams<never>>();
    });
  });

  it('should correctly type requests with headers', async () => {
    type UserListHeaders = HttpSchema.Headers<{
      accept: string;
      'content-language': string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          request: {
            headers: UserListHeaders;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const _listHandler = await interceptor.get('/users').respond((request) => {
        expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserListHeaders>>();

        return {
          status: 200,
          body: users[0],
        };
      });

      type RequestHeaders = (typeof _listHandler.requests)[number]['headers'];
      expectTypeOf<RequestHeaders>().toEqualTypeOf<HttpHeaders<UserListHeaders>>();
    });
  });

  it('should correctly type requests with headers containing invalid types', async () => {
    interface UserListHeaders {
      accept: string;
      'content-language': string;
      date?: Date; // Forcing an invalid type
      method?: () => void; // Forcing an invalid type
    }

    await usingHttpInterceptor<
      HttpSchema<{
        '/users': {
          GET: {
            request: {
              headers: UserListHeaders;
            };
            response: {
              200: { body: User };
            };
          };
        };
      }>
    >({ type, baseURL }, async (interceptor) => {
      const _listHandler = await interceptor.get('/users').respond((request) => {
        expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserListHeaders>>();

        return { status: 200, body: users[0] };
      });

      type RequestHeaders = (typeof _listHandler.requests)[number]['headers'];
      expectTypeOf<RequestHeaders>().toEqualTypeOf<HttpHeaders<UserListHeaders>>();
    });
  });

  it('should correctly type requests with headers containing only `content-type`', async () => {
    type UserListHeaders = HttpSchema.Headers<{
      'content-type': string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          request: {
            headers: UserListHeaders;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const _listHandler = await interceptor.get('/users').respond((request) => {
        expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserListHeaders>>();

        return {
          status: 200,
          body: users[0],
        };
      });

      type RequestHeaders = (typeof _listHandler.requests)[number]['headers'];
      expectTypeOf<RequestHeaders>().toEqualTypeOf<HttpHeaders<UserListHeaders>>();
    });
  });

  it('should correctly type requests with no headers', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: { 200: { body: User } };
        } & {
          request: {};
          response: { 200: { body: User } };
        } & {
          request: never;
          response: { 200: { body: User } };
        } & {
          request: { headers: {} };
          response: { 200: { body: User } };
        } & {
          request: { headers: never };
          response: { 200: { body: User } };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const _listHandler = await interceptor.get('/users').respond((request) => {
        expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<never>>();

        return {
          status: 200,
          body: users[0],
        };
      });

      type RequestHeaders = (typeof _listHandler.requests)[number]['headers'];
      expectTypeOf<RequestHeaders>().toEqualTypeOf<HttpHeaders<never>>();
    });
  });

  it('should correctly type responses with a single status code', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
            500: { body: { message: string } };
          };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const successfulHandlers = await Promise.all([
        Promise.resolve(interceptor.get('/users').respond({ status: 200, body: users })),
        Promise.resolve(interceptor.get('/users').respond(() => ({ status: 200, body: users }))),
      ]);

      for (const _handler of successfulHandlers) {
        type SuccessfulResponseBody = (typeof _handler.requests)[number]['response']['body'];
        expectTypeOf<SuccessfulResponseBody>().toEqualTypeOf<User[]>();
      }

      const failedHandlers = [
        interceptor.get('/users').respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        interceptor.get('/users').respond(() => ({
          status: 500,
          body: { message: 'Internal server error' },
        })),
      ];

      for (const _handler of failedHandlers) {
        type FailedResponseBody = (typeof _handler.requests)[number]['response']['body'];
        expectTypeOf<FailedResponseBody>().toEqualTypeOf<{ message: string }>();
      }
    });
  });

  it('should correctly type responses with multiple status codes', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          request: {
            searchParams: { name?: string };
          };
          response: {
            200: {
              headers: { 'content-type': string };
              body: User[];
            };
            400: {
              body: { message: string };
            };
            404: {};
          };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const _handler = await interceptor.get('/users').respond((request) => {
        const name = request.searchParams.get('name');

        if (!name) {
          return {
            status: 400,
            body: { message: 'A name is required.' },
          };
        }

        if (name === 'not-found') {
          return { status: 404 };
        }

        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: users,
        };
      });

      type ResponseBody = (typeof _handler.requests)[number]['response']['body'];
      expectTypeOf<ResponseBody>().toEqualTypeOf<User[] | { message: string } | null>();

      type ResponseHeaders = (typeof _handler.requests)[number]['response']['headers'];
      expectTypeOf<ResponseHeaders>().toEqualTypeOf<
        | HttpHeaders<{ 'content-type': string }>
        | HttpHeaders<{ 'content-type': 'application/json' }>
        | HttpHeaders<never>
      >();

      type ResponseStatus = (typeof _handler.requests)[number]['response']['status'];
      expectTypeOf<ResponseStatus>().toEqualTypeOf<200 | 400 | 404>();

      // @ts-expect-error Each response declaration should match the status code
      await interceptor.get('/users').respond((request) => {
        const name = request.searchParams.get('name');

        if (!name) {
          return { status: 400 };
        }

        if (name === 'not-found') {
          return {
            status: 404,
            headers: { 'content-type': 'application/json' },
            body: users,
          };
        }

        return {
          status: 200,
          body: { message: 'A name is required.' },
        };
      });

      // @ts-expect-error The response declaration should match the schema
      await interceptor.get('/users').respond((request) => {
        const name = request.searchParams.get('name');

        if (!name) {
          return { status: 400, body: '' };
        }

        if (name === 'not-found') {
          return { status: 404, body: '' };
        }

        return { status: 200, body: '' };
      });
    });
  });

  it('should correctly type responses with merged status codes', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          request: {
            searchParams: { name?: string };
          };
          response: MergeHttpResponsesByStatusCode<
            [
              {
                200: { headers: { 'content-type': string }; body: User[] };
                204: {};
                400: { body: { message: string } };
              },
              {
                [StatusCode in HttpStatusCode.Success]: { body: '2xx' };
              },
              {
                201: { body: '201' };
                400: { body: '400' };
              },
              { 401: {} },
              {
                [StatusCode in HttpStatusCode.ClientError]: { body: '4xx' };
              },
              {
                [StatusCode in HttpStatusCode]: { body: 'default' };
              },
            ]
          >;
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const _handler = await interceptor.get('/users').respond((request) => {
        const name = request.searchParams.get('name');

        if (!name) {
          return {
            status: 400,
            body: { message: 'A name is required.' },
          };
        }

        if (name === 'no-content') {
          return { status: 204 };
        }
        if (name === 'created') {
          return { status: 201, body: '2xx' };
        }
        if (name === 'unauthorized') {
          return { status: 401 };
        }
        if (name === 'not-found') {
          return { status: 404, body: '4xx' };
        }
        if (name === 'unknown') {
          return { status: 500, body: 'default' };
        }

        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: users,
        };
      });

      type ResponseBody = (typeof _handler.requests)[number]['response']['body'];
      expectTypeOf<ResponseBody>().toEqualTypeOf<User[] | { message: string } | '2xx' | '4xx' | 'default' | null>();

      type ResponseHeaders = (typeof _handler.requests)[number]['response']['headers'];
      expectTypeOf<ResponseHeaders>().toEqualTypeOf<
        | HttpHeaders<{ 'content-type': string }>
        | HttpHeaders<{ 'content-type': 'application/json' }>
        | HttpHeaders<never>
      >();

      type ResponseStatus = (typeof _handler.requests)[number]['response']['status'];
      expectTypeOf<ResponseStatus>().toEqualTypeOf<200 | 201 | 204 | 400 | 401 | 404 | 500>();

      // @ts-expect-error Each response declaration should match the status code
      await interceptor.get('/users').respond((request) => {
        const name = request.searchParams.get('name');

        if (!name) {
          return { status: 400 };
        }

        if (name === 'unauthorized') {
          return { status: 401, body: 'invalid' };
        }

        if (name === 'not-found') {
          return {
            status: 404,
            headers: { 'content-type': 'application/json' },
            body: users,
          };
        }

        return {
          status: 200,
          body: { message: 'A name is required.' },
        };
      });

      // @ts-expect-error The response declaration should match the schema
      await interceptor.get('/users').respond((request) => {
        const name = request.searchParams.get('name');

        if (!name) {
          return { status: 400, body: '' };
        }

        if (name === 'not-found') {
          return { status: 404, body: '' };
        }

        return { status: 200, body: '' };
      });
    });
  });

  it('should correctly type responses with headers', async () => {
    type UserListHeaders = HttpSchema.Headers<{
      accept: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: {
              headers: UserListHeaders;
              body: User;
            };
          };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const _listHandler = await interceptor.get('/users').respond({
        status: 200,
        headers: {
          accept: '*/*',
        },
        body: users[0],
      });

      type ResponseHeaders = (typeof _listHandler.requests)[number]['response']['headers'];
      expectTypeOf<ResponseHeaders>().toEqualTypeOf<
        HttpHeaders<UserListHeaders & { 'content-type': 'application/json' }>
      >();
    });
  });

  it('should correctly type responses with headers containing invalid types', async () => {
    interface UserListHeaders {
      accept: string;
      date?: Date; // Forcing an invalid type
      method?: () => void; // Forcing an invalid type
    }

    await usingHttpInterceptor<
      HttpSchema<{
        '/users': {
          GET: {
            response: {
              200: {
                headers: UserListHeaders;
                body: User;
              };
            };
          };
        };
      }>
    >({ type, baseURL }, async (interceptor) => {
      const _listHandler = await interceptor.get('/users').respond({
        status: 200,
        headers: { accept: '*/*' },
        body: users[0],
      });

      type ResponseHeaders = (typeof _listHandler.requests)[number]['response']['headers'];
      expectTypeOf<ResponseHeaders>().toEqualTypeOf<
        HttpHeaders<UserListHeaders & { 'content-type': 'application/json' }>
      >();
    });
  });

  it('should correctly type responses with headers containing only `content-type`', async () => {
    // If only content type is specified, the headers should be optional. This is because the content type is
    // automatically set by the interceptor before returning a response, unless overridden.
    type UserListHeaders = HttpSchema.Headers<{
      'content-type': 'application/json; charset=utf-8';
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: {
              headers: UserListHeaders;
              body: User;
            };
          };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      let _listHandler = await interceptor.get('/users').respond({
        status: 200,
        body: users[0],
      });

      _listHandler = await interceptor.get('/users').respond({
        status: 200,
        headers: {},
        body: users[0],
      });

      _listHandler = await interceptor.get('/users').respond({
        status: 200,
        headers: { 'content-type': undefined },
        body: users[0],
      });

      _listHandler = await interceptor.get('/users').respond({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: users[0],
      });

      type ResponseHeaders = (typeof _listHandler.requests)[number]['response']['headers'];
      expectTypeOf<ResponseHeaders>().toEqualTypeOf<HttpHeaders<UserListHeaders>>();
    });
  });

  it('should correctly type responses with headers containing `content-type` and additional required headers', async () => {
    // If additional headers existing, beyond content type, only the `content-type` key should be optional. The
    // additional headers should be kept as defined.
    type UserListHeaders = HttpSchema.Headers<{
      'content-type': 'application/json; charset=utf-8';
      accept: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: {
              headers: UserListHeaders;
              body: User;
            };
          };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      // @ts-expect-error Headers are required
      let _listHandler = await interceptor.get('/users').respond({
        status: 200,
        body: users[0],
      });

      _listHandler = await interceptor.get('/users').respond({
        status: 200,
        // @ts-expect-error Providing an accept header is required
        headers: {},
        body: users[0],
      });

      _listHandler = await interceptor.get('/users').respond({
        status: 200,
        // @ts-expect-error Providing an accept header is required
        headers: { 'content-type': undefined },
        body: users[0],
      });

      _listHandler = await interceptor.get('/users').respond({
        status: 200,
        // @ts-expect-error Providing an accept header is required
        headers: { 'content-type': 'application/json' },
        body: users[0],
      });

      _listHandler = await interceptor.get('/users').respond({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', accept: '*/*' },
        body: users[0],
      });

      type ResponseHeaders = (typeof _listHandler.requests)[number]['response']['headers'];
      expectTypeOf<ResponseHeaders>().toEqualTypeOf<HttpHeaders<UserListHeaders>>();
    });
  });

  it('should correctly type responses with headers containing `content-type` and additional optional headers', async () => {
    // If additional headers existing, beyond content type, only the `content-type` key should be optional. The
    // additional headers should be kept as defined.
    type UserListHeaders = HttpSchema.Headers<{
      'content-type': 'application/json; charset=utf-8';
      accept?: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: {
              headers: UserListHeaders;
              body: User;
            };
          };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      // @ts-expect-error Headers are required
      let _listHandler = await interceptor.get('/users').respond({
        status: 200,
        body: users[0],
      });

      _listHandler = await interceptor.get('/users').respond({
        status: 200,
        headers: {},
        body: users[0],
      });

      _listHandler = await interceptor.get('/users').respond({
        status: 200,
        headers: { 'content-type': undefined },
        body: users[0],
      });

      _listHandler = await interceptor.get('/users').respond({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: users[0],
      });

      _listHandler = await interceptor.get('/users').respond({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', accept: '*/*' },
        body: users[0],
      });

      type ResponseHeaders = (typeof _listHandler.requests)[number]['response']['headers'];
      expectTypeOf<ResponseHeaders>().toEqualTypeOf<HttpHeaders<UserListHeaders>>();
    });
  });

  it('should correctly type responses with no headers', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User };
          };
        } & {
          response: {
            200: { headers?: {}; body: User };
          };
        } & {
          response: {
            200: { headers?: never; body: User };
          };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const _listHandler = await interceptor.get('/users').respond({
        status: 200,
        body: users[0],
      });

      type ResponseHeaders = (typeof _listHandler.requests)[number]['response']['headers'];
      expectTypeOf<ResponseHeaders>().toEqualTypeOf<HttpHeaders<never>>();
    });
  });

  it('should show a type error if trying to use a non-specified status code', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      await interceptor.get('/users').respond({
        status: 200,
        body: users,
      });

      await interceptor.get('/users').respond({
        // @ts-expect-error The status code should match the schema
        status: 201,
        body: users,
      });

      // @ts-expect-error The status code should match the schema
      await interceptor.get('/users').respond(() => ({
        status: 201,
        body: users,
      }));
    });
  });

  it('should show a type error if trying to use a non-assignable response body', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body?: User[] };
          };
        };
      };

      '/notifications/read': {
        POST: {
          response: { 204: {} };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      await interceptor.get('/users').respond({
        status: 200,
        body: users,
      });
      await interceptor.post('/notifications/read').respond({
        status: 204,
      });
      await interceptor.post('/notifications/read').respond({
        status: 204,
        body: null,
      });
      await interceptor.post('/notifications/read').respond({
        status: 204,
        body: undefined,
      });

      await interceptor.get('/users').respond({
        status: 200,
        // @ts-expect-error The response body should match the schema
        body: '',
      });
      // @ts-expect-error The response body should match the schema
      await interceptor.get('/users').respond(() => ({
        status: 200,
        body: '',
      }));

      await interceptor.post('/notifications/read').respond({
        status: 204,
        // @ts-expect-error The response body should match the schema
        body: users,
      });
      // @ts-expect-error The response body should match the schema
      await interceptor.post('/notifications/read').respond(() => ({
        status: 204,
        body: users,
      }));
    });
  });

  it('should show a type error if trying to use a non-specified path and/or method', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
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

      '/notifications/read': {
        POST: {
          response: { 204: {} };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      await interceptor.get('/users');
      await interceptor.get('/users/:id');
      await interceptor.get('/users/123');
      await interceptor.post('/notifications/read');

      // @ts-expect-error The path `/users` does not contain a POST method
      await interceptor.post('/users');
      // @ts-expect-error The path `/users/:id` does not contain a POST method
      await interceptor.post('/users/:id');
      // @ts-expect-error The path `/users/:id` with dynamic parameter does not contain a POST method
      await interceptor.post('/users/123');
      // @ts-expect-error The path `/notifications/read` does not contain a GET method
      await interceptor.get('/notifications/read');

      // @ts-expect-error The path `/path` is not declared
      await interceptor.get('/path');
      // @ts-expect-error The path `/path` is not declared
      await interceptor.post('/path');

      // @ts-expect-error The path `/users` does not contain a PUT method
      await interceptor.put('/users');
    });
  });

  it('should correctly type paths with multiple methods', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: { body: User };
          response: {
            201: { body: User };
          };
        };

        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };

      '/groups/:groupId': {
        GET: {
          response: {
            200: { body: { users: User[] } };
          };
        };

        DELETE: {
          response: {
            204: {};
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const _creationHandler = await interceptor.post('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<User>();

        return {
          status: 201,
          body: users[0],
        };
      });

      type UserCreationRequestBody = (typeof _creationHandler.requests)[number]['body'];
      expectTypeOf<UserCreationRequestBody>().toEqualTypeOf<User>();

      type UserCreationResponseBody = (typeof _creationHandler.requests)[number]['response']['body'];
      expectTypeOf<UserCreationResponseBody>().toEqualTypeOf<User>();

      const _listHandler = await interceptor.get('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        return {
          status: 200,
          body: users,
        };
      });

      type UserListRequestBody = (typeof _listHandler.requests)[number]['body'];
      expectTypeOf<UserListRequestBody>().toEqualTypeOf<null>();

      type UserListResponseBody = (typeof _listHandler.requests)[number]['response']['body'];
      expectTypeOf<UserListResponseBody>().toEqualTypeOf<User[]>();

      const _getGroupHandler = await interceptor.get('/groups/1').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        return {
          status: 200,
          body: { users },
        };
      });

      expectTypeOf<HttpRequestHandlerPath<typeof _getGroupHandler>>().toEqualTypeOf<'/groups/:groupId'>();

      type GroupGetRequestBody = (typeof _getGroupHandler.requests)[number]['body'];
      expectTypeOf<GroupGetRequestBody>().toEqualTypeOf<null>();

      type GroupGetResponseBody = (typeof _getGroupHandler.requests)[number]['response']['body'];
      expectTypeOf<GroupGetResponseBody>().toEqualTypeOf<{ users: User[] }>();
    });
  });

  it('should support declaring schemas using type composition', () => {
    const _inlineInterceptor = createHttpInterceptor<{
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
    }>({ type, baseURL });

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

    type InterceptorSchema = HttpSchema<UserPaths & UserByIdPaths>;

    const _compositeInterceptor = createHttpInterceptor<InterceptorSchema>({ type, baseURL });

    type CompositeInterceptorSchema = InferHttpInterceptorSchema<typeof _compositeInterceptor>;
    type InlineInterceptorSchema = InferHttpInterceptorSchema<typeof _inlineInterceptor>;

    expectTypeOf<CompositeInterceptorSchema>().toMatchObjectType<InlineInterceptorSchema>();
  });

  describe('Dynamic paths', () => {
    type SchemaWithDynamicPaths = HttpSchema<{
      '/:any': {
        GET: { response: { 200: { body: 'path /:any' } } };
      };
      '/users': {
        POST: { response: { 201: { body: 'path /users' } } };
      };
      '/users/:any': {
        GET: { response: { 200: { body: 'path /users/:any' } } };
      };
      '/groups': {
        GET: { response: { 200: { body: 'path /groups' } } };
      };
      '/groups/users': {
        GET: { response: { 200: { body: 'path /groups/users' } } };
      };
      '/groups/users/:any': {
        GET: { response: { 200: { body: 'path /groups/users/:any' } } };
      };
      '/groups/:groupId': {
        GET: { response: { 200: { body: 'path /groups/:groupId' } } };
      };
      '/groups/:groupId/users': {
        GET: { response: { 200: { body: 'path /groups/:groupId/users' } } };
      };
      '/groups/:groupId/:userId': {
        GET: { response: { 200: { body: 'path /groups/:groupId/:userId' } } };
      };
      '/groups/:groupId/users/other': {
        GET: { response: { 200: { body: 'path /groups/:groupId/users/other' } } };
      };
      '/groups/:groupId/users/:userId': {
        GET: { response: { 200: { body: 'path /groups/:groupId/users/:userId' } } };
      };
      '/groups/:groupId/users/:userId/other': {
        GET: { response: { 200: { body: 'path /groups/:groupId/users/:userId/other' } } };
      };
      '/groups/:groupId/users/:userId/:otherId': {
        GET: { response: { 200: { body: 'path /groups/:groupId/users/:userId/:otherId' } } };
      };
      '/groups/:groupId/users/:userId/:otherId/suffix': {
        GET: { response: { 200: { body: 'path /groups/:groupId/users/:userId/:otherId/suffix' } } };
      };
    }>;

    it('should correctly type requests with static paths that conflict with a dynamic path, preferring the former', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const _getHandler = await interceptor.get('/groups/users').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{}>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/users',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof _getHandler>>().toEqualTypeOf<'/groups/users'>();

        type GetRequestBody = (typeof _getHandler.requests)[number]['body'];
        expectTypeOf<GetRequestBody>().toEqualTypeOf<null>();
        type GetResponseBody = (typeof _getHandler.requests)[number]['response']['body'];
        expectTypeOf<GetResponseBody>().toEqualTypeOf<'path /groups/users'>();

        const _otherHandler = await interceptor.get('/groups/1/users/other').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/other',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof _otherHandler>>().toEqualTypeOf<'/groups/:groupId/users/other'>();

        type OtherGetRequestBody = (typeof _otherHandler.requests)[number]['body'];
        expectTypeOf<OtherGetRequestBody>().toEqualTypeOf<null>();
        type OtherGetResponseBody = (typeof _otherHandler.requests)[number]['response']['body'];
        expectTypeOf<OtherGetResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/other'>();
      });
    });

    it('should correctly type requests with dynamic paths containing one parameter at the start of the path', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const _genericGetHandler = await interceptor.get('/:any').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ any: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /:any',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof _genericGetHandler>>().toEqualTypeOf<'/:any'>();

        type GenericRequestBody = (typeof _genericGetHandler.requests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof _genericGetHandler.requests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /:any'>();

        const _specificGetHandler = await interceptor.get('/1').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ any: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /:any',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof _specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof _genericGetHandler>
        >();

        type SpecificRequestBody = (typeof _specificGetHandler.requests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof _specificGetHandler.requests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
      });
    });

    it('should correctly type requests with dynamic paths containing one parameter in the middle of the path', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const _genericGetHandler = await interceptor.get('/groups/:groupId/users').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof _genericGetHandler>>().toEqualTypeOf<'/groups/:groupId/users'>();

        type GenericRequestBody = (typeof _genericGetHandler.requests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof _genericGetHandler.requests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users'>();

        const _specificGetHandler = await interceptor.get('/groups/1/users').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof _specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof _genericGetHandler>
        >();

        type SpecificRequestBody = (typeof _specificGetHandler.requests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof _specificGetHandler.requests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
      });
    });

    it('should correctly type requests with dynamic paths containing one parameter at the end of the path', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const _genericGetHandler = await interceptor.get('/groups/:groupId').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof _genericGetHandler>>().toEqualTypeOf<'/groups/:groupId'>();

        type GenericRequestBody = (typeof _genericGetHandler.requests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof _genericGetHandler.requests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId'>();

        const _specificGetHandler = await interceptor.get('/groups/1').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof _specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof _genericGetHandler>
        >();

        type SpecificRequestBody = (typeof _specificGetHandler.requests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof _specificGetHandler.requests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
      });
    });

    it('should correctly type requests with dynamic paths containing multiple, non-consecutive parameters', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const _genericGetHandler = await interceptor.get('/groups/:groupId/users/:userId').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string; userId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/:userId',
          };
        });

        expectTypeOf<
          HttpRequestHandlerPath<typeof _genericGetHandler>
        >().toEqualTypeOf<'/groups/:groupId/users/:userId'>();

        type GenericRequestBody = (typeof _genericGetHandler.requests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof _genericGetHandler.requests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId'>();

        const _specificGetHandler = await interceptor.get('/groups/1/users/2').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string; userId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/:userId',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof _specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof _genericGetHandler>
        >();

        type SpecificRequestBody = (typeof _specificGetHandler.requests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof _specificGetHandler.requests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId'>();
      });
    });

    it('should correctly type requests with dynamic paths containing multiple, consecutive parameters', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const _genericGetHandler = await interceptor
          .get('/groups/:groupId/users/:userId/:otherId')
          .respond((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string; userId: string; otherId: string }>();
            expectTypeOf(request.body).toEqualTypeOf<null>();

            return {
              status: 200,
              body: 'path /groups/:groupId/users/:userId/:otherId',
            };
          });

        expectTypeOf<
          HttpRequestHandlerPath<typeof _genericGetHandler>
        >().toEqualTypeOf<'/groups/:groupId/users/:userId/:otherId'>();

        type GenericRequestBody = (typeof _genericGetHandler.requests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof _genericGetHandler.requests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId/:otherId'>();

        const _specificGetHandler = await interceptor.get('/groups/1/users/2/3').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string; userId: string; otherId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/:userId/:otherId',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof _specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof _genericGetHandler>
        >();

        type SpecificRequestBody = (typeof _specificGetHandler.requests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof _specificGetHandler.requests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
      });
    });

    it('should correctly type requests with dynamic paths containing multiple, consecutive parameters ending with static path', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const _genericGetHandler = await interceptor
          .get('/groups/:groupId/users/:userId/:otherId/suffix')
          .respond((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string; userId: string; otherId: string }>();
            expectTypeOf(request.body).toEqualTypeOf<null>();

            return {
              status: 200,
              body: 'path /groups/:groupId/users/:userId/:otherId/suffix',
            };
          });

        expectTypeOf<
          HttpRequestHandlerPath<typeof _genericGetHandler>
        >().toEqualTypeOf<'/groups/:groupId/users/:userId/:otherId/suffix'>();

        type GenericRequestBody = (typeof _genericGetHandler.requests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof _genericGetHandler.requests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId/:otherId/suffix'>();

        const _specificGetHandler = await interceptor.get('/groups/1/users/2/3/suffix').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string; userId: string; otherId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/:userId/:otherId/suffix',
          };
        });

        expectTypeOf<
          HttpRequestHandlerPath<typeof _specificGetHandler>
        >().toEqualTypeOf<'/groups/:groupId/users/:userId/:otherId/suffix'>();

        type SpecificRequestBody = (typeof _specificGetHandler.requests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof _specificGetHandler.requests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
      });
    });

    it('should correctly type responses with dynamic paths, based on the applied status code', async () => {
      await usingHttpInterceptor<{
        '/groups/:groupId/users': {
          GET: {
            response: {
              200: { body: User[] };
              500: { body: { message: string } };
            };
          };
        };
      }>({ type, baseURL }, async (interceptor) => {
        const _successfulGenericListHandler = await interceptor.get('/groups/:groupId/users').respond({
          status: 200,
          body: users,
        });

        type SuccessfulGenericResponseBody =
          (typeof _successfulGenericListHandler.requests)[number]['response']['body'];
        expectTypeOf<SuccessfulGenericResponseBody>().toEqualTypeOf<User[]>();

        const _failedGenericListHandler = await interceptor.get('/groups/:groupId/users').respond({
          status: 500,
          body: { message: 'Internal server error' },
        });

        type FailedGenericResponseBody = (typeof _failedGenericListHandler.requests)[number]['response']['body'];
        expectTypeOf<FailedGenericResponseBody>().toEqualTypeOf<{ message: string }>();

        const _successfulSpecificListHandler = await interceptor.get('/groups/1/users').respond({
          status: 200,
          body: users,
        });

        expectTypeOf<
          HttpRequestHandlerPath<typeof _successfulSpecificListHandler>
        >().toEqualTypeOf<'/groups/:groupId/users'>();

        type SuccessfulSpecificResponseBody =
          (typeof _successfulSpecificListHandler.requests)[number]['response']['body'];
        expectTypeOf<SuccessfulSpecificResponseBody>().toEqualTypeOf<User[]>();

        const _failedSpecificListHandler = await interceptor.get('/groups/1/users').respond({
          status: 500,
          body: { message: 'Internal server error' },
        });

        expectTypeOf<
          HttpRequestHandlerPath<typeof _failedSpecificListHandler>
        >().toEqualTypeOf<'/groups/:groupId/users'>();

        type FailedSpecificResponseBody = (typeof _failedSpecificListHandler.requests)[number]['response']['body'];
        expectTypeOf<FailedSpecificResponseBody>().toEqualTypeOf<{ message: string }>();
      });
    });
  });

  describe('Unhandled requests', () => {
    it('should correctly type the unhandled request strategy', () => {
      const interceptor: HttpInterceptor<{}> = createHttpInterceptor<{}>({ type, baseURL });
      expectTypeOf(interceptor.onUnhandledRequest).toEqualTypeOf<UnhandledRequestStrategy | undefined>();

      const localInterceptor = createHttpInterceptor<{}>({ type: 'local', baseURL });
      expectTypeOf(localInterceptor.onUnhandledRequest).toEqualTypeOf<UnhandledRequestStrategy.Local | undefined>();

      const remoteInterceptor = createHttpInterceptor<{}>({ type: 'remote', baseURL });
      expectTypeOf(remoteInterceptor.onUnhandledRequest).toEqualTypeOf<UnhandledRequestStrategy.Remote | undefined>();
    });
  });
}
