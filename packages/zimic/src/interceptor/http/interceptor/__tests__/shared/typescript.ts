import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema } from '@/http/types/schema';
import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';
import LocalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/LocalHttpInterceptorWorker';
import { PublicLocalHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/types/public';
import { HttpRequestTrackerPath } from '@/interceptor/http/requestTracker/types/utils';
import { JSONValue } from '@/types/json';
import { Prettify } from '@/types/utils';

import { createHttpInterceptor } from '../../factory';
import { ExtractHttpInterceptorSchema } from '../../types/schema';
import { SharedHttpInterceptorTestsOptions } from './interceptorTests';

export function declareTypeHttpInterceptorTests({ platform }: SharedHttpInterceptorTestsOptions) {
  const worker = createHttpInterceptorWorker({
    type: 'local',
  }) satisfies PublicLocalHttpInterceptorWorker as LocalHttpInterceptorWorker;

  const baseURL = 'http://localhost:3000';

  type User = JSONValue<{
    name: string;
  }>;

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  beforeAll(async () => {
    await worker.start();
    expect(worker.platform()).toBe(platform);
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
    type UserListSearchParams = HttpSchema.SearchParams<{
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
    type UserListHeaders = HttpSchema.Headers<{
      accept: string;
      'content-type': string;
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
    type UserListHeaders = HttpSchema.Headers<{
      accept: string;
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
        accept: '*/*',
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

  describe('Dynamic paths', () => {
    const interceptor = createHttpInterceptor<{
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
    }>({ worker, baseURL });

    it('should correctly type requests with static paths that conflict with a dynamic path, preferring the former', () => {
      const getTracker = interceptor.get('/groups/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();

        return {
          status: 200,
          body: 'path /groups/users',
        };
      });

      expectTypeOf<HttpRequestTrackerPath<typeof getTracker>>().toEqualTypeOf<'/groups/users'>();

      const getRequests = getTracker.requests();
      type GetRequestBody = (typeof getRequests)[number]['body'];
      expectTypeOf<GetRequestBody>().toEqualTypeOf<null>();
      type GetResponseBody = (typeof getRequests)[number]['response']['body'];
      expectTypeOf<GetResponseBody>().toEqualTypeOf<'path /groups/users'>();

      const otherTracker = interceptor.get(`/groups/${1}/users/other`).respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();

        return {
          status: 200,
          body: 'path /groups/:groupId/users/other',
        };
      });

      expectTypeOf<HttpRequestTrackerPath<typeof otherTracker>>().toEqualTypeOf<'/groups/:groupId/users/other'>();

      const otherGetRequests = otherTracker.requests();
      type OtherGetRequestBody = (typeof otherGetRequests)[number]['body'];
      expectTypeOf<OtherGetRequestBody>().toEqualTypeOf<null>();
      type OtherGetResponseBody = (typeof otherGetRequests)[number]['response']['body'];
      expectTypeOf<OtherGetResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/other'>();
    });

    it('should correctly type requests with dynamic paths containing one parameter at the start of the path', () => {
      const genericGetTracker = interceptor.get('/:any').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();

        return {
          status: 200,
          body: 'path /:any',
        };
      });

      expectTypeOf<HttpRequestTrackerPath<typeof genericGetTracker>>().toEqualTypeOf<'/:any'>();

      const genericGetRequests = genericGetTracker.requests();
      type GenericRequestBody = (typeof genericGetRequests)[number]['body'];
      expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
      type GenericResponseBody = (typeof genericGetRequests)[number]['response']['body'];
      expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /:any'>();

      const specificGetTracker = interceptor.get(`/${1}`).respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();

        return {
          status: 200,
          body: 'path /:any',
        };
      });

      expectTypeOf<HttpRequestTrackerPath<typeof specificGetTracker>>().toEqualTypeOf<
        HttpRequestTrackerPath<typeof genericGetTracker>
      >();

      const specificGetRequests = specificGetTracker.requests();
      type SpecificRequestBody = (typeof specificGetRequests)[number]['body'];
      expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
      type SpecificResponseBody = (typeof specificGetRequests)[number]['response']['body'];
      expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
    });

    it('should correctly type requests with dynamic paths containing one parameter in the middle of the path', () => {
      const genericGetTracker = interceptor.get('/groups/:groupId/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();

        return {
          status: 200,
          body: 'path /groups/:groupId/users',
        };
      });

      expectTypeOf<HttpRequestTrackerPath<typeof genericGetTracker>>().toEqualTypeOf<'/groups/:groupId/users'>();

      const genericGetRequests = genericGetTracker.requests();
      type GenericRequestBody = (typeof genericGetRequests)[number]['body'];
      expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
      type GenericResponseBody = (typeof genericGetRequests)[number]['response']['body'];
      expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users'>();

      const specificGetTracker = interceptor.get(`/groups/${1}/users`).respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();

        return {
          status: 200,
          body: 'path /groups/:groupId/users',
        };
      });

      expectTypeOf<HttpRequestTrackerPath<typeof specificGetTracker>>().toEqualTypeOf<
        HttpRequestTrackerPath<typeof genericGetTracker>
      >();

      const specificGetRequests = specificGetTracker.requests();
      type SpecificRequestBody = (typeof specificGetRequests)[number]['body'];
      expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
      type SpecificResponseBody = (typeof specificGetRequests)[number]['response']['body'];
      expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
    });

    it('should correctly type requests with dynamic paths containing one parameter at the end of the path', () => {
      const genericGetTracker = interceptor.get('/groups/:groupId').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();

        return {
          status: 200,
          body: 'path /groups/:groupId',
        };
      });

      expectTypeOf<HttpRequestTrackerPath<typeof genericGetTracker>>().toEqualTypeOf<'/groups/:groupId'>();

      const genericGetRequests = genericGetTracker.requests();
      type GenericRequestBody = (typeof genericGetRequests)[number]['body'];
      expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
      type GenericResponseBody = (typeof genericGetRequests)[number]['response']['body'];
      expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId'>();

      const specificGetTracker = interceptor.get(`/groups/${1}`).respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();

        return {
          status: 200,
          body: 'path /groups/:groupId',
        };
      });

      expectTypeOf<HttpRequestTrackerPath<typeof specificGetTracker>>().toEqualTypeOf<
        HttpRequestTrackerPath<typeof genericGetTracker>
      >();

      const specificGetRequests = specificGetTracker.requests();
      type SpecificRequestBody = (typeof specificGetRequests)[number]['body'];
      expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
      type SpecificResponseBody = (typeof specificGetRequests)[number]['response']['body'];
      expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
    });

    it('should correctly type requests with dynamic paths containing multiple, non-consecutive parameters', () => {
      const genericGetTracker = interceptor.get('/groups/:groupId/users/:userId').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();

        return {
          status: 200,
          body: 'path /groups/:groupId/users/:userId',
        };
      });

      expectTypeOf<
        HttpRequestTrackerPath<typeof genericGetTracker>
      >().toEqualTypeOf<'/groups/:groupId/users/:userId'>();

      const genericGetRequests = genericGetTracker.requests();
      type GenericRequestBody = (typeof genericGetRequests)[number]['body'];
      expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
      type GenericResponseBody = (typeof genericGetRequests)[number]['response']['body'];
      expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId'>();

      const specificGetTracker = interceptor.get(`/groups/${1}/users/${2}`).respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();

        return {
          status: 200,
          body: 'path /groups/:groupId/users/:userId',
        };
      });

      expectTypeOf<HttpRequestTrackerPath<typeof specificGetTracker>>().toEqualTypeOf<
        HttpRequestTrackerPath<typeof genericGetTracker>
      >();

      const specificGetRequests = specificGetTracker.requests();
      type SpecificRequestBody = (typeof specificGetRequests)[number]['body'];
      expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
      type SpecificResponseBody = (typeof specificGetRequests)[number]['response']['body'];
      expectTypeOf<SpecificResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId'>();
    });

    it('should correctly type requests with dynamic paths containing multiple, consecutive parameters', () => {
      const genericGetTracker = interceptor.get('/groups/:groupId/users/:userId/:otherId').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();

        return {
          status: 200,
          body: 'path /groups/:groupId/users/:userId/:otherId',
        };
      });

      expectTypeOf<
        HttpRequestTrackerPath<typeof genericGetTracker>
      >().toEqualTypeOf<'/groups/:groupId/users/:userId/:otherId'>();

      const genericGetRequests = genericGetTracker.requests();
      type GenericRequestBody = (typeof genericGetRequests)[number]['body'];
      expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
      type GenericResponseBody = (typeof genericGetRequests)[number]['response']['body'];
      expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId/:otherId'>();

      const specificGetTracker = interceptor.get(`/groups/${1}/users/${2}/${3}`).respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();

        return {
          status: 200,
          body: 'path /groups/:groupId/users/:userId/:otherId',
        };
      });

      expectTypeOf<HttpRequestTrackerPath<typeof specificGetTracker>>().toEqualTypeOf<
        HttpRequestTrackerPath<typeof genericGetTracker>
      >();

      const specificGetRequests = specificGetTracker.requests();
      type SpecificRequestBody = (typeof specificGetRequests)[number]['body'];
      expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
      type SpecificResponseBody = (typeof specificGetRequests)[number]['response']['body'];
      expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
    });

    it('should correctly type requests with dynamic paths containing multiple, consecutive parameters ending with static path', () => {
      const genericGetTracker = interceptor.get('/groups/:groupId/users/:userId/:otherId/suffix').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();

        return {
          status: 200,
          body: 'path /groups/:groupId/users/:userId/:otherId/suffix',
        };
      });

      expectTypeOf<
        HttpRequestTrackerPath<typeof genericGetTracker>
      >().toEqualTypeOf<'/groups/:groupId/users/:userId/:otherId/suffix'>();

      const genericGetRequests = genericGetTracker.requests();
      type GenericRequestBody = (typeof genericGetRequests)[number]['body'];
      expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
      type GenericResponseBody = (typeof genericGetRequests)[number]['response']['body'];
      expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId/:otherId/suffix'>();

      const specificGetTracker = interceptor.get(`/groups/${1}/users/${2}/${3}/suffix`).respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();

        return {
          status: 200,
          body: 'path /groups/:groupId/users/:userId/:otherId/suffix',
        };
      });

      expectTypeOf<
        HttpRequestTrackerPath<typeof specificGetTracker>
      >().toEqualTypeOf<'/groups/:groupId/users/:userId/:otherId/suffix'>();

      const specificGetRequests = specificGetTracker.requests();
      type SpecificRequestBody = (typeof specificGetRequests)[number]['body'];
      expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
      type SpecificResponseBody = (typeof specificGetRequests)[number]['response']['body'];
      expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
    });
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
      '/groups/:groupId/users': {
        GET: {
          response: {
            200: { body: User[] };
            500: { body: { message: string } };
          };
        };
      };
    }>({ worker, baseURL });

    const successfulGenericUserListTracker = interceptor.get('/groups/:groupId/users').respond({
      status: 200,
      body: users,
    });

    const successfulGenericUserListRequests = successfulGenericUserListTracker.requests();
    type SuccessfulGenericResponseBody = (typeof successfulGenericUserListRequests)[number]['response']['body'];
    expectTypeOf<SuccessfulGenericResponseBody>().toEqualTypeOf<User[]>();

    const failedGenericUserListTracker = interceptor.get('/groups/:groupId/users').respond({
      status: 500,
      body: { message: 'Internal server error' },
    });

    const failedGenericUserListRequests = failedGenericUserListTracker.requests();
    type FailedGenericResponseBody = (typeof failedGenericUserListRequests)[number]['response']['body'];
    expectTypeOf<FailedGenericResponseBody>().toEqualTypeOf<{ message: string }>();

    const successfulSpecificUserListTracker = interceptor.get(`/groups/${1}/users`).respond({
      status: 200,
      body: users,
    });

    expectTypeOf<
      HttpRequestTrackerPath<typeof successfulSpecificUserListTracker>
    >().toEqualTypeOf<'/groups/:groupId/users'>();

    const successfulSpecificUserListRequests = successfulSpecificUserListTracker.requests();
    type SuccessfulSpecificResponseBody = (typeof successfulSpecificUserListRequests)[number]['response']['body'];
    expectTypeOf<SuccessfulSpecificResponseBody>().toEqualTypeOf<User[]>();

    const failedSpecificUserListTracker = interceptor.get(`/groups/${1}/users`).respond({
      status: 500,
      body: { message: 'Internal server error' },
    });

    expectTypeOf<
      HttpRequestTrackerPath<typeof failedSpecificUserListTracker>
    >().toEqualTypeOf<'/groups/:groupId/users'>();

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
    interceptor.get(`/users/${123}`);
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
    type Schema = HttpSchema.Paths<{
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

    const groupGetTracker = interceptor.get(`/groups/${1}`).respond((request) => {
      expectTypeOf(request.body).toEqualTypeOf<null>();
      expect(request.body).toBe(null);

      return {
        status: 200,
        body: { users },
      };
    });

    expectTypeOf<HttpRequestTrackerPath<typeof groupGetTracker>>().toEqualTypeOf<'/groups/:groupId'>();

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

    type UserPaths = HttpSchema.Paths<{
      '/users': UserCreationMethods;
    }>;

    type UserByIdPaths = HttpSchema.Paths<{
      '/users/:id': UserGetMethods;
    }>;

    type InterceptorSchema = HttpSchema.Paths<UserPaths & UserByIdPaths>;

    const compositeInterceptor = createHttpInterceptor<InterceptorSchema>({ worker, baseURL });

    type CompositeInterceptorSchema = ExtractHttpInterceptorSchema<typeof compositeInterceptor>;
    type InlineInterceptorSchema = ExtractHttpInterceptorSchema<typeof inlineInterceptor>;
    expectTypeOf<Prettify<CompositeInterceptorSchema>>().toEqualTypeOf<Prettify<InlineInterceptorSchema>>();
  });
}
