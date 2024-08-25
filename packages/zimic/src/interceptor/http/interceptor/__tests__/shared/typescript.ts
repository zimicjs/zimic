import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema, HttpStatusCode, MergeHttpResponsesByStatusCode } from '@/http/types/schema';
import { HttpRequestHandlerPath } from '@/interceptor/http/requestHandler/types/utils';
import { Prettify } from '@/types/utils';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { createHttpInterceptor } from '../../factory';
import { InferHttpInterceptorSchema } from '../../types/schema';
import { RuntimeSharedHttpInterceptorTestsOptions } from './types';

export function declareTypeHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { type, getBaseURL } = options;

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  let baseURL: URL;

  beforeEach(() => {
    baseURL = getBaseURL();
  });

  it('should correctly type requests', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: { body: User };
          response: {
            201: { body: User };
          };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const creationHandler = await interceptor.post('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<User>();

        return {
          status: 201,
          body: users[0],
        };
      });

      const _creationRequests = await creationHandler.requests();
      type RequestBody = (typeof _creationRequests)[number]['body'];
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
      const listHandler = await interceptor.get('/users').respond((request) => {
        expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();

        return {
          status: 200,
          body: users[0],
        };
      });

      const _listRequests = await listHandler.requests();
      type RequestSearchParams = (typeof _listRequests)[number]['searchParams'];
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
      const listHandler = await interceptor.get('/users').respond((request) => {
        expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<never>>();

        return {
          status: 200,
          body: users[0],
        };
      });

      const _listRequests = await listHandler.requests();
      type RequestSearchParams = (typeof _listRequests)[number]['searchParams'];
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
      const listHandler = await interceptor.get('/users').respond((request) => {
        expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserListHeaders>>();

        return {
          status: 200,
          body: users[0],
        };
      });

      const _listRequests = await listHandler.requests();
      type RequestHeaders = (typeof _listRequests)[number]['headers'];
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
      const listHandler = await interceptor.get('/users').respond((request) => {
        expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<never>>();

        return {
          status: 200,
          body: users[0],
        };
      });

      const _listRequests = await listHandler.requests();
      type RequestHeaders = (typeof _listRequests)[number]['headers'];
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
        interceptor.get('/users').respond({
          status: 200,
          body: users,
        }),
        interceptor.get('/users').respond(() => ({
          status: 200,
          body: users,
        })),
      ]);

      for (const handler of successfulHandlers) {
        const _successfulRequests = await handler.requests();
        type SuccessfulResponseBody = (typeof _successfulRequests)[number]['response']['body'];
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

      for (const handler of failedHandlers) {
        const _failedRequests = await handler.requests();
        type FailedResponseBody = (typeof _failedRequests)[number]['response']['body'];
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
      const handler = await interceptor.get('/users').respond((request) => {
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

      const _requests = await handler.requests();
      type ResponseBody = (typeof _requests)[number]['response']['body'];
      expectTypeOf<ResponseBody>().toEqualTypeOf<User[] | { message: string } | null>();

      type ResponseHeaders = (typeof _requests)[number]['response']['headers'];
      expectTypeOf<ResponseHeaders>().toEqualTypeOf<HttpHeaders<{ 'content-type': string }> | HttpHeaders<{}>>();

      type ResponseStatus = (typeof _requests)[number]['response']['status'];
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
                204: { body: '204' };
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
      const handler = await interceptor.get('/users').respond((request) => {
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

      const _requests = await handler.requests();
      type ResponseBody = (typeof _requests)[number]['response']['body'];
      expectTypeOf<ResponseBody>().toEqualTypeOf<User[] | { message: string } | '2xx' | '4xx' | 'default' | null>();

      type ResponseHeaders = (typeof _requests)[number]['response']['headers'];
      expectTypeOf<ResponseHeaders>().toEqualTypeOf<
        HttpHeaders<{ 'content-type': string }> | HttpHeaders | HttpHeaders<{}>
      >();

      type ResponseStatus = (typeof _requests)[number]['response']['status'];
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
      const listHandler = await interceptor.get('/users').respond({
        status: 200,
        headers: {
          accept: '*/*',
        },
        body: users[0],
      });

      const _listRequests = await listHandler.requests();
      type ResponseHeaders = (typeof _listRequests)[number]['response']['headers'];
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
      const listHandler = await interceptor.get('/users').respond({
        status: 200,
        body: users[0],
      });

      const _listRequests = await listHandler.requests();
      type ResponseHeaders = (typeof _listRequests)[number]['response']['headers'];
      expectTypeOf<ResponseHeaders>().toEqualTypeOf<HttpHeaders<{}>>();
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
            200: { body: User[] };
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
      await interceptor.get(`/users/${123}`);
      await interceptor.post('/notifications/read');

      // @ts-expect-error The path `/users` does not contain a POST method
      await interceptor.post('/users');
      // @ts-expect-error The path `/users/:id` does not contain a POST method
      await interceptor.post('/users/:id');
      // @ts-expect-error The path `/users/:id` with dynamic parameter does not contain a POST method
      await interceptor.post(`/users/${123}`);
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
      const userCreationHandler = await interceptor.post('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<User>();

        return {
          status: 201,
          body: users[0],
        };
      });

      const _userCreationRequests = await userCreationHandler.requests();

      type UserCreationRequestBody = (typeof _userCreationRequests)[number]['body'];
      expectTypeOf<UserCreationRequestBody>().toEqualTypeOf<User>();

      type UserCreationResponseBody = (typeof _userCreationRequests)[number]['response']['body'];
      expectTypeOf<UserCreationResponseBody>().toEqualTypeOf<User>();

      const userListHandler = await interceptor.get('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        return {
          status: 200,
          body: users,
        };
      });

      const _userListRequests = await userListHandler.requests();

      type UserListRequestBody = (typeof _userListRequests)[number]['body'];
      expectTypeOf<UserListRequestBody>().toEqualTypeOf<null>();

      type UserListResponseBody = (typeof _userListRequests)[number]['response']['body'];
      expectTypeOf<UserListResponseBody>().toEqualTypeOf<User[]>();

      const groupGetHandler = await interceptor.get(`/groups/${1}`).respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        return {
          status: 200,
          body: { users },
        };
      });

      expectTypeOf<HttpRequestHandlerPath<typeof groupGetHandler>>().toEqualTypeOf<'/groups/:groupId'>();

      const _groupGetRequests = await groupGetHandler.requests();

      type GroupGetRequestBody = (typeof _groupGetRequests)[number]['body'];
      expectTypeOf<GroupGetRequestBody>().toEqualTypeOf<null>();

      type GroupGetResponseBody = (typeof _groupGetRequests)[number]['response']['body'];
      expectTypeOf<GroupGetResponseBody>().toEqualTypeOf<{ users: User[] }>();
    });
  });

  it('should not allow declaring request bodies for methods that do not support them', () => {
    // @ts-expect-error GET methods do not support request bodies
    createHttpInterceptor<{ '/users': { GET: { request: { body: User } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { GET: { request: { body: null } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { GET: { request: { body: undefined } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { GET: { request: {} } } }>({ type, baseURL });

    // @ts-expect-error HEAD methods do not support request bodies
    createHttpInterceptor<{ '/users': { HEAD: { request: { body: User } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { HEAD: { request: { body: null } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { HEAD: { request: { body: undefined } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { HEAD: { request: {} } } }>({ type, baseURL });

    // @ts-expect-error OPTIONS methods do not support request bodies
    createHttpInterceptor<{ '/users': { OPTIONS: { request: { body: User } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { OPTIONS: { request: { body: null } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { OPTIONS: { request: { body: undefined } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { OPTIONS: { request: {} } } }>({ type, baseURL });

    createHttpInterceptor<{ '/users': { POST: { request: { body: User } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { POST: { request: { body: null } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { POST: { request: { body: undefined } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { POST: { request: {} } } }>({ type, baseURL });

    createHttpInterceptor<{ '/users': { PUT: { request: { body: User } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PUT: { request: { body: null } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PUT: { request: { body: undefined } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PUT: { request: {} } } }>({ type, baseURL });

    createHttpInterceptor<{ '/users': { PATCH: { request: { body: User } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PATCH: { request: { body: null } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PATCH: { request: { body: undefined } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PATCH: { request: {} } } }>({ type, baseURL });

    createHttpInterceptor<{ '/users': { DELETE: { request: { body: User } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { DELETE: { request: { body: null } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { DELETE: { request: { body: undefined } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { DELETE: { request: {} } } }>({ type, baseURL });
  });

  it('should not allow declaring response bodies for methods or statuses that do not support them', () => {
    // @ts-expect-error HEAD methods do not support request bodies
    createHttpInterceptor<{ '/users': { HEAD: { response: { 200: { body: User } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { HEAD: { response: { 200: { body: null } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { HEAD: { response: { 200: { body: undefined } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { HEAD: { response: { 200: {} } } } }>({ type, baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createHttpInterceptor<{ '/users': { HEAD: { response: { 204: { body: User } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { HEAD: { response: { 204: { body: null } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { HEAD: { response: { 204: { body: undefined } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { HEAD: { response: { 204: {} } } } }>({ type, baseURL });

    createHttpInterceptor<{ '/users': { GET: { response: { 200: { body: User } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { GET: { response: { 200: { body: null } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { GET: { response: { 200: { body: undefined } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { GET: { response: { 200: {} } } } }>({ type, baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createHttpInterceptor<{ '/users': { GET: { response: { 204: { body: User } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { GET: { response: { 204: { body: null } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { GET: { response: { 204: { body: undefined } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { GET: { response: { 204: {} } } } }>({ type, baseURL });

    createHttpInterceptor<{ '/users': { POST: { response: { 200: { body: User } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { POST: { response: { 200: { body: null } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { POST: { response: { 200: { body: undefined } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { POST: { response: { 200: {} } } } }>({ type, baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createHttpInterceptor<{ '/users': { POST: { response: { 204: { body: User } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { POST: { response: { 204: { body: null } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { POST: { response: { 204: { body: undefined } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { POST: { response: { 204: {} } } } }>({ type, baseURL });

    createHttpInterceptor<{ '/users': { PUT: { response: { 200: { body: User } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PUT: { response: { 200: { body: null } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PUT: { response: { 200: { body: undefined } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PUT: { response: { 200: {} } } } }>({ type, baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createHttpInterceptor<{ '/users': { PUT: { response: { 204: { body: User } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PUT: { response: { 204: { body: null } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PUT: { response: { 204: { body: undefined } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PUT: { response: { 204: {} } } } }>({ type, baseURL });

    createHttpInterceptor<{ '/users': { PATCH: { response: { 200: { body: User } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PATCH: { response: { 200: { body: null } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PATCH: { response: { 200: { body: undefined } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PATCH: { response: { 200: {} } } } }>({ type, baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createHttpInterceptor<{ '/users': { PATCH: { response: { 204: { body: User } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PATCH: { response: { 204: { body: null } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PATCH: { response: { 204: { body: undefined } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { PATCH: { response: { 204: {} } } } }>({ type, baseURL });

    createHttpInterceptor<{ '/users': { DELETE: { response: { 200: { body: User } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { DELETE: { response: { 200: { body: null } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { DELETE: { response: { 200: { body: undefined } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { DELETE: { response: { 200: {} } } } }>({ type, baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createHttpInterceptor<{ '/users': { DELETE: { response: { 204: { body: User } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { DELETE: { response: { 204: { body: null } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { DELETE: { response: { 204: { body: undefined } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { DELETE: { response: { 204: {} } } } }>({ type, baseURL });

    createHttpInterceptor<{ '/users': { OPTIONS: { response: { 200: { body: User } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { OPTIONS: { response: { 200: { body: null } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { OPTIONS: { response: { 200: { body: undefined } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { OPTIONS: { response: { 200: {} } } } }>({ type, baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createHttpInterceptor<{ '/users': { OPTIONS: { response: { 204: { body: User } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { OPTIONS: { response: { 204: { body: null } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { OPTIONS: { response: { 204: { body: undefined } } } } }>({ type, baseURL });
    createHttpInterceptor<{ '/users': { OPTIONS: { response: { 204: {} } } } }>({ type, baseURL });
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
    expectTypeOf<Prettify<CompositeInterceptorSchema>>().toEqualTypeOf<Prettify<InlineInterceptorSchema>>();
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
        const getHandler = await interceptor.get('/groups/users').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{}>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/users',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof getHandler>>().toEqualTypeOf<'/groups/users'>();

        const _getRequests = await getHandler.requests();
        type GetRequestBody = (typeof _getRequests)[number]['body'];
        expectTypeOf<GetRequestBody>().toEqualTypeOf<null>();
        type GetResponseBody = (typeof _getRequests)[number]['response']['body'];
        expectTypeOf<GetResponseBody>().toEqualTypeOf<'path /groups/users'>();

        const otherHandler = await interceptor.get(`/groups/${1}/users/other`).respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/other',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof otherHandler>>().toEqualTypeOf<'/groups/:groupId/users/other'>();

        const _otherGetRequests = await otherHandler.requests();
        type OtherGetRequestBody = (typeof _otherGetRequests)[number]['body'];
        expectTypeOf<OtherGetRequestBody>().toEqualTypeOf<null>();
        type OtherGetResponseBody = (typeof _otherGetRequests)[number]['response']['body'];
        expectTypeOf<OtherGetResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/other'>();
      });
    });

    it('should correctly type requests with dynamic paths containing one parameter at the start of the path', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const genericGetHandler = await interceptor.get('/:any').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ any: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /:any',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof genericGetHandler>>().toEqualTypeOf<'/:any'>();

        const _genericGetRequests = await genericGetHandler.requests();
        type GenericRequestBody = (typeof _genericGetRequests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof _genericGetRequests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /:any'>();

        const specificGetHandler = await interceptor.get(`/${1}`).respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ any: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /:any',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof genericGetHandler>
        >();

        const _specificGetRequests = await specificGetHandler.requests();
        type SpecificRequestBody = (typeof _specificGetRequests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof _specificGetRequests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
      });
    });

    it('should correctly type requests with dynamic paths containing one parameter in the middle of the path', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const genericGetHandler = await interceptor.get('/groups/:groupId/users').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof genericGetHandler>>().toEqualTypeOf<'/groups/:groupId/users'>();

        const _genericGetRequests = await genericGetHandler.requests();
        type GenericRequestBody = (typeof _genericGetRequests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof _genericGetRequests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users'>();

        const specificGetHandler = await interceptor.get(`/groups/${1}/users`).respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof genericGetHandler>
        >();

        const _specificGetRequests = await specificGetHandler.requests();
        type SpecificRequestBody = (typeof _specificGetRequests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof _specificGetRequests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
      });
    });

    it('should correctly type requests with dynamic paths containing one parameter at the end of the path', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const genericGetHandler = await interceptor.get('/groups/:groupId').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof genericGetHandler>>().toEqualTypeOf<'/groups/:groupId'>();

        const _genericGetRequests = await genericGetHandler.requests();
        type GenericRequestBody = (typeof _genericGetRequests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof _genericGetRequests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId'>();

        const specificGetHandler = await interceptor.get(`/groups/${1}`).respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof genericGetHandler>
        >();

        const _specificGetRequests = await specificGetHandler.requests();
        type SpecificRequestBody = (typeof _specificGetRequests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof _specificGetRequests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
      });
    });

    it('should correctly type requests with dynamic paths containing multiple, non-consecutive parameters', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const genericGetHandler = await interceptor.get('/groups/:groupId/users/:userId').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string; userId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/:userId',
          };
        });

        expectTypeOf<
          HttpRequestHandlerPath<typeof genericGetHandler>
        >().toEqualTypeOf<'/groups/:groupId/users/:userId'>();

        const _genericGetRequests = await genericGetHandler.requests();
        type GenericRequestBody = (typeof _genericGetRequests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof _genericGetRequests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId'>();

        const specificGetHandler = await interceptor.get(`/groups/${1}/users/${2}`).respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string; userId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/:userId',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof genericGetHandler>
        >();

        const _specificGetRequests = await specificGetHandler.requests();
        type SpecificRequestBody = (typeof _specificGetRequests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof _specificGetRequests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId'>();
      });
    });

    it('should correctly type requests with dynamic paths containing multiple, consecutive parameters', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const genericGetHandler = await interceptor
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
          HttpRequestHandlerPath<typeof genericGetHandler>
        >().toEqualTypeOf<'/groups/:groupId/users/:userId/:otherId'>();

        const _genericGetRequests = await genericGetHandler.requests();
        type GenericRequestBody = (typeof _genericGetRequests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof _genericGetRequests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId/:otherId'>();

        const specificGetHandler = await interceptor.get(`/groups/${1}/users/${2}/${3}`).respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string; userId: string; otherId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/:userId/:otherId',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof genericGetHandler>
        >();

        const _specificGetRequests = await specificGetHandler.requests();
        type SpecificRequestBody = (typeof _specificGetRequests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof _specificGetRequests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
      });
    });

    it('should correctly type requests with dynamic paths containing multiple, consecutive parameters ending with static path', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const genericGetHandler = await interceptor
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
          HttpRequestHandlerPath<typeof genericGetHandler>
        >().toEqualTypeOf<'/groups/:groupId/users/:userId/:otherId/suffix'>();

        const _genericGetRequests = await genericGetHandler.requests();
        type GenericRequestBody = (typeof _genericGetRequests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof _genericGetRequests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId/:otherId/suffix'>();

        const specificGetHandler = await interceptor.get(`/groups/${1}/users/${2}/${3}/suffix`).respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ groupId: string; userId: string; otherId: string }>();
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/:userId/:otherId/suffix',
          };
        });

        expectTypeOf<
          HttpRequestHandlerPath<typeof specificGetHandler>
        >().toEqualTypeOf<'/groups/:groupId/users/:userId/:otherId/suffix'>();

        const _specificGetRequests = await specificGetHandler.requests();
        type SpecificRequestBody = (typeof _specificGetRequests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof _specificGetRequests)[number]['response']['body'];
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
        const successfulGenericUserListHandler = await interceptor.get('/groups/:groupId/users').respond({
          status: 200,
          body: users,
        });

        const _successfulGenericUserListRequests = await successfulGenericUserListHandler.requests();
        type SuccessfulGenericResponseBody = (typeof _successfulGenericUserListRequests)[number]['response']['body'];
        expectTypeOf<SuccessfulGenericResponseBody>().toEqualTypeOf<User[]>();

        const failedGenericUserListHandler = await interceptor.get('/groups/:groupId/users').respond({
          status: 500,
          body: { message: 'Internal server error' },
        });

        const _failedGenericUserListRequests = await failedGenericUserListHandler.requests();
        type FailedGenericResponseBody = (typeof _failedGenericUserListRequests)[number]['response']['body'];
        expectTypeOf<FailedGenericResponseBody>().toEqualTypeOf<{ message: string }>();

        const successfulSpecificUserListHandler = await interceptor.get(`/groups/${1}/users`).respond({
          status: 200,
          body: users,
        });

        expectTypeOf<
          HttpRequestHandlerPath<typeof successfulSpecificUserListHandler>
        >().toEqualTypeOf<'/groups/:groupId/users'>();

        const _successfulSpecificUserListRequests = await successfulSpecificUserListHandler.requests();
        type SuccessfulSpecificResponseBody = (typeof _successfulSpecificUserListRequests)[number]['response']['body'];
        expectTypeOf<SuccessfulSpecificResponseBody>().toEqualTypeOf<User[]>();

        const failedSpecificUserListHandler = await interceptor.get(`/groups/${1}/users`).respond({
          status: 500,
          body: { message: 'Internal server error' },
        });

        expectTypeOf<
          HttpRequestHandlerPath<typeof failedSpecificUserListHandler>
        >().toEqualTypeOf<'/groups/:groupId/users'>();

        const _failedSpecificUserListRequests = await failedSpecificUserListHandler.requests();
        type FailedSpecificResponseBody = (typeof _failedSpecificUserListRequests)[number]['response']['body'];
        expectTypeOf<FailedSpecificResponseBody>().toEqualTypeOf<{ message: string }>();
      });
    });
  });
}
