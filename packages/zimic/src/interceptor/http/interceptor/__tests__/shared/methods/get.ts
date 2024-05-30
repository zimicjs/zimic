import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema } from '@/http/types/schema';
import { http } from '@/interceptor';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { JSONValue } from '@/types/json';
import { getCrypto } from '@/utils/crypto';
import { fetchWithTimeout } from '@/utils/fetch';
import { joinURL } from '@/utils/urls';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectFetchError } from '@tests/utils/fetch';
import { createInternalHttpInterceptor, usingHttpInterceptor } from '@tests/utils/interceptors';

import NotStartedHttpInterceptorError from '../../../errors/NotStartedHttpInterceptorError';
import { HttpInterceptorOptions, UnhandledRequestStrategy } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../types';
import { verifyUnhandledRequestMessage } from '../utils';

export async function declareGetHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const crypto = await getCrypto();

  type User = JSONValue<{
    id: string;
    name: string;
  }>;

  const users: User[] = [
    { id: crypto.randomUUID(), name: 'User 1' },
    { id: crypto.randomUUID(), name: 'User 2' },
  ];

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Handler = options.type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;
  });

  it('should support intercepting GET requests with a static response', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listHandler = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 200,
          body: users,
        }),
        interceptor,
      );
      expect(listHandler).toBeInstanceOf(Handler);

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual(users);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<null>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual(users);
    });
  });

  it('should support intercepting GET requests with a computed response', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const user: User = {
        id: crypto.randomUUID(),
        name: 'User (computed)',
      };

      const listHandler = await promiseIfRemote(
        interceptor.get('/users').respond(() => ({
          status: 200,
          body: [user],
        })),
        interceptor,
      );
      expect(listHandler).toBeInstanceOf(Handler);

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual<User[]>([user]);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<null>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual<User[]>([user]);
    });
  });

  it('should support intercepting GET requests having headers', async () => {
    type UserListRequestHeaders = HttpSchema.Headers<{
      accept?: string;
    }>;
    type UserListResponseHeaders = HttpSchema.Headers<{
      'content-language'?: string;
      'cache-control'?: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          request: {
            headers: UserListRequestHeaders;
          };
          response: {
            200: {
              headers: UserListResponseHeaders;
              body: User[];
            };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listHandler = await promiseIfRemote(
        interceptor.get('/users').respond((request) => {
          expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserListRequestHeaders>>();
          expect(request.headers).toBeInstanceOf(HttpHeaders);

          const acceptHeader = request.headers.get('accept')!;
          expect(acceptHeader).toBe('application/json');

          return {
            status: 200,
            headers: {
              'content-language': 'en',
              'cache-control': 'no-cache',
            },
            body: users,
          };
        }),
        interceptor,
      );
      expect(listHandler).toBeInstanceOf(Handler);

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(joinURL(baseURL, '/users'), {
        method: 'GET',
        headers: {
          accept: 'application/json',
        } satisfies UserListRequestHeaders,
      });
      expect(listResponse.status).toBe(200);
      expect(listResponse.headers.get('content-language')).toBe('en');

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.headers).toEqualTypeOf<HttpHeaders<UserListRequestHeaders>>();
      expect(listRequest.headers).toBeInstanceOf(HttpHeaders);
      expect(listRequest.headers.get('accept')).toBe('application/json');

      expectTypeOf(listRequest.response.headers).toEqualTypeOf<HttpHeaders<UserListResponseHeaders>>();
      expect(listRequest.response.headers).toBeInstanceOf(HttpHeaders);
      expect(listRequest.response.headers.get('content-language')).toBe('en');
      expect(listRequest.response.headers.get('cache-control')).toBe('no-cache');
    });
  });

  it('should support intercepting GET requests having search params', async () => {
    type UserListSearchParams = HttpSchema.SearchParams<{
      name?: string;
      orderBy?: ('name' | 'createdAt')[];
      page?: `${number}`;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          request: {
            searchParams: UserListSearchParams;
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listHandler = await promiseIfRemote(
        interceptor.get('/users').respond((request) => {
          expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
          expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

          return {
            status: 200,
            body: users,
          };
        }),
        interceptor,
      );
      expect(listHandler).toBeInstanceOf(Handler);

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserListSearchParams>({
        name: 'User 1',
        orderBy: ['createdAt', 'name'],
      });

      const listResponse = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
      expect(listRequest.searchParams).toBeInstanceOf(HttpSearchParams);
      expect(listRequest.searchParams).toEqual(searchParams);
      expect(listRequest.searchParams.get('name')).toBe('User 1');
      expect(listRequest.searchParams.getAll('orderBy')).toEqual(['createdAt', 'name']);
      expect(listRequest.searchParams.get('page')).toBe(null);
    });
  });

  it('should not intercept a GET request without a registered response', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      let fetchPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      await expectFetchError(fetchPromise);

      const listHandlerWithoutResponse = await promiseIfRemote(interceptor.get('/users'), interceptor);
      expect(listHandlerWithoutResponse).toBeInstanceOf(Handler);

      let listRequestsWithoutResponse = await promiseIfRemote(listHandlerWithoutResponse.requests(), interceptor);
      expect(listRequestsWithoutResponse).toHaveLength(0);

      let [listRequestWithoutResponse] = listRequestsWithoutResponse;
      expectTypeOf<typeof listRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof listRequestWithoutResponse.response>().toEqualTypeOf<never>();

      fetchPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      await expectFetchError(fetchPromise);

      listRequestsWithoutResponse = await promiseIfRemote(listHandlerWithoutResponse.requests(), interceptor);
      expect(listRequestsWithoutResponse).toHaveLength(0);

      [listRequestWithoutResponse] = listRequestsWithoutResponse;
      expectTypeOf<typeof listRequestWithoutResponse.body>().toEqualTypeOf<null>();
      expectTypeOf<typeof listRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const listHandlerWithResponse = listHandlerWithoutResponse.respond({
        status: 200,
        body: users,
      });

      const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual(users);

      expect(listRequestsWithoutResponse).toHaveLength(0);
      const listRequestsWithResponse = await promiseIfRemote(listHandlerWithResponse.requests(), interceptor);
      expect(listRequestsWithResponse).toHaveLength(1);

      const [listRequestWithResponse] = listRequestsWithResponse;
      expect(listRequestWithResponse).toBeInstanceOf(Request);
      expect(listRequestWithResponse.response.status).toEqual(200);

      expectTypeOf(listRequestWithResponse.body).toEqualTypeOf<null>();
      expect(listRequestWithResponse.body).toBe(null);

      expectTypeOf(listRequestWithResponse.response.status).toEqualTypeOf<200>();
      expect(listRequestWithResponse.response.status).toEqual(200);

      expectTypeOf(listRequestWithResponse.response.body).toEqualTypeOf<User[]>();
      expect(listRequestWithResponse.response.body).toEqual(users);
    });
  });

  it('should consider only the last declared response when intercepting GET requests', async () => {
    type ServerErrorResponseBody = JSONValue<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const listHandler = await promiseIfRemote(
        interceptor
          .get('/users')
          .respond({
            status: 200,
            body: users,
          })
          .respond({
            status: 200,
            body: [],
          }),
        interceptor,
      );

      let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(0);

      const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(listResponse.status).toBe(200);

      const fetchedUsers = (await listResponse.json()) as User[];
      expect(fetchedUsers).toEqual([]);

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);
      const [listRequest] = listRequests;
      expect(listRequest).toBeInstanceOf(Request);

      expectTypeOf(listRequest.body).toEqualTypeOf<null>();
      expect(listRequest.body).toBe(null);

      expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
      expect(listRequest.response.status).toEqual(200);

      expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
      expect(listRequest.response.body).toEqual([]);

      const errorListHandler = await promiseIfRemote(
        interceptor.get('/users').respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        interceptor,
      );

      let errorListRequests = await promiseIfRemote(errorListHandler.requests(), interceptor);
      expect(errorListRequests).toHaveLength(0);

      const otherListResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(otherListResponse.status).toBe(500);

      const serverError = (await otherListResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
      expect(listRequests).toHaveLength(1);

      errorListRequests = await promiseIfRemote(errorListHandler.requests(), interceptor);
      expect(errorListRequests).toHaveLength(1);
      const [errorListRequest] = errorListRequests;
      expect(errorListRequest).toBeInstanceOf(Request);

      expectTypeOf(errorListRequest.body).toEqualTypeOf<null>();
      expect(errorListRequest.body).toBe(null);

      expectTypeOf(errorListRequest.response.status).toEqualTypeOf<500>();
      expect(errorListRequest.response.status).toEqual(500);

      expectTypeOf(errorListRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorListRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });
    });
  });

  describe('Restrictions', () => {
    it('should support intercepting GET requests having headers restrictions', async () => {
      type UserListHeaders = HttpSchema.Headers<{
        'content-language'?: string;
        accept?: string;
      }>;

      await usingHttpInterceptor<{
        '/users': {
          GET: {
            request: {
              headers: UserListHeaders;
            };
            response: {
              200: { body: User[] };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const listHandler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with({
              headers: { 'content-language': 'en' },
            })
            .with((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserListHeaders>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

              return request.headers.get('accept')?.includes('application/json') ?? false;
            })
            .respond((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserListHeaders>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

              return {
                status: 200,
                body: users,
              };
            }),
          interceptor,
        );
        expect(listHandler).toBeInstanceOf(Handler);

        let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(0);

        const headers = new HttpHeaders<UserListHeaders>({
          'content-language': 'en',
          accept: 'application/json',
        });

        let listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
        expect(listResponse.status).toBe(200);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);

        headers.append('accept', 'application/xml');

        listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
        expect(listResponse.status).toBe(200);
        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(2);

        headers.delete('accept');

        let listPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
        await expectFetchError(listPromise);
        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(2);

        headers.set('accept', 'application/json');
        headers.set('content-language', 'pt');

        listPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
        await expectFetchError(listPromise);
        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(2);
      });
    });

    it('should support intercepting GET requests having search params restrictions', async () => {
      type UserListSearchParams = HttpSchema.SearchParams<{
        name?: string;
        orderBy?: ('name' | 'createdAt')[];
        page?: `${number}`;
      }>;

      await usingHttpInterceptor<{
        '/users': {
          GET: {
            request: {
              searchParams: UserListSearchParams;
            };
            response: {
              200: { body: User[] };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const listHandler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with({
              searchParams: {
                name: 'User 1',
              },
            })
            .with((request) => {
              expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
              expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

              return request.searchParams.getAll('orderBy').length > 0;
            })
            .respond((request) => {
              expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
              expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

              return {
                status: 200,
                body: users,
              };
            }),
          interceptor,
        );
        expect(listHandler).toBeInstanceOf(Handler);

        let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(0);

        const searchParams = new HttpSearchParams<UserListSearchParams>({
          name: 'User 1',
          orderBy: ['createdAt', 'name'],
        });

        const listResponse = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        expect(listResponse.status).toBe(200);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);

        searchParams.delete('orderBy');

        let listPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        await expectFetchError(listPromise);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);

        searchParams.append('orderBy', 'name');
        searchParams.set('name', 'User 2');

        listPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        await expectFetchError(listPromise);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);
      });
    });
  });

  describe('Clear', () => {
    it('should ignore all handlers after cleared when intercepting GET requests', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: {
            response: {
              200: { body: User[] };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const listHandler = await promiseIfRemote(
          interceptor.get('/users').respond({
            status: 200,
            body: users,
          }),
          interceptor,
        );

        let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(0);

        const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(listResponse.status).toBe(200);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);

        await promiseIfRemote(interceptor.clear(), interceptor);

        const listPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(listPromise);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);
      });
    });

    it('should support creating new handlers after cleared', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: {
            response: {
              200: { body: User[] };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        let listHandler = await promiseIfRemote(
          interceptor.get('/users').respond({
            status: 200,
            body: users,
          }),
          interceptor,
        );

        await promiseIfRemote(interceptor.clear(), interceptor);

        listHandler = await promiseIfRemote(
          interceptor.get('/users').respond({
            status: 200,
            body: [],
          }),
          interceptor,
        );

        let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(0);

        const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(listResponse.status).toBe(200);

        const fetchedUsers = (await listResponse.json()) as User[];
        expect(fetchedUsers).toEqual([]);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);
        const [listRequest] = listRequests;
        expect(listRequest).toBeInstanceOf(Request);

        expectTypeOf(listRequest.body).toEqualTypeOf<null>();
        expect(listRequest.body).toBe(null);

        expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
        expect(listRequest.response.status).toEqual(200);

        expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
        expect(listRequest.response.body).toEqual([]);
      });
    });

    it('should support reusing previous handlers after cleared', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: {
            response: {
              200: { body: User[] };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const listHandler = await promiseIfRemote(
          interceptor.get('/users').respond({
            status: 200,
            body: users,
          }),
          interceptor,
        );

        await promiseIfRemote(interceptor.clear(), interceptor);

        await promiseIfRemote(
          listHandler.respond({
            status: 200,
            body: [],
          }),
          interceptor,
        );

        let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(0);

        const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(listResponse.status).toBe(200);

        const fetchedUsers = (await listResponse.json()) as User[];
        expect(fetchedUsers).toEqual([]);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);
        const [listRequest] = listRequests;
        expect(listRequest).toBeInstanceOf(Request);

        expectTypeOf(listRequest.body).toEqualTypeOf<null>();
        expect(listRequest.body).toBe(null);

        expectTypeOf(listRequest.response.status).toEqualTypeOf<200>();
        expect(listRequest.response.status).toEqual(200);

        expectTypeOf(listRequest.response.body).toEqualTypeOf<User[]>();
        expect(listRequest.response.body).toEqual([]);
      });
    });
  });

  describe('Life cycle', () => {
    it('should ignore all handlers after restarted when intercepting GET requests', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: {
            response: {
              200: { body: User[] };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const listHandler = await promiseIfRemote(
          interceptor.get('/users').respond({
            status: 200,
            body: users,
          }),
          interceptor,
        );

        let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(0);

        const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(listResponse.status).toBe(200);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);

        expect(interceptor.isRunning()).toBe(true);
        await interceptor.stop();
        expect(interceptor.isRunning()).toBe(false);

        let listPromise = fetchWithTimeout(joinURL(baseURL, '/users'), {
          method: 'GET',
          timeout: 200,
        });
        await expectFetchError(listPromise, { canBeAborted: true });

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);

        await interceptor.start();
        expect(interceptor.isRunning()).toBe(true);

        listPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(listPromise);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);
      });
    });

    it('should ignore all handlers after restarted when intercepting GET requests, even if another interceptor is still running', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: {
            response: {
              200: { body: User[] };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const listHandler = await promiseIfRemote(
          interceptor.get('/users').respond({
            status: 200,
            body: users,
          }),
          interceptor,
        );

        let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(0);

        const listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(listResponse.status).toBe(200);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);

        await usingHttpInterceptor(interceptorOptions, async (otherInterceptor) => {
          expect(interceptor.isRunning()).toBe(true);
          expect(otherInterceptor.isRunning()).toBe(true);

          await interceptor.stop();
          expect(interceptor.isRunning()).toBe(false);
          expect(otherInterceptor.isRunning()).toBe(true);

          let listPromise = fetchWithTimeout(joinURL(baseURL, '/users'), {
            method: 'GET',
            timeout: 200,
          });
          await expectFetchError(listPromise, { canBeAborted: true });

          listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
          expect(listRequests).toHaveLength(1);

          await interceptor.start();
          expect(interceptor.isRunning()).toBe(true);
          expect(otherInterceptor.isRunning()).toBe(true);

          listPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          await expectFetchError(listPromise);

          listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
          expect(listRequests).toHaveLength(1);
        });
      });
    });

    it('should throw an error when trying to create a GET request handler if not running', async () => {
      const interceptor = createInternalHttpInterceptor(interceptorOptions);
      expect(interceptor.isRunning()).toBe(false);

      await expect(async () => {
        await interceptor.get('/');
      }).rejects.toThrowError(new NotStartedHttpInterceptorError());
    });
  });

  describe('Unhandled requests', () => {
    describe.each([
      { overrideDefault: false as const },
      { overrideDefault: 'static' as const },
      { overrideDefault: 'static-empty' as const },
      { overrideDefault: 'function' as const },
    ])('Logging enabled or disabled: override default $overrideDefault', ({ overrideDefault }) => {
      beforeEach(() => {
        if (overrideDefault === 'static') {
          http.default.onUnhandledRequest({ log: true });
        } else if (overrideDefault === 'static-empty') {
          http.default.onUnhandledRequest({});
        } else if (overrideDefault === 'function') {
          http.default.onUnhandledRequest(async (_request, context) => {
            await context.log();
          });
        }
      });

      if (type === 'local') {
        it('should show a warning when logging is enabled and a GET request is unhandled and bypassed', async () => {
          await usingHttpInterceptor<{
            '/users': {
              GET: {
                request: { headers: { 'x-value': string } };
                response: {
                  200: { body: User[] };
                };
              };
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const listHandler = await promiseIfRemote(
                interceptor
                  .get('/users')
                  .with({ headers: { 'x-value': '1' } })
                  .respond({
                    status: 200,
                    body: users,
                  }),
                interceptor,
              );

              let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
              expect(listRequests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const listResponse = await fetch(joinURL(baseURL, '/users'), {
                  method: 'GET',
                  headers: { 'x-value': '1' },
                });
                expect(listResponse.status).toBe(200);

                listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
                expect(listRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const listRequest = new Request(joinURL(baseURL, '/users'), { method: 'GET' });
                const listPromise = fetch(listRequest);
                await expectFetchError(listPromise);

                listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
                expect(listRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(1);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const warnMessage = spies.warn.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(warnMessage, {
                  type: 'warn',
                  platform,
                  request: listRequest,
                });
              });
            },
          );
        });
      }

      if (type === 'remote') {
        it('should show an error when logging is enabled and a GET request is unhandled and rejected', async () => {
          await usingHttpInterceptor<{
            '/users': {
              GET: {
                request: { headers: { 'x-value': string } };
                response: {
                  200: { body: User[] };
                };
              };
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const listHandler = await promiseIfRemote(
                interceptor
                  .get('/users')
                  .with({ headers: { 'x-value': '1' } })
                  .respond({
                    status: 200,
                    body: users,
                  }),
                interceptor,
              );

              let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
              expect(listRequests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const listResponse = await fetch(joinURL(baseURL, '/users'), {
                  method: 'GET',
                  headers: { 'x-value': '1' },
                });
                expect(listResponse.status).toBe(200);

                listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
                expect(listRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const listRequest = new Request(joinURL(baseURL, '/users'), {
                  method: 'GET',
                  headers: { 'x-value': '2' },
                });
                const listPromise = fetch(listRequest);
                await expectFetchError(listPromise);

                listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
                expect(listRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(1);

                const errorMessage = spies.error.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(errorMessage, {
                  type: 'error',
                  platform,
                  request: listRequest,
                });
              });
            },
          );
        });
      }
    });

    it.each([{ overrideDefault: false }, { overrideDefault: 'static' }, { overrideDefault: 'function' }])(
      'should not show a warning or error when logging is disabled and a GET request is unhandled: override default $overrideDefault',
      async ({ overrideDefault }) => {
        if (overrideDefault === 'static') {
          http.default.onUnhandledRequest({ log: false });
        } else if (overrideDefault === 'function') {
          http.default.onUnhandledRequest(vi.fn());
        }

        await usingHttpInterceptor<{
          '/users': {
            GET: {
              request: { headers: { 'x-value': string } };
              response: {
                200: { body: User[] };
              };
            };
          };
        }>(
          {
            ...interceptorOptions,
            onUnhandledRequest: overrideDefault === false ? { log: false } : {},
          },
          async (interceptor) => {
            const listHandler = await promiseIfRemote(
              interceptor
                .get('/users')
                .with({ headers: { 'x-value': '1' } })
                .respond({
                  status: 200,
                  body: users,
                }),
              interceptor,
            );

            let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
            expect(listRequests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (spies) => {
              const listResponse = await fetch(joinURL(baseURL, '/users'), {
                method: 'GET',
                headers: { 'x-value': '1' },
              });
              expect(listResponse.status).toBe(200);

              listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
              expect(listRequests).toHaveLength(1);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);

              const listRequest = new Request(joinURL(baseURL, '/users'), {
                method: 'GET',
                headers: { 'x-value': '2' },
              });
              const listPromise = fetch(listRequest);
              await expectFetchError(listPromise);

              listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
              expect(listRequests).toHaveLength(1);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);
            });
          },
        );
      },
    );

    it('should support a custom unhandled GET request handler', async () => {
      const onUnhandledRequest = vi.fn(async (request: Request, context: UnhandledRequestStrategy.HandlerContext) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          await context.log();
        }
      });

      await usingHttpInterceptor<{
        '/users': {
          GET: {
            request: {
              headers: { 'x-value': string };
              searchParams: { name?: string };
            };
            response: {
              200: { body: User[] };
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const listHandler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 200,
              body: users,
            }),
          interceptor,
        );

        let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const listResponse = await fetch(joinURL(baseURL, '/users'), {
            method: 'GET',
            headers: { 'x-value': '1' },
          });
          expect(listResponse.status).toBe(200);

          listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
          expect(listRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const searchParams = new HttpSearchParams({ name: 'User 1' });

          let listPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method: 'GET',
            headers: { 'x-value': '2' },
          });
          await expectFetchError(listPromise);

          listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
          expect(listRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const listRequest = new Request(joinURL(baseURL, '/users'), {
            method: 'GET',
            headers: { 'x-value': '2' },
          });
          listPromise = fetch(listRequest);
          await expectFetchError(listPromise);

          listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
          expect(listRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

          const messageType = type === 'local' ? 'warn' : 'error';
          expect(spies.warn).toHaveBeenCalledTimes(messageType === 'warn' ? 1 : 0);
          expect(spies.error).toHaveBeenCalledTimes(messageType === 'error' ? 1 : 0);

          const errorMessage = spies[messageType].mock.calls[0].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, {
            type: messageType,
            platform,
            request: listRequest,
          });
        });
      });
    });

    it('should log an error if a custom unhandled GET request handler throws', async () => {
      const error = new Error('Unhandled request.');

      const onUnhandledRequest = vi.fn((request: Request) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          throw error;
        }
      });

      await usingHttpInterceptor<{
        '/users': {
          GET: {
            request: {
              headers: { 'x-value': string };
              searchParams: { name?: string };
            };
            response: {
              200: { body: User[] };
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const listHandler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 200,
              body: users,
            }),
          interceptor,
        );

        let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const listResponse = await fetch(joinURL(baseURL, '/users'), {
            method: 'GET',
            headers: { 'x-value': '1' },
          });
          expect(listResponse.status).toBe(200);

          listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
          expect(listRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const searchParams = new HttpSearchParams({ name: 'User 1' });

          let listPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method: 'GET',
            headers: { 'x-value': '2' },
          });
          await expectFetchError(listPromise);

          listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
          expect(listRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const listRequest = new Request(joinURL(baseURL, '/users'), {
            method: 'GET',
            headers: { 'x-value': '2' },
          });
          listPromise = fetch(listRequest);
          await expectFetchError(listPromise);

          listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
          expect(listRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(1);

          expect(spies.error).toHaveBeenCalledWith(error);
        });
      });
    });
  });
}
