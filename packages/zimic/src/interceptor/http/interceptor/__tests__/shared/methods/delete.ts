import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema } from '@/http/types/schema';
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

export async function declareDeleteHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const crypto = await getCrypto();

  type User = JSONValue<{
    id: string;
    name: string;
  }>;

  const users: User[] = [
    {
      id: crypto.randomUUID(),
      name: 'User 1',
    },
    {
      id: crypto.randomUUID(),
      name: 'User 2',
    },
  ];

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Handler = options.type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;
  });

  it('should support intercepting DELETE requests with a static response', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionHandler = await promiseIfRemote(
        interceptor.delete(`/users/${users[0].id}`).respond({
          status: 200,
          body: users[0],
        }),
        interceptor,
      );
      expect(deletionHandler).toBeInstanceOf(Handler);

      let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      const deletedUsers = (await deletionResponse.json()) as User;
      expect(deletedUsers).toEqual(users[0]);

      deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<null>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[0]);
    });
  });

  it('should support intercepting DELETE requests with a computed response', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          request: { body: Partial<User> };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionHandler = await promiseIfRemote(
        interceptor.delete(`/users/${users[0].id}`).respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<Partial<User>>();

          return {
            status: 200,
            body: users[0],
          };
        }),
        interceptor,
      );

      let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
      expect(deletionRequests).toHaveLength(0);

      const userName = 'User (other)';

      const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies Partial<User>),
      });
      expect(deletionResponse.status).toBe(200);

      const deletedUsers = (await deletionResponse.json()) as User;
      expect(deletedUsers).toEqual<User>(users[0]);

      deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<Partial<User>>();
      expect(deletionRequest.body).toEqual<Partial<User>>({ name: userName });

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual<User>(users[0]);
    });
  });

  it('should support intercepting DELETE requests having headers', async () => {
    type UserDeletionRequestHeaders = HttpSchema.Headers<{
      accept?: string;
    }>;
    type UserDeletionResponseHeaders = HttpSchema.Headers<{
      'content-type'?: `application/${string}`;
      'cache-control'?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          request: {
            headers: UserDeletionRequestHeaders;
          };
          response: {
            200: {
              headers: UserDeletionResponseHeaders;
              body: User;
            };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionHandler = await promiseIfRemote(
        interceptor.delete(`/users/:id`).respond((request) => {
          expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserDeletionRequestHeaders>>();
          expect(request.headers).toBeInstanceOf(HttpHeaders);

          const acceptHeader = request.headers.get('accept')!;
          expect(acceptHeader).toBe('application/json');

          return {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'cache-control': 'no-cache',
            },
            body: users[0],
          };
        }),
        interceptor,
      );
      expect(deletionHandler).toBeInstanceOf(Handler);

      let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
        method: 'DELETE',
        headers: {
          accept: 'application/json',
        } satisfies UserDeletionRequestHeaders,
      });
      expect(deletionResponse.status).toBe(200);

      deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.headers).toEqualTypeOf<HttpHeaders<UserDeletionRequestHeaders>>();
      expect(deletionRequest.headers).toBeInstanceOf(HttpHeaders);
      expect(deletionRequest.headers.get('accept')).toBe('application/json');

      expectTypeOf(deletionRequest.response.headers).toEqualTypeOf<HttpHeaders<UserDeletionResponseHeaders>>();
      expect(deletionRequest.response.headers).toBeInstanceOf(HttpHeaders);
      expect(deletionRequest.response.headers.get('content-type')).toBe('application/json');
      expect(deletionRequest.response.headers.get('cache-control')).toBe('no-cache');
    });
  });

  it('should support intercepting DELETE requests having search params', async () => {
    type UserDeletionSearchParams = HttpSchema.SearchParams<{
      tag?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          request: {
            searchParams: UserDeletionSearchParams;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionHandler = await promiseIfRemote(
        interceptor.delete(`/users/:id`).respond((request) => {
          expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserDeletionSearchParams>>();
          expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

          return {
            status: 200,
            body: users[0],
          };
        }),
        interceptor,
      );
      expect(deletionHandler).toBeInstanceOf(Handler);

      let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
      expect(deletionRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserDeletionSearchParams>({
        tag: 'admin',
      });

      const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}?${searchParams.toString()}`), {
        method: 'DELETE',
      });
      expect(deletionResponse.status).toBe(200);

      deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.searchParams).toEqualTypeOf<HttpSearchParams<UserDeletionSearchParams>>();
      expect(deletionRequest.searchParams).toBeInstanceOf(HttpSearchParams);
      expect(deletionRequest.searchParams).toEqual(searchParams);
      expect(deletionRequest.searchParams.get('tag')).toBe('admin');
    });
  });

  it('should not intercept a DELETE request without a registered response', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          request: { body: Partial<User> };
          response: {
            200: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const userName = 'User (other)';

      let deletionResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies Partial<User>),
      });
      await expectFetchError(deletionResponsePromise);

      const deletionHandlerWithoutResponse = await promiseIfRemote(interceptor.delete(`/users/:id`), interceptor);
      expect(deletionHandlerWithoutResponse).toBeInstanceOf(Handler);

      let deletionRequestsWithoutResponse = await promiseIfRemote(
        deletionHandlerWithoutResponse.requests(),
        interceptor,
      );
      expect(deletionRequestsWithoutResponse).toHaveLength(0);

      let [deletionRequestWithoutResponse] = deletionRequestsWithoutResponse;
      expectTypeOf<typeof deletionRequestWithoutResponse.body>().toEqualTypeOf<Partial<User>>();
      expectTypeOf<typeof deletionRequestWithoutResponse.response>().toEqualTypeOf<never>();

      deletionResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies Partial<User>),
      });
      await expectFetchError(deletionResponsePromise);

      deletionRequestsWithoutResponse = await promiseIfRemote(deletionHandlerWithoutResponse.requests(), interceptor);
      expect(deletionRequestsWithoutResponse).toHaveLength(0);

      [deletionRequestWithoutResponse] = deletionRequestsWithoutResponse;
      expectTypeOf<typeof deletionRequestWithoutResponse.body>().toEqualTypeOf<Partial<User>>();
      expectTypeOf<typeof deletionRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const deletionHandlerWithResponse = deletionHandlerWithoutResponse.respond({
        status: 200,
        body: users[0],
      });

      const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies Partial<User>),
      });
      expect(deletionResponse.status).toBe(200);

      const deletedUsers = (await deletionResponse.json()) as User;
      expect(deletedUsers).toEqual(users[0]);

      expect(deletionRequestsWithoutResponse).toHaveLength(0);
      const deletionRequestsWithResponse = await promiseIfRemote(deletionHandlerWithResponse.requests(), interceptor);
      expect(deletionRequestsWithResponse).toHaveLength(1);

      const [deletionRequest] = deletionRequestsWithResponse;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<Partial<User>>();
      expect(deletionRequest.body).toEqual<Partial<User>>({ name: userName });

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual<User>(users[0]);
    });
  });

  it('should consider only the last declared response when intercepting DELETE requests', async () => {
    type ServerErrorResponseBody = JSONValue<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const deletionHandler = await promiseIfRemote(
        interceptor
          .delete(`/users/${users[0].id}`)
          .respond({
            status: 200,
            body: users[0],
          })
          .respond({
            status: 200,
            body: users[1],
          }),
        interceptor,
      );

      let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      const deletionUsers = (await deletionResponse.json()) as User;
      expect(deletionUsers).toEqual(users[1]);

      deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<null>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[1]);

      const errorDeletionHandler = await promiseIfRemote(
        interceptor.delete(`/users/${users[0].id}`).respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        interceptor,
      );

      let errorDeletionRequests = await promiseIfRemote(errorDeletionHandler.requests(), interceptor);
      expect(errorDeletionRequests).toHaveLength(0);

      const otherDeletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
      expect(otherDeletionResponse.status).toBe(500);

      const serverError = (await otherDeletionResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
      expect(deletionRequests).toHaveLength(1);

      errorDeletionRequests = await promiseIfRemote(errorDeletionHandler.requests(), interceptor);
      expect(errorDeletionRequests).toHaveLength(1);
      const [errorDeletionRequest] = errorDeletionRequests;
      expect(errorDeletionRequest).toBeInstanceOf(Request);

      expectTypeOf(errorDeletionRequest.body).toEqualTypeOf<null>();
      expect(errorDeletionRequest.body).toBe(null);

      expectTypeOf(errorDeletionRequest.response.status).toEqualTypeOf<500>();
      expect(errorDeletionRequest.response.status).toEqual(500);

      expectTypeOf(errorDeletionRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorDeletionRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });
    });
  });

  describe('Dinamic paths', () => {
    it('should support intercepting DELETE requests with a dynamic path', async () => {
      await usingHttpInterceptor<{
        '/users/:id': {
          DELETE: {
            response: {
              200: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const genericDeletionHandler = await promiseIfRemote(
          interceptor.delete(`/users/${users[0].id}`).respond({
            status: 200,
            body: users[0],
          }),
          interceptor,
        );
        expect(genericDeletionHandler).toBeInstanceOf(Handler);

        let genericDeletionRequests = await promiseIfRemote(genericDeletionHandler.requests(), interceptor);
        expect(genericDeletionRequests).toHaveLength(0);

        const genericDeletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
        expect(genericDeletionResponse.status).toBe(200);

        const genericDeletedUser = (await genericDeletionResponse.json()) as User;
        expect(genericDeletedUser).toEqual(users[0]);

        genericDeletionRequests = await promiseIfRemote(genericDeletionHandler.requests(), interceptor);
        expect(genericDeletionRequests).toHaveLength(1);
        const [genericDeletionRequest] = genericDeletionRequests;
        expect(genericDeletionRequest).toBeInstanceOf(Request);

        expectTypeOf(genericDeletionRequest.body).toEqualTypeOf<null>();
        expect(genericDeletionRequest.body).toBe(null);

        expectTypeOf(genericDeletionRequest.response.status).toEqualTypeOf<200>();
        expect(genericDeletionRequest.response.status).toEqual(200);

        expectTypeOf(genericDeletionRequest.response.body).toEqualTypeOf<User>();
        expect(genericDeletionRequest.response.body).toEqual(users[0]);

        await promiseIfRemote(genericDeletionHandler.bypass(), interceptor);

        const specificDeletionHandler = await promiseIfRemote(
          interceptor.delete(`/users/${users[0].id}`).respond({
            status: 200,
            body: users[0],
          }),
          interceptor,
        );
        expect(specificDeletionHandler).toBeInstanceOf(Handler);

        let specificDeletionRequests = await promiseIfRemote(specificDeletionHandler.requests(), interceptor);
        expect(specificDeletionRequests).toHaveLength(0);

        const specificDeletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
        expect(specificDeletionResponse.status).toBe(200);

        const specificDeletedUser = (await specificDeletionResponse.json()) as User;
        expect(specificDeletedUser).toEqual(users[0]);

        specificDeletionRequests = await promiseIfRemote(specificDeletionHandler.requests(), interceptor);
        expect(specificDeletionRequests).toHaveLength(1);
        const [specificDeletionRequest] = specificDeletionRequests;
        expect(specificDeletionRequest).toBeInstanceOf(Request);

        expectTypeOf(specificDeletionRequest.body).toEqualTypeOf<null>();
        expect(specificDeletionRequest.body).toBe(null);

        expectTypeOf(specificDeletionRequest.response.status).toEqualTypeOf<200>();
        expect(specificDeletionRequest.response.status).toEqual(200);

        expectTypeOf(specificDeletionRequest.response.body).toEqualTypeOf<User>();
        expect(specificDeletionRequest.response.body).toEqual(users[0]);

        const unmatchedDeletionResponsePromise = fetch(joinURL(baseURL, `/users/${2}`), { method: 'DELETE' });
        await expectFetchError(unmatchedDeletionResponsePromise);
      });
    });
  });

  describe('Restrictions', () => {
    it('should support intercepting DELETE requests having headers restrictions', async () => {
      type UserDeletionHeaders = HttpSchema.Headers<{
        'content-type'?: string;
        accept?: string;
      }>;

      await usingHttpInterceptor<{
        '/users/:id': {
          DELETE: {
            request: {
              headers: UserDeletionHeaders;
            };
            response: {
              200: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const deletionHandler = await promiseIfRemote(
          interceptor
            .delete(`/users/:id`)
            .with({
              headers: { 'content-type': 'application/json' },
            })
            .with((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserDeletionHeaders>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

              return request.headers.get('accept')?.includes('application/json') ?? false;
            })
            .respond((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserDeletionHeaders>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

              return {
                status: 200,
                body: users[0],
              };
            }),
          interceptor,
        );
        expect(deletionHandler).toBeInstanceOf(Handler);

        let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(0);

        const headers = new HttpHeaders<UserDeletionHeaders>({
          'content-type': 'application/json',
          accept: 'application/json',
        });

        let deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE', headers });
        expect(deletionResponse.status).toBe(200);
        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(1);

        headers.append('accept', 'application/xml');

        deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE', headers });
        expect(deletionResponse.status).toBe(200);
        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(2);

        headers.delete('accept');

        let deletionResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE', headers });
        await expectFetchError(deletionResponsePromise);
        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(2);

        headers.set('accept', 'application/json');
        headers.set('content-type', 'text/plain');

        deletionResponsePromise = fetch(joinURL(baseURL, '/users'), { method: 'DELETE', headers });
        await expectFetchError(deletionResponsePromise);
        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(2);
      });
    });

    it('should support intercepting DELETE requests having search params restrictions', async () => {
      type UserDeletionSearchParams = HttpSchema.SearchParams<{
        tag?: string;
      }>;

      await usingHttpInterceptor<{
        '/users/:id': {
          DELETE: {
            request: {
              searchParams: UserDeletionSearchParams;
            };
            response: {
              200: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const deletionHandler = await promiseIfRemote(
          interceptor
            .delete('/users/:id')
            .with({
              searchParams: { tag: 'admin' },
            })
            .respond((request) => {
              expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserDeletionSearchParams>>();
              expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

              return {
                status: 200,
                body: users[0],
              };
            }),
          interceptor,
        );
        expect(deletionHandler).toBeInstanceOf(Handler);

        let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(0);

        const searchParams = new HttpSearchParams<UserDeletionSearchParams>({
          tag: 'admin',
        });

        const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}?${searchParams.toString()}`), {
          method: 'DELETE',
        });
        expect(deletionResponse.status).toBe(200);
        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(1);

        searchParams.delete('tag');

        const deletionResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}?${searchParams.toString()}`), {
          method: 'DELETE',
        });
        await expectFetchError(deletionResponsePromise);
        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(1);
      });
    });

    it('should support intercepting DELETE requests having body restrictions', async () => {
      type UserDeletionBody = JSONValue<{
        tags?: string[];
        other?: string;
      }>;

      await usingHttpInterceptor<{
        '/users/:id': {
          DELETE: {
            request: {
              body: UserDeletionBody;
            };
            response: {
              200: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const deletionHandler = await promiseIfRemote(
          interceptor
            .delete(`/users/:id`)
            .with({
              body: { tags: ['admin'] },
            })
            .with((request) => {
              expectTypeOf(request.body).toEqualTypeOf<UserDeletionBody>();

              return request.body.other?.startsWith('extra') ?? false;
            })
            .respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<UserDeletionBody>();

              return {
                status: 200,
                body: users[0],
              };
            }),
          interceptor,
        );
        expect(deletionHandler).toBeInstanceOf(Handler);

        let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(0);

        let deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method: 'DELETE',
          body: JSON.stringify({
            tags: ['admin'],
            other: 'extra',
          } satisfies UserDeletionBody),
        });
        expect(deletionResponse.status).toBe(200);
        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(1);

        deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method: 'DELETE',
          body: JSON.stringify({
            tags: ['admin'],
            other: 'extra-other',
          } satisfies UserDeletionBody),
        });
        expect(deletionResponse.status).toBe(200);
        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(2);

        let deletionResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method: 'DELETE',
          body: JSON.stringify({
            tags: ['admin'],
          } satisfies UserDeletionBody),
        });
        await expectFetchError(deletionResponsePromise);
        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(2);

        deletionResponsePromise = fetch(joinURL(baseURL, '/users'), {
          method: 'DELETE',
          body: JSON.stringify({
            tags: [],
          } satisfies UserDeletionBody),
        });
        await expectFetchError(deletionResponsePromise);
        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(2);
      });
    });
  });

  describe('Bypass', () => {
    it('should ignore handlers with bypassed responses when intercepting DELETE requests', async () => {
      type ServerErrorResponseBody = JSONValue<{
        message: string;
      }>;

      await usingHttpInterceptor<{
        '/users/:id': {
          DELETE: {
            response: {
              200: { body: User };
              500: { body: ServerErrorResponseBody };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const deletionHandler = await promiseIfRemote(
          interceptor
            .delete(`/users/${users[0].id}`)
            .respond({
              status: 200,
              body: users[0],
            })
            .bypass(),
          interceptor,
        );

        let initialDeletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(initialDeletionRequests).toHaveLength(0);

        const deletionResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
        await expectFetchError(deletionResponsePromise);

        await promiseIfRemote(
          deletionHandler.respond({
            status: 200,
            body: users[1],
          }),
          interceptor,
        );

        initialDeletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(initialDeletionRequests).toHaveLength(0);
        let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(0);

        let deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
        expect(deletionResponse.status).toBe(200);

        let createdUsers = (await deletionResponse.json()) as User;
        expect(createdUsers).toEqual(users[1]);

        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(1);
        let [deletionRequest] = deletionRequests;
        expect(deletionRequest).toBeInstanceOf(Request);

        expectTypeOf(deletionRequest.body).toEqualTypeOf<null>();
        expect(deletionRequest.body).toBe(null);

        expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
        expect(deletionRequest.response.status).toEqual(200);

        expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
        expect(deletionRequest.response.body).toEqual(users[1]);

        const errorDeletionHandler = await promiseIfRemote(
          interceptor.delete(`/users/${users[0].id}`).respond({
            status: 500,
            body: { message: 'Internal server error' },
          }),
          interceptor,
        );

        let errorDeletionRequests = await promiseIfRemote(errorDeletionHandler.requests(), interceptor);
        expect(errorDeletionRequests).toHaveLength(0);

        const otherDeletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
        expect(otherDeletionResponse.status).toBe(500);

        const serverError = (await otherDeletionResponse.json()) as ServerErrorResponseBody;
        expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(1);

        errorDeletionRequests = await promiseIfRemote(errorDeletionHandler.requests(), interceptor);
        expect(errorDeletionRequests).toHaveLength(1);
        const [errorDeletionRequest] = errorDeletionRequests;
        expect(errorDeletionRequest).toBeInstanceOf(Request);

        expectTypeOf(errorDeletionRequest.body).toEqualTypeOf<null>();
        expect(errorDeletionRequest.body).toBe(null);

        expectTypeOf(errorDeletionRequest.response.status).toEqualTypeOf<500>();
        expect(errorDeletionRequest.response.status).toEqual(500);

        expectTypeOf(errorDeletionRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
        expect(errorDeletionRequest.response.body).toEqual<ServerErrorResponseBody>({
          message: 'Internal server error',
        });

        await promiseIfRemote(errorDeletionHandler.bypass(), interceptor);

        deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
        expect(deletionResponse.status).toBe(200);

        createdUsers = (await deletionResponse.json()) as User;
        expect(createdUsers).toEqual(users[1]);

        errorDeletionRequests = await promiseIfRemote(errorDeletionHandler.requests(), interceptor);
        expect(errorDeletionRequests).toHaveLength(1);

        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(2);
        [deletionRequest] = deletionRequests;
        expect(deletionRequest).toBeInstanceOf(Request);

        expectTypeOf(deletionRequest.body).toEqualTypeOf<null>();
        expect(deletionRequest.body).toBe(null);

        expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
        expect(deletionRequest.response.status).toEqual(200);

        expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
        expect(deletionRequest.response.body).toEqual(users[1]);
      });
    });
  });

  describe('Clear', () => {
    it('should ignore all handlers after cleared when intercepting DELETE requests', async () => {
      await usingHttpInterceptor<{
        '/users/:id': {
          DELETE: {
            response: {
              200: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const deletionHandler = await promiseIfRemote(
          interceptor.delete(`/users/${users[0].id}`).respond({
            status: 200,
            body: users[0],
          }),
          interceptor,
        );

        let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(0);

        const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
        expect(deletionResponse.status).toBe(200);

        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(1);

        await promiseIfRemote(interceptor.clear(), interceptor);

        const deletionResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
        await expectFetchError(deletionResponsePromise);

        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(1);
      });
    });

    it('should support creating new handlers after cleared', async () => {
      await usingHttpInterceptor<{
        '/users/:id': {
          DELETE: {
            response: {
              200: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        let deletionHandler = await promiseIfRemote(
          interceptor.delete(`/users/${users[0].id}`).respond({
            status: 200,
            body: users[0],
          }),
          interceptor,
        );

        await promiseIfRemote(interceptor.clear(), interceptor);

        deletionHandler = await promiseIfRemote(
          interceptor.delete(`/users/${users[0].id}`).respond({
            status: 200,
            body: users[1],
          }),
          interceptor,
        );

        let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(0);

        const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
        expect(deletionResponse.status).toBe(200);

        const createdUsers = (await deletionResponse.json()) as User;
        expect(createdUsers).toEqual(users[1]);

        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(1);
        const [deletionRequest] = deletionRequests;
        expect(deletionRequest).toBeInstanceOf(Request);

        expectTypeOf(deletionRequest.body).toEqualTypeOf<null>();
        expect(deletionRequest.body).toBe(null);

        expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
        expect(deletionRequest.response.status).toEqual(200);

        expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
        expect(deletionRequest.response.body).toEqual(users[1]);
      });
    });

    it('should support reusing previous handlers after cleared', async () => {
      await usingHttpInterceptor<{
        '/users/:id': {
          DELETE: {
            response: {
              200: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const deletionHandler = await promiseIfRemote(
          interceptor.delete(`/users/${users[0].id}`).respond({
            status: 200,
            body: users[0],
          }),
          interceptor,
        );

        await promiseIfRemote(interceptor.clear(), interceptor);

        await promiseIfRemote(
          deletionHandler.respond({
            status: 200,
            body: users[1],
          }),
          interceptor,
        );

        let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(0);

        const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
        expect(deletionResponse.status).toBe(200);

        const createdUsers = (await deletionResponse.json()) as User;
        expect(createdUsers).toEqual(users[1]);

        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(1);
        const [deletionRequest] = deletionRequests;
        expect(deletionRequest).toBeInstanceOf(Request);

        expectTypeOf(deletionRequest.body).toEqualTypeOf<null>();
        expect(deletionRequest.body).toBe(null);

        expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
        expect(deletionRequest.response.status).toEqual(200);

        expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
        expect(deletionRequest.response.body).toEqual(users[1]);
      });
    });
  });

  describe('Life cycle', () => {
    it('should ignore all handlers after restarted when intercepting DELETE requests', async () => {
      await usingHttpInterceptor<{
        '/users/:id': {
          DELETE: {
            response: {
              200: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const deletionHandler = await promiseIfRemote(
          interceptor.delete(`/users/${users[0].id}`).respond({
            status: 200,
            body: users[0],
          }),
          interceptor,
        );

        let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(0);

        const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
        expect(deletionResponse.status).toBe(200);

        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(1);

        expect(interceptor.isRunning()).toBe(true);
        await interceptor.stop();
        expect(interceptor.isRunning()).toBe(false);

        let deletionResponsePromise = fetchWithTimeout(joinURL(baseURL, `/users/${users[0].id}`), {
          method: 'DELETE',
          timeout: 200,
        });
        await expectFetchError(deletionResponsePromise, { canBeAborted: true });

        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(1);

        await interceptor.start();
        expect(interceptor.isRunning()).toBe(true);

        deletionResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
        await expectFetchError(deletionResponsePromise);

        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(1);
      });
    });

    it('should ignore all handlers after restarted when intercepting DELETE requests, even if another interceptor is still running', async () => {
      await usingHttpInterceptor<{
        '/users/:id': {
          DELETE: {
            response: {
              200: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const deletionHandler = await promiseIfRemote(
          interceptor.delete(`/users/${users[0].id}`).respond({
            status: 200,
            body: users[0],
          }),
          interceptor,
        );

        let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(0);

        const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
        expect(deletionResponse.status).toBe(200);

        deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(1);

        await usingHttpInterceptor(interceptorOptions, async (otherInterceptor) => {
          expect(interceptor.isRunning()).toBe(true);
          expect(otherInterceptor.isRunning()).toBe(true);

          await interceptor.stop();
          expect(interceptor.isRunning()).toBe(false);
          expect(otherInterceptor.isRunning()).toBe(true);

          let deletionResponsePromise = fetchWithTimeout(joinURL(baseURL, `/users/${users[0].id}`), {
            method: 'DELETE',
            timeout: 200,
          });
          await expectFetchError(deletionResponsePromise, { canBeAborted: true });

          deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
          expect(deletionRequests).toHaveLength(1);

          await interceptor.start();
          expect(interceptor.isRunning()).toBe(true);
          expect(otherInterceptor.isRunning()).toBe(true);

          deletionResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
          await expectFetchError(deletionResponsePromise);

          deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
          expect(deletionRequests).toHaveLength(1);
        });
      });
    });

    it('should throw an error when trying to create a DELETE request handler if not running', async () => {
      const interceptor = createInternalHttpInterceptor(interceptorOptions);
      expect(interceptor.isRunning()).toBe(false);

      await expect(async () => {
        await interceptor.delete('/');
      }).rejects.toThrowError(new NotStartedHttpInterceptorError());
    });
  });

  describe('Unhandled requests', () => {
    if (type === 'local') {
      it('should show a warning when logging is enabled and a DELETE request is unhandled and bypassed', async () => {
        await usingHttpInterceptor<{
          '/users/:id': {
            DELETE: {
              request: { headers: { 'x-value': string } };
              response: {
                200: { body: User };
              };
            };
          };
        }>({ ...interceptorOptions, onUnhandledRequest: { log: true } }, async (interceptor) => {
          const deletionHandler = await promiseIfRemote(
            interceptor
              .delete(`/users/${users[0].id}`)
              .with({ headers: { 'x-value': '1' } })
              .respond({
                status: 200,
                body: users[0],
              }),
            interceptor,
          );

          let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
          expect(deletionRequests).toHaveLength(0);

          await usingIgnoredConsole(['warn', 'error'], async (spies) => {
            const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
              method: 'DELETE',
              headers: { 'x-value': '1' },
            });
            expect(deletionResponse.status).toBe(200);

            deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
            expect(deletionRequests).toHaveLength(1);

            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(0);

            const deletionRequest = new Request(joinURL(baseURL, `/users/${users[0].id}`), { method: 'DELETE' });
            const deletionResponsePromise = fetch(deletionRequest);
            await expectFetchError(deletionResponsePromise);

            deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
            expect(deletionRequests).toHaveLength(1);

            expect(spies.warn).toHaveBeenCalledTimes(1);
            expect(spies.error).toHaveBeenCalledTimes(0);

            const warnMessage = spies.warn.mock.calls[0].join(' ');
            await verifyUnhandledRequestMessage(warnMessage, {
              type: 'warn',
              platform,
              request: deletionRequest,
            });
          });
        });
      });
    }

    if (type === 'remote') {
      it('should show an error when logging is enabled and a DELETE request is unhandled and rejected', async () => {
        await usingHttpInterceptor<{
          '/users/:id': {
            DELETE: {
              request: { headers: { 'x-value': string } };
              response: {
                200: { body: User };
              };
            };
          };
        }>({ ...interceptorOptions, onUnhandledRequest: { log: true } }, async (interceptor) => {
          const deletionHandler = await promiseIfRemote(
            interceptor
              .delete(`/users/${users[0].id}`)
              .with({ headers: { 'x-value': '1' } })
              .respond({
                status: 200,
                body: users[0],
              }),
            interceptor,
          );

          let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
          expect(deletionRequests).toHaveLength(0);

          await usingIgnoredConsole(['warn', 'error'], async (spies) => {
            const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
              method: 'DELETE',
              headers: { 'x-value': '1' },
            });
            expect(deletionResponse.status).toBe(200);

            deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
            expect(deletionRequests).toHaveLength(1);

            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(0);

            const deletionRequest = new Request(joinURL(baseURL, `/users/${users[0].id}`), {
              method: 'DELETE',
              headers: { 'x-value': '2' },
            });
            const deletionResponsePromise = fetch(deletionRequest);
            await expectFetchError(deletionResponsePromise);

            deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
            expect(deletionRequests).toHaveLength(1);

            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(1);

            const errorMessage = spies.error.mock.calls[0].join(' ');
            await verifyUnhandledRequestMessage(errorMessage, {
              type: 'error',
              platform,
              request: deletionRequest,
            });
          });
        });
      });
    }

    it('should support a custom unhandled DELETE request handler', async () => {
      const onUnhandledRequest = vi.fn(async (request: Request, context: UnhandledRequestStrategy.HandlerContext) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          await context.log();
        }
      });

      await usingHttpInterceptor<{
        '/users/:id': {
          DELETE: {
            request: {
              headers: { 'x-value': string };
              searchParams: { name?: string };
            };
            response: {
              200: { body: User };
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const deletionHandler = await promiseIfRemote(
          interceptor
            .delete(`/users/${users[0].id}`)
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 200,
              body: users[0],
            }),
          interceptor,
        );

        let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method: 'DELETE',
            headers: { 'x-value': '1' },
          });
          expect(deletionResponse.status).toBe(200);

          deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
          expect(deletionRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const searchParams = new HttpSearchParams({ name: 'User 1' });

          let deletionResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}?${searchParams.toString()}`), {
            method: 'DELETE',
            headers: { 'x-value': '2' },
          });
          await expectFetchError(deletionResponsePromise);

          deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
          expect(deletionRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const deletionRequest = new Request(joinURL(baseURL, `/users/${users[0].id}`), {
            method: 'DELETE',
            headers: { 'x-value': '2' },
          });
          deletionResponsePromise = fetch(deletionRequest);
          await expectFetchError(deletionResponsePromise);

          deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
          expect(deletionRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

          const messageType = type === 'local' ? 'warn' : 'error';
          expect(spies.warn).toHaveBeenCalledTimes(messageType === 'warn' ? 1 : 0);
          expect(spies.error).toHaveBeenCalledTimes(messageType === 'error' ? 1 : 0);

          const errorMessage = spies[messageType].mock.calls[0].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, {
            type: messageType,
            platform,
            request: deletionRequest,
          });
        });
      });
    });

    it('should log an error if a custom unhandled DELETE request handler throws', async () => {
      const error = new Error('Unhandled request.');

      const onUnhandledRequest = vi.fn((request: Request) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          throw error;
        }
      });

      await usingHttpInterceptor<{
        '/users/:id': {
          DELETE: {
            request: {
              headers: { 'x-value': string };
              searchParams: { name?: string };
            };
            response: {
              200: { body: User };
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const deletionHandler = await promiseIfRemote(
          interceptor
            .delete(`/users/${users[0].id}`)
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 200,
              body: users[0],
            }),
          interceptor,
        );

        let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method: 'DELETE',
            headers: { 'x-value': '1' },
          });
          expect(deletionResponse.status).toBe(200);

          deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
          expect(deletionRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const searchParams = new HttpSearchParams({ name: 'User 1' });

          let deletionResponsePromise = fetch(joinURL(baseURL, `/users/${users[0].id}?${searchParams.toString()}`), {
            method: 'DELETE',
            headers: { 'x-value': '2' },
          });
          await expectFetchError(deletionResponsePromise);

          deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
          expect(deletionRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const deletionRequest = new Request(joinURL(baseURL, `/users/${users[0].id}`), {
            method: 'DELETE',
            headers: { 'x-value': '2' },
          });
          deletionResponsePromise = fetch(deletionRequest);
          await expectFetchError(deletionResponsePromise);

          deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
          expect(deletionRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(1);

          expect(spies.error).toHaveBeenCalledWith(error);
        });
      });
    });

    it('should not show a warning or error when logging is disabled and a DELETE request is unhandled', async () => {
      await usingHttpInterceptor<{
        '/users/:id': {
          DELETE: {
            request: { headers: { 'x-value': string } };
            response: {
              200: { body: User };
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest: { log: false } }, async (interceptor) => {
        const deletionHandler = await promiseIfRemote(
          interceptor
            .delete(`/users/${users[0].id}`)
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 200,
              body: users[0],
            }),
          interceptor,
        );

        let deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
        expect(deletionRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const deletionResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method: 'DELETE',
            headers: { 'x-value': '1' },
          });
          expect(deletionResponse.status).toBe(200);

          deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
          expect(deletionRequests).toHaveLength(1);

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const deletionRequest = new Request(joinURL(baseURL, `/users/${users[0].id}`), {
            method: 'DELETE',
            headers: { 'x-value': '2' },
          });
          const deletionResponsePromise = fetch(deletionRequest);
          await expectFetchError(deletionResponsePromise);

          deletionRequests = await promiseIfRemote(deletionHandler.requests(), interceptor);
          expect(deletionRequests).toHaveLength(1);

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);
        });
      });
    });
  });
}
