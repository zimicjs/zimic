import { afterAll, beforeAll, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';

import { createHttpInterceptor } from '../../factory';
import { ExtractHttpInterceptorSchema, HttpInterceptorSchema } from '../../types/schema';
import { SharedHttpInterceptorTestsOptions } from './interceptorTests';

export function declareTypeHttpInterceptorTests({ platform }: SharedHttpInterceptorTestsOptions) {
  const baseURL = 'http://localhost:3000';
  const worker = createHttpInterceptorWorker({ platform });

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  beforeAll(async () => {
    await worker.start();
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should correctly type requests', () => {
    const interceptor = createHttpInterceptor<{
      '/users': {
        POST: {
          request: { body: User };
          response: {
            201: { body: User };
          };
        };
      };
    }>({ worker, baseURL });

    const creationTracker = interceptor.post('/users').respond((request) => {
      expectTypeOf(request.body).toEqualTypeOf<User>();

      return {
        status: 201,
        body: users[0],
      };
    });

    const creationRequests = creationTracker.requests();
    type RequestBody = (typeof creationRequests)[number]['body'];
    expectTypeOf<RequestBody>().toEqualTypeOf<User>();
  });

  it('should correctly type requests with search params', () => {
    type UserListSearchParams = HttpInterceptorSchema.SearchParams<{
      name: string;
      usernames: string[];
      orderBy?: ('name' | 'createdAt')[];
    }>;

    const interceptor = createHttpInterceptor<{
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
    }>({ worker, baseURL });

    const creationTracker = interceptor.get('/users').respond((request) => {
      expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();

      return {
        status: 200,
        body: users[0],
      };
    });

    const creationRequests = creationTracker.requests();
    type RequestSearchParams = (typeof creationRequests)[number]['searchParams'];
    expectTypeOf<RequestSearchParams>().toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
  });

  it('should correctly type requests with no search params', () => {
    const interceptor = createHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL });

    const creationTracker = interceptor.get('/users').respond((request) => {
      expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams>();

      return {
        status: 200,
        body: users[0],
      };
    });

    const creationRequests = creationTracker.requests();
    type RequestSearchParams = (typeof creationRequests)[number]['searchParams'];
    expectTypeOf<RequestSearchParams>().toEqualTypeOf<HttpSearchParams>();
  });

  it('should correctly type requests with headers', () => {
    type UserListHeaders = HttpInterceptorSchema.Headers<{
      'Keep-Alive': string;
      Authorization: string;
    }>;

    const interceptor = createHttpInterceptor<{
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
    }>({ worker, baseURL });

    const creationTracker = interceptor.get('/users').respond((request) => {
      expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserListHeaders>>();

      return {
        status: 200,
        body: users[0],
      };
    });

    const creationRequests = creationTracker.requests();
    type RequestHeaders = (typeof creationRequests)[number]['headers'];
    expectTypeOf<RequestHeaders>().toEqualTypeOf<HttpHeaders<UserListHeaders>>();
  });

  it('should correctly type requests with no headers', () => {
    const interceptor = createHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL });

    const creationTracker = interceptor.get('/users').respond((request) => {
      expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<never>>();

      return {
        status: 200,
        body: users[0],
      };
    });

    const creationRequests = creationTracker.requests();
    type RequestHeaders = (typeof creationRequests)[number]['headers'];
    expectTypeOf<RequestHeaders>().toEqualTypeOf<HttpHeaders<never>>();
  });

  it('should correctly type responses with headers', () => {
    type UserListHeaders = HttpInterceptorSchema.Headers<{
      'Keep-Alive': string;
    }>;

    const interceptor = createHttpInterceptor<{
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
    }>({ worker, baseURL });

    const creationTracker = interceptor.get('/users').respond({
      status: 200,
      headers: {
        'Keep-Alive': 'timeout=5, max=1000',
      },
      body: users[0],
    });

    const creationRequests = creationTracker.requests();
    type ResponseHeaders = (typeof creationRequests)[number]['response']['headers'];
    expectTypeOf<ResponseHeaders>().toEqualTypeOf<HttpHeaders<UserListHeaders>>();
  });

  it('should correctly type responses with no headers', () => {
    const interceptor = createHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL });

    const creationTracker = interceptor.get('/users').respond({
      status: 200,
      body: users[0],
    });

    const creationRequests = creationTracker.requests();
    type ResponseHeaders = (typeof creationRequests)[number]['response']['headers'];
    expectTypeOf<ResponseHeaders>().toEqualTypeOf<HttpHeaders<never>>();
  });

  it('should correctly type requests with dynamic paths', () => {
    const interceptor = createHttpInterceptor<{
      '/groups/:id/users': {
        POST: {
          request: { body: User };
          response: {
            201: { body: User };
          };
        };
      };
    }>({ worker, baseURL });

    const genericCreationTracker = interceptor.post('/groups/:id/users').respond((request) => {
      expectTypeOf(request.body).toEqualTypeOf<User>();

      return {
        status: 201,
        body: users[0],
      };
    });

    const genericCreationRequests = genericCreationTracker.requests();
    type GenericRequestBody = (typeof genericCreationRequests)[number]['body'];
    expectTypeOf<GenericRequestBody>().toEqualTypeOf<User>();

    // @ts-expect-error The literal path is required when using path param interpolation
    interceptor.post(`/groups/${1}/users`);

    const specificCreationTracker = interceptor.post<'/groups/:id/users'>(`/groups/${1}/users`).respond((request) => {
      expectTypeOf(request.body).toEqualTypeOf<User>();

      return {
        status: 201,
        body: users[0],
      };
    });

    const specificCreationRequests = specificCreationTracker.requests();
    type SpecificRequestBody = (typeof specificCreationRequests)[number]['body'];
    expectTypeOf<SpecificRequestBody>().toEqualTypeOf<User>();
  });

  it('should correctly type responses, based on the applied status code', () => {
    const interceptor = createHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
            500: { body: { message: string } };
          };
        };
      };
    }>({ worker, baseURL });

    const successfulUserListTracker = interceptor.get('/users').respond({
      status: 200,
      body: users,
    });

    const successfulUserListRequests = successfulUserListTracker.requests();
    type SuccessfulResponseBody = (typeof successfulUserListRequests)[number]['response']['body'];
    expectTypeOf<SuccessfulResponseBody>().toEqualTypeOf<User[]>();

    const failedUserListTracker = interceptor.get('/users').respond({
      status: 500,
      body: { message: 'Internal server error' },
    });

    const failedUserListRequests = failedUserListTracker.requests();
    type FailedResponseBody = (typeof failedUserListRequests)[number]['response']['body'];
    expectTypeOf<FailedResponseBody>().toEqualTypeOf<{ message: string }>();
  });

  it('should correctly type responses with dynamic paths, based on the applied status code', () => {
    const interceptor = createHttpInterceptor<{
      '/groups/:id/users': {
        GET: {
          response: {
            200: { body: User[] };
            500: { body: { message: string } };
          };
        };
      };
    }>({ worker, baseURL });

    const successfulGenericUserListTracker = interceptor.get('/groups/:id/users').respond({
      status: 200,
      body: users,
    });

    const successfulGenericUserListRequests = successfulGenericUserListTracker.requests();
    type SuccessfulGenericResponseBody = (typeof successfulGenericUserListRequests)[number]['response']['body'];
    expectTypeOf<SuccessfulGenericResponseBody>().toEqualTypeOf<User[]>();

    const failedGenericUserListTracker = interceptor.get('/groups/:id/users').respond({
      status: 500,
      body: { message: 'Internal server error' },
    });

    const failedGenericUserListRequests = failedGenericUserListTracker.requests();
    type FailedGenericResponseBody = (typeof failedGenericUserListRequests)[number]['response']['body'];
    expectTypeOf<FailedGenericResponseBody>().toEqualTypeOf<{ message: string }>();

    const successfulSpecificUserListTracker = interceptor.get<'/groups/:id/users'>(`/groups/${1}/users`).respond({
      status: 200,
      body: users,
    });

    const successfulSpecificUserListRequests = successfulSpecificUserListTracker.requests();
    type SuccessfulSpecificResponseBody = (typeof successfulSpecificUserListRequests)[number]['response']['body'];
    expectTypeOf<SuccessfulSpecificResponseBody>().toEqualTypeOf<User[]>();

    const failedSpecificUserListTracker = interceptor.get<'/groups/:id/users'>(`/groups/${1}/users`).respond({
      status: 500,
      body: { message: 'Internal server error' },
    });

    const failedSpecificUserListRequests = failedSpecificUserListTracker.requests();
    type FailedSpecificResponseBody = (typeof failedSpecificUserListRequests)[number]['response']['body'];
    expectTypeOf<FailedSpecificResponseBody>().toEqualTypeOf<{ message: string }>();
  });

  it('should show a type error if trying to use a non-specified status code', () => {
    const interceptor = createHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>({ worker, baseURL });

    interceptor.get('/users').respond({
      status: 200,
      body: users,
    });

    interceptor.get('/users').respond({
      // @ts-expect-error The status code should match the schema
      status: 201,
      body: users,
    });

    // @ts-expect-error The status code should match the schema
    interceptor.get('/users').respond(() => ({
      status: 201,
      body: users,
    }));
  });

  it('should show a type error if trying to use a non-assignable response body', () => {
    const interceptor = createHttpInterceptor<{
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
    }>({ worker, baseURL });

    interceptor.get('/users').respond({
      status: 200,
      body: users,
    });
    interceptor.post('/notifications/read').respond({
      status: 204,
    });
    interceptor.post('/notifications/read').respond({
      status: 204,
      body: null,
    });
    interceptor.post('/notifications/read').respond({
      status: 204,
      body: undefined,
    });

    interceptor.get('/users').respond({
      status: 200,
      // @ts-expect-error The response body should match the schema
      body: '',
    });
    // @ts-expect-error The response body should match the schema
    interceptor.get('/users').respond(() => ({
      status: 200,
      body: '',
    }));

    interceptor.post('/notifications/read').respond({
      status: 204,
      // @ts-expect-error The response body should match the schema
      body: users,
    });
    // @ts-expect-error The response body should match the schema
    interceptor.post('/notifications/read').respond(() => ({
      status: 204,
      body: users,
    }));
  });

  it('should show a type error if trying to use a non-specified path and/or method', () => {
    const interceptor = createHttpInterceptor<{
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
    }>({ worker, baseURL });

    interceptor.get('/users');
    interceptor.get('/users/:id');
    interceptor.get<'/users/:id'>(`/users/${123}`);
    interceptor.post('/notifications/read');

    // @ts-expect-error The path `/users` does not contain a POST method
    interceptor.post('/users');
    // @ts-expect-error The path `/users/:id` does not contain a POST method
    interceptor.post('/users/:id');
    // @ts-expect-error The path `/users/:id` with dynamic parameter does not contain a POST method
    interceptor.post(`/users/${123}`);
    // @ts-expect-error The path `/notifications/read` does not contain a GET method
    interceptor.get('/notifications/read');

    // @ts-expect-error The path `/path` is not declared
    interceptor.get('/path');
    // @ts-expect-error The path `/path` is not declared
    interceptor.post('/path');

    // @ts-expect-error The path `/users` does not contain a PUT method
    interceptor.put('/users');
  });

  it('should correctly type paths with multiple methods', () => {
    type Schema = HttpInterceptorSchema.Root<{
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

      '/groups/:id': {
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

    const interceptor = createHttpInterceptor<Schema>({ worker, baseURL });

    const userCreationTracker = interceptor.post('/users').respond((request) => {
      expectTypeOf(request.body).toEqualTypeOf<User>();

      return {
        status: 201,
        body: users[0],
      };
    });

    const userCreationRequests = userCreationTracker.requests();

    type UserCreationRequestBody = (typeof userCreationRequests)[number]['body'];
    expectTypeOf<UserCreationRequestBody>().toEqualTypeOf<User>();

    type UserCreationResponseBody = (typeof userCreationRequests)[number]['response']['body'];
    expectTypeOf<UserCreationResponseBody>().toEqualTypeOf<User>();

    const userListTracker = interceptor.get('/users').respond((request) => {
      expectTypeOf(request.body).toEqualTypeOf<null>();
      expect(request.body).toBe(null);

      return {
        status: 200,
        body: users,
      };
    });

    const userListRequests = userListTracker.requests();

    type UserListRequestBody = (typeof userListRequests)[number]['body'];
    expectTypeOf<UserListRequestBody>().toEqualTypeOf<null>();

    type UserListResponseBody = (typeof userListRequests)[number]['response']['body'];
    expectTypeOf<UserListResponseBody>().toEqualTypeOf<User[]>();

    const groupGetTracker = interceptor.get<'/groups/:id'>(`/groups/${1}`).respond((request) => {
      expectTypeOf(request.body).toEqualTypeOf<null>();
      expect(request.body).toBe(null);

      return {
        status: 200,
        body: { users },
      };
    });

    const groupGetRequests = groupGetTracker.requests();

    type GroupGetRequestBody = (typeof groupGetRequests)[number]['body'];
    expectTypeOf<GroupGetRequestBody>().toEqualTypeOf<null>();

    type GroupGetResponseBody = (typeof groupGetRequests)[number]['response']['body'];
    expectTypeOf<GroupGetResponseBody>().toEqualTypeOf<{ users: User[] }>();
  });

  it('should support declaring schemas using type composition', () => {
    const inlineInterceptor = createHttpInterceptor<{
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
    }>({ worker, baseURL });

    type UserCreationRequest = HttpInterceptorSchema.Request<{
      body: User;
    }>;

    type UserCreationResponse = HttpInterceptorSchema.Response<{
      body: User;
    }>;

    type UserCreationResponseByStatusCode = HttpInterceptorSchema.ResponseByStatusCode<{
      201: UserCreationResponse;
    }>;

    type UserCreationMethod = HttpInterceptorSchema.Method<{
      request: UserCreationRequest;
      response: UserCreationResponseByStatusCode;
    }>;

    type UserCreationPath = HttpInterceptorSchema.Path<{
      POST: UserCreationMethod;
    }>;

    type UserGetResponse = HttpInterceptorSchema.Response<{
      body: User;
    }>;

    type UserGetResponseByStatusCode = HttpInterceptorSchema.ResponseByStatusCode<{
      200: UserGetResponse;
    }>;

    type UserGetMethod = HttpInterceptorSchema.Method<{
      response: UserGetResponseByStatusCode;
    }>;

    type UserGetPath = HttpInterceptorSchema.Path<{
      GET: UserGetMethod;
    }>;

    type UsersRoot = HttpInterceptorSchema.Root<{
      '/users': UserCreationPath;
    }>;

    type UserByIdRoot = HttpInterceptorSchema.Root<{
      '/users/:id': UserGetPath;
    }>;

    type InterceptorSchema = HttpInterceptorSchema.Root<UsersRoot & UserByIdRoot>;

    const compositeInterceptor = createHttpInterceptor<InterceptorSchema>({ worker, baseURL });
    expectTypeOf(compositeInterceptor).toEqualTypeOf(inlineInterceptor);

    type CompositeInterceptorSchema = ExtractHttpInterceptorSchema<typeof compositeInterceptor>;
    type InlineInterceptorSchema = ExtractHttpInterceptorSchema<typeof inlineInterceptor>;
    expectTypeOf<CompositeInterceptorSchema>().toEqualTypeOf<InlineInterceptorSchema>();
  });
}
