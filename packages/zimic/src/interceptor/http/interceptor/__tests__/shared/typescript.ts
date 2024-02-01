import { afterAll, beforeAll, expect, expectTypeOf, it } from 'vitest';

import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';

import { createHttpInterceptor } from '../../factory';
import { ExtractHttpInterceptorSchema, HttpInterceptorSchema } from '../../types/schema';
import { SharedHttpInterceptorTestsOptions } from './interceptorTests';

export function declareTypeHttpInterceptorTests({ platform }: SharedHttpInterceptorTestsOptions) {
  const baseURL = 'http://localhost:3000';
  const worker = createHttpInterceptorWorker({ platform, baseURL });

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
    }>({ worker });

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

  it('should correctly type requests with dynamic routes', () => {
    const interceptor = createHttpInterceptor<{
      '/groups/:id/users': {
        POST: {
          request: { body: User };
          response: {
            201: { body: User };
          };
        };
      };
    }>({ worker });

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

    // @ts-expect-error The literal path is required when using route param interpolation
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
    }>({ worker });

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

  it('should correctly type responses with dynamic routes, based on the applied status code', () => {
    const interceptor = createHttpInterceptor<{
      '/groups/:id/users': {
        GET: {
          response: {
            200: { body: User[] };
            500: { body: { message: string } };
          };
        };
      };
    }>({ worker });

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
    }>({ worker });

    interceptor.get('/users').respond({
      status: 200,
      body: users,
    });

    interceptor.get('/users').respond({
      // @ts-expect-error
      status: 201,
      body: users,
    });

    // @ts-expect-error
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
    }>({ worker });

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
      // @ts-expect-error
      body: '',
    });
    // @ts-expect-error
    interceptor.get('/users').respond(() => ({
      status: 200,
      body: '',
    }));

    interceptor.post('/notifications/read').respond({
      status: 204,
      // @ts-expect-error
      body: users,
    });
    // @ts-expect-error
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
    }>({ worker });

    interceptor.get('/users');
    interceptor.get('/users/:id');
    interceptor.get<'/users/:id'>(`/users/${123}`);
    interceptor.post('/notifications/read');

    // @ts-expect-error
    interceptor.post('/users');
    // @ts-expect-error
    interceptor.post('/users/:id');
    // @ts-expect-error
    interceptor.post(`/users/${123}`);
    // @ts-expect-error
    interceptor.get('/notifications/read');

    // @ts-expect-error
    interceptor.get('/path');
    // @ts-expect-error
    interceptor.post('/path');

    // @ts-expect-error
    interceptor.put('/users');
  });

  it('should correctly type routes with multiple methods', () => {
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

    const interceptor = createHttpInterceptor<Schema>({ worker });

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
    }>({ worker });

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

    const compositeInterceptor = createHttpInterceptor<InterceptorSchema>({ worker });
    expectTypeOf(compositeInterceptor).toEqualTypeOf(inlineInterceptor);

    type CompositeInterceptorSchema = ExtractHttpInterceptorSchema<typeof compositeInterceptor>;
    type InlineInterceptorSchema = ExtractHttpInterceptorSchema<typeof inlineInterceptor>;
    expectTypeOf<CompositeInterceptorSchema>().toEqualTypeOf<InlineInterceptorSchema>();
  });
}
