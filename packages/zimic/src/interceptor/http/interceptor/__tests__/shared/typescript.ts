import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema } from '@/http/types/schema';
import { HttpRequestHandlerPath } from '@/interceptor/http/requestHandler/types/utils';
import { JSONValue } from '@/types/json';
import { Prettify } from '@/types/utils';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { createHttpInterceptor } from '../../factory';
import { ExtractHttpInterceptorSchema } from '../../types/schema';
import { RuntimeSharedHttpInterceptorTestsOptions } from './types';

export function declareTypeHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { type, getBaseURL } = options;

  type User = JSONValue<{
    name: string;
  }>;

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
      const creationHandler = interceptor.post('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<User>();

        return {
          status: 201,
          body: users[0],
        };
      });

      const creationRequests = await creationHandler.requests();
      type RequestBody = (typeof creationRequests)[number]['body'];
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
      const listHandler = interceptor.get('/users').respond((request) => {
        expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();

        return {
          status: 200,
          body: users[0],
        };
      });

      const listRequests = await listHandler.requests();
      type RequestSearchParams = (typeof listRequests)[number]['searchParams'];
      expectTypeOf<RequestSearchParams>().toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
    });
  });

  it('should correctly type requests with no search params', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const listHandler = interceptor.get('/users').respond((request) => {
        expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams>();

        return {
          status: 200,
          body: users[0],
        };
      });

      const listRequests = await listHandler.requests();
      type RequestSearchParams = (typeof listRequests)[number]['searchParams'];
      expectTypeOf<RequestSearchParams>().toEqualTypeOf<HttpSearchParams>();
    });
  });

  it('should correctly type requests with headers', async () => {
    type UserListHeaders = HttpSchema.Headers<{
      accept: string;
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
      const listHandler = interceptor.get('/users').respond((request) => {
        expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserListHeaders>>();

        return {
          status: 200,
          body: users[0],
        };
      });

      const listRequests = await listHandler.requests();
      type RequestHeaders = (typeof listRequests)[number]['headers'];
      expectTypeOf<RequestHeaders>().toEqualTypeOf<HttpHeaders<UserListHeaders>>();
    });
  });

  it('should correctly type requests with no headers', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const listHandler = interceptor.get('/users').respond((request) => {
        expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<never>>();

        return {
          status: 200,
          body: users[0],
        };
      });

      const listRequests = await listHandler.requests();
      type RequestHeaders = (typeof listRequests)[number]['headers'];
      expectTypeOf<RequestHeaders>().toEqualTypeOf<HttpHeaders<never>>();
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
      const listHandler = interceptor.get('/users').respond({
        status: 200,
        headers: {
          accept: '*/*',
        },
        body: users[0],
      });

      const listRequests = await listHandler.requests();
      type ResponseHeaders = (typeof listRequests)[number]['response']['headers'];
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
        };
      };
    }>({ type, baseURL }, async (interceptor) => {
      const listHandler = interceptor.get('/users').respond({
        status: 200,
        body: users[0],
      });

      const listRequests = await listHandler.requests();
      type ResponseHeaders = (typeof listRequests)[number]['response']['headers'];
      expectTypeOf<ResponseHeaders>().toEqualTypeOf<HttpHeaders<never>>();
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

  describe('Dynamic paths', () => {
    type SchemaWithDynamicPaths = HttpSchema.Paths<{
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
        const getHandler = interceptor.get('/groups/users').respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/users',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof getHandler>>().toEqualTypeOf<'/groups/users'>();

        const getRequests = await getHandler.requests();
        type GetRequestBody = (typeof getRequests)[number]['body'];
        expectTypeOf<GetRequestBody>().toEqualTypeOf<null>();
        type GetResponseBody = (typeof getRequests)[number]['response']['body'];
        expectTypeOf<GetResponseBody>().toEqualTypeOf<'path /groups/users'>();

        const otherHandler = interceptor.get(`/groups/${1}/users/other`).respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/other',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof otherHandler>>().toEqualTypeOf<'/groups/:groupId/users/other'>();

        const otherGetRequests = await otherHandler.requests();
        type OtherGetRequestBody = (typeof otherGetRequests)[number]['body'];
        expectTypeOf<OtherGetRequestBody>().toEqualTypeOf<null>();
        type OtherGetResponseBody = (typeof otherGetRequests)[number]['response']['body'];
        expectTypeOf<OtherGetResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/other'>();
      });
    });

    it('should correctly type requests with dynamic paths containing one parameter at the start of the path', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const genericGetHandler = interceptor.get('/:any').respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /:any',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof genericGetHandler>>().toEqualTypeOf<'/:any'>();

        const genericGetRequests = await genericGetHandler.requests();
        type GenericRequestBody = (typeof genericGetRequests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof genericGetRequests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /:any'>();

        const specificGetHandler = interceptor.get(`/${1}`).respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /:any',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof genericGetHandler>
        >();

        const specificGetRequests = await specificGetHandler.requests();
        type SpecificRequestBody = (typeof specificGetRequests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof specificGetRequests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
      });
    });

    it('should correctly type requests with dynamic paths containing one parameter in the middle of the path', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const genericGetHandler = interceptor.get('/groups/:groupId/users').respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof genericGetHandler>>().toEqualTypeOf<'/groups/:groupId/users'>();

        const genericGetRequests = await genericGetHandler.requests();
        type GenericRequestBody = (typeof genericGetRequests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof genericGetRequests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users'>();

        const specificGetHandler = interceptor.get(`/groups/${1}/users`).respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof genericGetHandler>
        >();

        const specificGetRequests = await specificGetHandler.requests();
        type SpecificRequestBody = (typeof specificGetRequests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof specificGetRequests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
      });
    });

    it('should correctly type requests with dynamic paths containing one parameter at the end of the path', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const genericGetHandler = interceptor.get('/groups/:groupId').respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof genericGetHandler>>().toEqualTypeOf<'/groups/:groupId'>();

        const genericGetRequests = await genericGetHandler.requests();
        type GenericRequestBody = (typeof genericGetRequests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof genericGetRequests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId'>();

        const specificGetHandler = interceptor.get(`/groups/${1}`).respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof genericGetHandler>
        >();

        const specificGetRequests = await specificGetHandler.requests();
        type SpecificRequestBody = (typeof specificGetRequests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof specificGetRequests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
      });
    });

    it('should correctly type requests with dynamic paths containing multiple, non-consecutive parameters', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const genericGetHandler = interceptor.get('/groups/:groupId/users/:userId').respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/:userId',
          };
        });

        expectTypeOf<
          HttpRequestHandlerPath<typeof genericGetHandler>
        >().toEqualTypeOf<'/groups/:groupId/users/:userId'>();

        const genericGetRequests = await genericGetHandler.requests();
        type GenericRequestBody = (typeof genericGetRequests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof genericGetRequests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId'>();

        const specificGetHandler = interceptor.get(`/groups/${1}/users/${2}`).respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/:userId',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof genericGetHandler>
        >();

        const specificGetRequests = await specificGetHandler.requests();
        type SpecificRequestBody = (typeof specificGetRequests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof specificGetRequests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId'>();
      });
    });

    it('should correctly type requests with dynamic paths containing multiple, consecutive parameters', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const genericGetHandler = interceptor.get('/groups/:groupId/users/:userId/:otherId').respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/:userId/:otherId',
          };
        });

        expectTypeOf<
          HttpRequestHandlerPath<typeof genericGetHandler>
        >().toEqualTypeOf<'/groups/:groupId/users/:userId/:otherId'>();

        const genericGetRequests = await genericGetHandler.requests();
        type GenericRequestBody = (typeof genericGetRequests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof genericGetRequests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId/:otherId'>();

        const specificGetHandler = interceptor.get(`/groups/${1}/users/${2}/${3}`).respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/:userId/:otherId',
          };
        });

        expectTypeOf<HttpRequestHandlerPath<typeof specificGetHandler>>().toEqualTypeOf<
          HttpRequestHandlerPath<typeof genericGetHandler>
        >();

        const specificGetRequests = await specificGetHandler.requests();
        type SpecificRequestBody = (typeof specificGetRequests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof specificGetRequests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
      });
    });

    it('should correctly type requests with dynamic paths containing multiple, consecutive parameters ending with static path', async () => {
      await usingHttpInterceptor<SchemaWithDynamicPaths>({ type, baseURL }, async (interceptor) => {
        const genericGetHandler = interceptor
          .get('/groups/:groupId/users/:userId/:otherId/suffix')
          .respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<null>();

            return {
              status: 200,
              body: 'path /groups/:groupId/users/:userId/:otherId/suffix',
            };
          });

        expectTypeOf<
          HttpRequestHandlerPath<typeof genericGetHandler>
        >().toEqualTypeOf<'/groups/:groupId/users/:userId/:otherId/suffix'>();

        const genericGetRequests = await genericGetHandler.requests();
        type GenericRequestBody = (typeof genericGetRequests)[number]['body'];
        expectTypeOf<GenericRequestBody>().toEqualTypeOf<null>();
        type GenericResponseBody = (typeof genericGetRequests)[number]['response']['body'];
        expectTypeOf<GenericResponseBody>().toEqualTypeOf<'path /groups/:groupId/users/:userId/:otherId/suffix'>();

        const specificGetHandler = interceptor.get(`/groups/${1}/users/${2}/${3}/suffix`).respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<null>();

          return {
            status: 200,
            body: 'path /groups/:groupId/users/:userId/:otherId/suffix',
          };
        });

        expectTypeOf<
          HttpRequestHandlerPath<typeof specificGetHandler>
        >().toEqualTypeOf<'/groups/:groupId/users/:userId/:otherId/suffix'>();

        const specificGetRequests = await specificGetHandler.requests();
        type SpecificRequestBody = (typeof specificGetRequests)[number]['body'];
        expectTypeOf<SpecificRequestBody>().toEqualTypeOf<null>();
        type SpecificResponseBody = (typeof specificGetRequests)[number]['response']['body'];
        expectTypeOf<SpecificResponseBody>().toEqualTypeOf<GenericResponseBody>();
      });
    });
  });

  it('should correctly type responses, based on the applied status code', async () => {
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
      const successfulUserListHandler = interceptor.get('/users').respond({
        status: 200,
        body: users,
      });

      const successfulUserListRequests = await successfulUserListHandler.requests();
      type SuccessfulResponseBody = (typeof successfulUserListRequests)[number]['response']['body'];
      expectTypeOf<SuccessfulResponseBody>().toEqualTypeOf<User[]>();

      const failedUserListHandler = interceptor.get('/users').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const failedUserListRequests = await failedUserListHandler.requests();
      type FailedResponseBody = (typeof failedUserListRequests)[number]['response']['body'];
      expectTypeOf<FailedResponseBody>().toEqualTypeOf<{ message: string }>();
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
      const successfulGenericUserListHandler = interceptor.get('/groups/:groupId/users').respond({
        status: 200,
        body: users,
      });

      const successfulGenericUserListRequests = await successfulGenericUserListHandler.requests();
      type SuccessfulGenericResponseBody = (typeof successfulGenericUserListRequests)[number]['response']['body'];
      expectTypeOf<SuccessfulGenericResponseBody>().toEqualTypeOf<User[]>();

      const failedGenericUserListHandler = interceptor.get('/groups/:groupId/users').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const failedGenericUserListRequests = await failedGenericUserListHandler.requests();
      type FailedGenericResponseBody = (typeof failedGenericUserListRequests)[number]['response']['body'];
      expectTypeOf<FailedGenericResponseBody>().toEqualTypeOf<{ message: string }>();

      const successfulSpecificUserListHandler = interceptor.get(`/groups/${1}/users`).respond({
        status: 200,
        body: users,
      });

      expectTypeOf<
        HttpRequestHandlerPath<typeof successfulSpecificUserListHandler>
      >().toEqualTypeOf<'/groups/:groupId/users'>();

      const successfulSpecificUserListRequests = await successfulSpecificUserListHandler.requests();
      type SuccessfulSpecificResponseBody = (typeof successfulSpecificUserListRequests)[number]['response']['body'];
      expectTypeOf<SuccessfulSpecificResponseBody>().toEqualTypeOf<User[]>();

      const failedSpecificUserListHandler = interceptor.get(`/groups/${1}/users`).respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      expectTypeOf<
        HttpRequestHandlerPath<typeof failedSpecificUserListHandler>
      >().toEqualTypeOf<'/groups/:groupId/users'>();

      const failedSpecificUserListRequests = await failedSpecificUserListHandler.requests();
      type FailedSpecificResponseBody = (typeof failedSpecificUserListRequests)[number]['response']['body'];
      expectTypeOf<FailedSpecificResponseBody>().toEqualTypeOf<{ message: string }>();
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

    await usingHttpInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const userCreationHandler = interceptor.post('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<User>();

        return {
          status: 201,
          body: users[0],
        };
      });

      const userCreationRequests = await userCreationHandler.requests();

      type UserCreationRequestBody = (typeof userCreationRequests)[number]['body'];
      expectTypeOf<UserCreationRequestBody>().toEqualTypeOf<User>();

      type UserCreationResponseBody = (typeof userCreationRequests)[number]['response']['body'];
      expectTypeOf<UserCreationResponseBody>().toEqualTypeOf<User>();

      const userListHandler = interceptor.get('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        return {
          status: 200,
          body: users,
        };
      });

      const userListRequests = await userListHandler.requests();

      type UserListRequestBody = (typeof userListRequests)[number]['body'];
      expectTypeOf<UserListRequestBody>().toEqualTypeOf<null>();

      type UserListResponseBody = (typeof userListRequests)[number]['response']['body'];
      expectTypeOf<UserListResponseBody>().toEqualTypeOf<User[]>();

      const groupGetHandler = interceptor.get(`/groups/${1}`).respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        return {
          status: 200,
          body: { users },
        };
      });

      expectTypeOf<HttpRequestHandlerPath<typeof groupGetHandler>>().toEqualTypeOf<'/groups/:groupId'>();

      const groupGetRequests = await groupGetHandler.requests();

      type GroupGetRequestBody = (typeof groupGetRequests)[number]['body'];
      expectTypeOf<GroupGetRequestBody>().toEqualTypeOf<null>();

      type GroupGetResponseBody = (typeof groupGetRequests)[number]['response']['body'];
      expectTypeOf<GroupGetResponseBody>().toEqualTypeOf<{ users: User[] }>();
    });
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

    type UserPaths = HttpSchema.Paths<{
      '/users': UserCreationMethods;
    }>;

    type UserByIdPaths = HttpSchema.Paths<{
      '/users/:id': UserGetMethods;
    }>;

    type InterceptorSchema = HttpSchema.Paths<UserPaths & UserByIdPaths>;

    const compositeInterceptor = createHttpInterceptor<InterceptorSchema>({ type, baseURL });

    type CompositeInterceptorSchema = ExtractHttpInterceptorSchema<typeof compositeInterceptor>;
    type InlineInterceptorSchema = ExtractHttpInterceptorSchema<typeof inlineInterceptor>;
    expectTypeOf<Prettify<CompositeInterceptorSchema>>().toEqualTypeOf<Prettify<InlineInterceptorSchema>>();
  });
}
