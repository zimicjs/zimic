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

export async function declarePostHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const crypto = await getCrypto();

  type User = JSONValue<{
    id: string;
    name: string;
  }>;

  type UserCreationBody = Omit<User, 'id'>;

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

  it('should support intercepting POST requests with a static response', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          response: {
            201: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const creationHandler = await promiseIfRemote(
        interceptor.post('/users').respond({
          status: 201,
          body: users[0],
        }),
        interceptor,
      );
      expect(creationHandler).toBeInstanceOf(Handler);

      let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
      expect(creationRequests).toHaveLength(0);

      const creationResponse = await fetch(joinURL(baseURL, '/users'), { method: 'POST' });
      expect(creationResponse.status).toBe(201);

      const createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual(users[0]);

      creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
      expect(creationRequests).toHaveLength(1);
      const [creationRequest] = creationRequests;
      expect(creationRequest).toBeInstanceOf(Request);

      expectTypeOf(creationRequest.body).toEqualTypeOf<null>();
      expect(creationRequest.body).toBe(null);

      expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
      expect(creationRequest.response.status).toEqual(201);

      expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
      expect(creationRequest.response.body).toEqual(users[0]);
    });
  });

  it('should support intercepting POST requests with a computed response', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: { body: UserCreationBody };
          response: {
            201: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const creationHandler = await promiseIfRemote(
        interceptor.post('/users').respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<UserCreationBody>();

          return {
            status: 201,
            body: {
              id: crypto.randomUUID(),
              name: request.body.name,
            },
          };
        }),
        interceptor,
      );
      expect(creationHandler).toBeInstanceOf(Handler);

      let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
      expect(creationRequests).toHaveLength(0);

      const userName = 'User (other)';

      const creationResponse = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: userName } satisfies UserCreationBody),
      });
      expect(creationResponse.status).toBe(201);

      const createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual<User>({
        id: expect.any(String) as string,
        name: userName,
      });

      creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
      expect(creationRequests).toHaveLength(1);
      const [creationRequest] = creationRequests;
      expect(creationRequest).toBeInstanceOf(Request);

      expectTypeOf(creationRequest.body).toEqualTypeOf<UserCreationBody>();
      expect(creationRequest.body).toEqual<UserCreationBody>({ name: userName });

      expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
      expect(creationRequest.response.status).toEqual(201);

      expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
      expect(creationRequest.response.body).toEqual<User>(createdUsers);
    });
  });

  it('should support intercepting POST requests having headers', async () => {
    type UserCreationRequestHeaders = HttpSchema.Headers<{
      accept?: string;
    }>;
    type UserCreationResponseHeaders = HttpSchema.Headers<{
      'content-language'?: string;
      'cache-control'?: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: {
            headers: UserCreationRequestHeaders;
          };
          response: {
            201: {
              headers: UserCreationResponseHeaders;
              body: User;
            };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const creationHandler = await promiseIfRemote(
        interceptor.post('/users').respond((request) => {
          expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserCreationRequestHeaders>>();
          expect(request.headers).toBeInstanceOf(HttpHeaders);

          const acceptHeader = request.headers.get('accept')!;
          expect(acceptHeader).toBe('application/json');

          return {
            status: 201,
            headers: {
              'content-language': 'en',
              'cache-control': 'no-cache',
            },
            body: users[0],
          };
        }),
        interceptor,
      );
      expect(creationHandler).toBeInstanceOf(Handler);

      let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
      expect(creationRequests).toHaveLength(0);

      const creationResponse = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        headers: {
          accept: 'application/json',
        } satisfies UserCreationRequestHeaders,
      });
      expect(creationResponse.status).toBe(201);

      const createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual(users[0]);

      creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
      expect(creationRequests).toHaveLength(1);
      const [creationRequest] = creationRequests;
      expect(creationRequest).toBeInstanceOf(Request);

      expectTypeOf(creationRequest.headers).toEqualTypeOf<HttpHeaders<UserCreationRequestHeaders>>();
      expect(creationRequest.headers).toBeInstanceOf(HttpHeaders);
      expect(creationRequest.headers.get('accept')).toBe('application/json');

      expectTypeOf(creationRequest.response.headers).toEqualTypeOf<HttpHeaders<UserCreationResponseHeaders>>();
      expect(creationRequest.response.headers).toBeInstanceOf(HttpHeaders);
      expect(creationRequest.response.headers.get('content-language')).toBe('en');
      expect(creationRequest.response.headers.get('cache-control')).toBe('no-cache');
    });
  });

  it('should support intercepting POST requests having search params', async () => {
    type UserCreationSearchParams = HttpSchema.SearchParams<{
      tag?: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: {
            searchParams: UserCreationSearchParams;
          };
          response: {
            201: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const creationHandler = await promiseIfRemote(
        interceptor.post('/users').respond((request) => {
          expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserCreationSearchParams>>();
          expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

          return {
            status: 201,
            body: users[0],
          };
        }),
        interceptor,
      );
      expect(creationHandler).toBeInstanceOf(Handler);

      let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
      expect(creationRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserCreationSearchParams>({
        tag: 'admin',
      });

      const creationResponse = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'POST' });
      expect(creationResponse.status).toBe(201);

      const createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual(users[0]);

      creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
      expect(creationRequests).toHaveLength(1);
      const [creationRequest] = creationRequests;
      expect(creationRequest).toBeInstanceOf(Request);

      expectTypeOf(creationRequest.searchParams).toEqualTypeOf<HttpSearchParams<UserCreationSearchParams>>();
      expect(creationRequest.searchParams).toBeInstanceOf(HttpSearchParams);
      expect(creationRequest.searchParams).toEqual(searchParams);
      expect(creationRequest.searchParams.get('tag')).toBe('admin');
    });
  });

  it('should not intercept a POST request without a registered response', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: { body: UserCreationBody };
          response: {
            201: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const userName = 'User (other)';

      let creationPromise = fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: userName } satisfies UserCreationBody),
      });
      await expectFetchError(creationPromise);

      const creationHandlerWithoutResponse = await promiseIfRemote(interceptor.post('/users'), interceptor);
      expect(creationHandlerWithoutResponse).toBeInstanceOf(Handler);

      let creationRequestsWithoutResponse = await promiseIfRemote(
        creationHandlerWithoutResponse.requests(),
        interceptor,
      );
      expect(creationRequestsWithoutResponse).toHaveLength(0);

      let [creationRequestWithoutResponse] = creationRequestsWithoutResponse;
      expectTypeOf<typeof creationRequestWithoutResponse.body>().toEqualTypeOf<UserCreationBody>();
      expectTypeOf<typeof creationRequestWithoutResponse.response>().toEqualTypeOf<never>();

      creationPromise = fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: userName } satisfies UserCreationBody),
      });
      await expectFetchError(creationPromise);

      creationRequestsWithoutResponse = await promiseIfRemote(creationHandlerWithoutResponse.requests(), interceptor);
      expect(creationRequestsWithoutResponse).toHaveLength(0);

      [creationRequestWithoutResponse] = creationRequestsWithoutResponse;
      expectTypeOf<typeof creationRequestWithoutResponse.body>().toEqualTypeOf<UserCreationBody>();
      expectTypeOf<typeof creationRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const creationHandlerWithResponse = creationHandlerWithoutResponse.respond({
        status: 201,
        body: users[0],
      });

      const creationResponse = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: userName } satisfies UserCreationBody),
      });
      expect(creationResponse.status).toBe(201);

      const createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual(users[0]);

      expect(creationRequestsWithoutResponse).toHaveLength(0);
      const creationRequestsWithResponse = await promiseIfRemote(creationHandlerWithResponse.requests(), interceptor);
      expect(creationRequestsWithResponse).toHaveLength(1);

      const [creationRequest] = creationRequestsWithResponse;
      expect(creationRequest).toBeInstanceOf(Request);

      expectTypeOf(creationRequest.body).toEqualTypeOf<UserCreationBody>();
      expect(creationRequest.body).toEqual<UserCreationBody>({ name: userName });

      expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
      expect(creationRequest.response.status).toEqual(201);

      expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
      expect(creationRequest.response.body).toEqual<User>(users[0]);
    });
  });

  it('should consider only the last declared response when intercepting POST requests', async () => {
    type ServerErrorResponseBody = JSONValue<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/users': {
        POST: {
          response: {
            201: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const creationHandler = await promiseIfRemote(
        interceptor
          .post('/users')
          .respond({
            status: 201,
            body: users[0],
          })
          .respond({
            status: 201,
            body: users[1],
          }),
        interceptor,
      );

      await promiseIfRemote(
        creationHandler.respond({
          status: 201,
          body: users[1],
        }),
        interceptor,
      );

      let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
      expect(creationRequests).toHaveLength(0);

      const creationResponse = await fetch(joinURL(baseURL, '/users'), { method: 'POST' });
      expect(creationResponse.status).toBe(201);

      const createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

      creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
      expect(creationRequests).toHaveLength(1);
      const [creationRequest] = creationRequests;
      expect(creationRequest).toBeInstanceOf(Request);

      expectTypeOf(creationRequest.body).toEqualTypeOf<null>();
      expect(creationRequest.body).toBe(null);

      expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
      expect(creationRequest.response.status).toEqual(201);

      expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
      expect(creationRequest.response.body).toEqual(users[1]);

      const errorCreationHandler = await promiseIfRemote(
        interceptor.post('/users').respond({
          status: 500,
          body: { message: 'Internal server error' },
        }),
        interceptor,
      );

      let errorCreationRequests = await promiseIfRemote(errorCreationHandler.requests(), interceptor);
      expect(errorCreationRequests).toHaveLength(0);

      const otherCreationResponse = await fetch(joinURL(baseURL, '/users'), { method: 'POST' });
      expect(otherCreationResponse.status).toBe(500);

      const serverError = (await otherCreationResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
      expect(creationRequests).toHaveLength(1);

      errorCreationRequests = await promiseIfRemote(errorCreationHandler.requests(), interceptor);
      expect(errorCreationRequests).toHaveLength(1);
      const [errorCreationRequest] = errorCreationRequests;
      expect(errorCreationRequest).toBeInstanceOf(Request);

      expectTypeOf(errorCreationRequest.body).toEqualTypeOf<null>();
      expect(errorCreationRequest.body).toBe(null);

      expectTypeOf(errorCreationRequest.response.status).toEqualTypeOf<500>();
      expect(errorCreationRequest.response.status).toEqual(500);

      expectTypeOf(errorCreationRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorCreationRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });
    });
  });

  describe('Restrictions', () => {
    it('should support intercepting POST requests having headers restrictions', async () => {
      type UserCreationHeaders = HttpSchema.Headers<{
        'content-language'?: string;
        accept?: string;
      }>;

      await usingHttpInterceptor<{
        '/users': {
          POST: {
            request: {
              headers: UserCreationHeaders;
            };
            response: {
              200: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const creationHandler = await promiseIfRemote(
          interceptor
            .post('/users')
            .with({
              headers: { 'content-language': 'en' },
            })
            .with((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserCreationHeaders>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

              return request.headers.get('accept')?.includes('application/json') ?? false;
            })
            .respond((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserCreationHeaders>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

              return {
                status: 200,
                body: users[0],
              };
            }),
          interceptor,
        );
        expect(creationHandler).toBeInstanceOf(Handler);

        let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(0);

        const headers = new HttpHeaders<UserCreationHeaders>({
          'content-language': 'en',
          accept: 'application/json',
        });

        let creationResponse = await fetch(joinURL(baseURL, '/users'), { method: 'POST', headers });
        expect(creationResponse.status).toBe(200);
        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);

        headers.append('accept', 'application/xml');

        creationResponse = await fetch(joinURL(baseURL, '/users'), { method: 'POST', headers });
        expect(creationResponse.status).toBe(200);
        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(2);

        headers.delete('accept');

        let creationPromise = fetch(joinURL(baseURL, '/users'), { method: 'POST', headers });
        await expectFetchError(creationPromise);
        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(2);

        headers.set('accept', 'application/json');
        headers.set('content-language', 'pt');

        creationPromise = fetch(joinURL(baseURL, '/users'), { method: 'POST', headers });
        await expectFetchError(creationPromise);
        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(2);
      });
    });

    it('should support intercepting POST requests having search params restrictions', async () => {
      type UserCreationSearchParams = HttpSchema.SearchParams<{
        tag?: string;
      }>;

      await usingHttpInterceptor<{
        '/users': {
          POST: {
            request: {
              searchParams: UserCreationSearchParams;
            };
            response: {
              201: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const creationHandler = await promiseIfRemote(
          interceptor
            .post('/users')
            .with({
              searchParams: { tag: 'admin' },
            })
            .respond((request) => {
              expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserCreationSearchParams>>();
              expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

              return {
                status: 201,
                body: users[0],
              };
            }),
          interceptor,
        );
        expect(creationHandler).toBeInstanceOf(Handler);

        let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(0);

        const searchParams = new HttpSearchParams<UserCreationSearchParams>({
          tag: 'admin',
        });

        const creationResponse = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'POST' });
        expect(creationResponse.status).toBe(201);
        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);

        searchParams.delete('tag');

        const creationPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
          method: 'POST',
        });
        await expectFetchError(creationPromise);
        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);
      });
    });

    it('should support intercepting POST requests having body restrictions', async () => {
      await usingHttpInterceptor<{
        '/users': {
          POST: {
            request: {
              body: UserCreationBody;
            };
            response: {
              200: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const creationHandler = await promiseIfRemote(
          interceptor
            .post('/users')
            .with({
              body: { name: users[0].name },
            })
            .respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<UserCreationBody>();

              return {
                status: 200,
                body: users[0],
              };
            }),
          interceptor,
        );
        expect(creationHandler).toBeInstanceOf(Handler);

        let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(0);

        const creationResponse = await fetch(joinURL(baseURL, '/users'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(users[0] satisfies UserCreationBody),
        });
        expect(creationResponse.status).toBe(200);

        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);

        const creationPromise = fetch(joinURL(baseURL, '/users'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(users[1] satisfies UserCreationBody),
        });
        await expectFetchError(creationPromise);

        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);
      });
    });
  });

  describe('Bypass', () => {
    it('should ignore handlers with bypassed responses when intercepting POST requests', async () => {
      type ServerErrorResponseBody = JSONValue<{
        message: string;
      }>;

      await usingHttpInterceptor<{
        '/users': {
          POST: {
            response: {
              201: { body: User };
              500: { body: ServerErrorResponseBody };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const creationHandler = await promiseIfRemote(
          interceptor
            .post('/users')
            .respond({
              status: 201,
              body: users[0],
            })
            .bypass(),
          interceptor,
        );

        let initialCreationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(initialCreationRequests).toHaveLength(0);

        const creationPromise = fetch(joinURL(baseURL, '/users'), { method: 'POST' });
        await expectFetchError(creationPromise);

        await promiseIfRemote(
          creationHandler.respond({
            status: 201,
            body: users[1],
          }),
          interceptor,
        );

        initialCreationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(initialCreationRequests).toHaveLength(0);
        let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(0);

        let creationResponse = await fetch(joinURL(baseURL, '/users'), { method: 'POST' });
        expect(creationResponse.status).toBe(201);

        let createdUsers = (await creationResponse.json()) as User;
        expect(createdUsers).toEqual(users[1]);

        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);
        let [creationRequest] = creationRequests;
        expect(creationRequest).toBeInstanceOf(Request);

        expectTypeOf(creationRequest.body).toEqualTypeOf<null>();
        expect(creationRequest.body).toBe(null);

        expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
        expect(creationRequest.response.status).toEqual(201);

        expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
        expect(creationRequest.response.body).toEqual(users[1]);

        const errorCreationHandler = await promiseIfRemote(
          interceptor.post('/users').respond({
            status: 500,
            body: { message: 'Internal server error' },
          }),
          interceptor,
        );

        let errorCreationRequests = await promiseIfRemote(errorCreationHandler.requests(), interceptor);
        expect(errorCreationRequests).toHaveLength(0);

        const otherCreationResponse = await fetch(joinURL(baseURL, '/users'), { method: 'POST' });
        expect(otherCreationResponse.status).toBe(500);

        const serverError = (await otherCreationResponse.json()) as ServerErrorResponseBody;
        expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);

        errorCreationRequests = await promiseIfRemote(errorCreationHandler.requests(), interceptor);
        expect(errorCreationRequests).toHaveLength(1);
        const [errorCreationRequest] = errorCreationRequests;
        expect(errorCreationRequest).toBeInstanceOf(Request);

        expectTypeOf(errorCreationRequest.body).toEqualTypeOf<null>();
        expect(errorCreationRequest.body).toBe(null);

        expectTypeOf(errorCreationRequest.response.status).toEqualTypeOf<500>();
        expect(errorCreationRequest.response.status).toEqual(500);

        expectTypeOf(errorCreationRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
        expect(errorCreationRequest.response.body).toEqual<ServerErrorResponseBody>({
          message: 'Internal server error',
        });

        await promiseIfRemote(errorCreationHandler.bypass(), interceptor);

        creationResponse = await fetch(joinURL(baseURL, '/users'), { method: 'POST' });
        expect(creationResponse.status).toBe(201);

        createdUsers = (await creationResponse.json()) as User;
        expect(createdUsers).toEqual(users[1]);

        errorCreationRequests = await promiseIfRemote(errorCreationHandler.requests(), interceptor);
        expect(errorCreationRequests).toHaveLength(1);

        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(2);
        [creationRequest] = creationRequests;
        expect(creationRequest).toBeInstanceOf(Request);

        expectTypeOf(creationRequest.body).toEqualTypeOf<null>();
        expect(creationRequest.body).toBe(null);

        expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
        expect(creationRequest.response.status).toEqual(201);

        expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
        expect(creationRequest.response.body).toEqual(users[1]);
      });
    });
  });

  describe('Clear', () => {
    it('should ignore all handlers after cleared when intercepting POST requests', async () => {
      await usingHttpInterceptor<{
        '/users': {
          POST: {
            response: {
              201: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const creationHandler = await promiseIfRemote(
          interceptor.post('/users').respond({
            status: 201,
            body: users[0],
          }),
          interceptor,
        );

        let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(0);

        const creationResponse = await fetch(joinURL(baseURL, '/users'), { method: 'POST' });
        expect(creationResponse.status).toBe(201);

        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);

        await promiseIfRemote(interceptor.clear(), interceptor);

        const creationPromise = fetch(joinURL(baseURL, '/users'), { method: 'POST' });
        await expectFetchError(creationPromise);

        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);
      });
    });

    it('should support creating new handlers after cleared', async () => {
      await usingHttpInterceptor<{
        '/users': {
          POST: {
            response: {
              201: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        let creationHandler = await promiseIfRemote(
          interceptor.post('/users').respond({
            status: 201,
            body: users[0],
          }),
          interceptor,
        );

        await promiseIfRemote(interceptor.clear(), interceptor);

        creationHandler = await promiseIfRemote(
          interceptor.post('/users').respond({
            status: 201,
            body: users[1],
          }),
          interceptor,
        );

        let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(0);

        const creationResponse = await fetch(joinURL(baseURL, '/users'), { method: 'POST' });
        expect(creationResponse.status).toBe(201);

        const createdUsers = (await creationResponse.json()) as User;
        expect(createdUsers).toEqual(users[1]);

        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);
        const [creationRequest] = creationRequests;
        expect(creationRequest).toBeInstanceOf(Request);

        expectTypeOf(creationRequest.body).toEqualTypeOf<null>();
        expect(creationRequest.body).toBe(null);

        expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
        expect(creationRequest.response.status).toEqual(201);

        expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
        expect(creationRequest.response.body).toEqual(users[1]);
      });
    });

    it('should support reusing current handlers after cleared', async () => {
      await usingHttpInterceptor<{
        '/users': {
          POST: {
            response: {
              201: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const creationHandler = await promiseIfRemote(
          interceptor.post('/users').respond({
            status: 201,
            body: users[0],
          }),
          interceptor,
        );

        await promiseIfRemote(interceptor.clear(), interceptor);

        await promiseIfRemote(
          creationHandler.respond({
            status: 201,
            body: users[1],
          }),
          interceptor,
        );

        let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(0);

        const creationResponse = await fetch(joinURL(baseURL, '/users'), { method: 'POST' });
        expect(creationResponse.status).toBe(201);

        const createdUsers = (await creationResponse.json()) as User;
        expect(createdUsers).toEqual(users[1]);

        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);
        const [creationRequest] = creationRequests;
        expect(creationRequest).toBeInstanceOf(Request);

        expectTypeOf(creationRequest.body).toEqualTypeOf<null>();
        expect(creationRequest.body).toBe(null);

        expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
        expect(creationRequest.response.status).toEqual(201);

        expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
        expect(creationRequest.response.body).toEqual(users[1]);
      });
    });
  });

  describe('Life cycle', () => {
    it('should ignore all handlers after restarted when intercepting POST requests', async () => {
      await usingHttpInterceptor<{
        '/users': {
          POST: {
            response: {
              201: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const creationHandler = await promiseIfRemote(
          interceptor.post('/users').respond({
            status: 201,
            body: users[0],
          }),
          interceptor,
        );

        let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(0);

        const creationResponse = await fetch(joinURL(baseURL, '/users'), { method: 'POST' });
        expect(creationResponse.status).toBe(201);

        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);

        expect(interceptor.isRunning()).toBe(true);
        await interceptor.stop();
        expect(interceptor.isRunning()).toBe(false);

        let creationPromise = fetchWithTimeout(joinURL(baseURL, '/users'), {
          method: 'POST',
          timeout: 200,
        });
        await expectFetchError(creationPromise, { canBeAborted: true });

        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);

        await interceptor.start();
        expect(interceptor.isRunning()).toBe(true);

        creationPromise = fetch(joinURL(baseURL, '/users'), { method: 'POST' });
        await expectFetchError(creationPromise);

        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);
      });
    });

    it('should ignore all handlers after restarted when intercepting POST requests, even if another interceptor is still running', async () => {
      await usingHttpInterceptor<{
        '/users': {
          POST: {
            response: {
              201: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const creationHandler = await promiseIfRemote(
          interceptor.post('/users').respond({
            status: 201,
            body: users[0],
          }),
          interceptor,
        );

        let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(0);

        const creationResponse = await fetch(joinURL(baseURL, '/users'), { method: 'POST' });
        expect(creationResponse.status).toBe(201);

        creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(1);

        await usingHttpInterceptor(interceptorOptions, async (otherInterceptor) => {
          expect(interceptor.isRunning()).toBe(true);
          expect(otherInterceptor.isRunning()).toBe(true);

          await interceptor.stop();
          expect(interceptor.isRunning()).toBe(false);
          expect(otherInterceptor.isRunning()).toBe(true);

          let creationPromise = fetchWithTimeout(joinURL(baseURL, '/users'), {
            method: 'POST',
            timeout: 200,
          });
          await expectFetchError(creationPromise, { canBeAborted: true });

          creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
          expect(creationRequests).toHaveLength(1);

          await interceptor.start();
          expect(interceptor.isRunning()).toBe(true);
          expect(otherInterceptor.isRunning()).toBe(true);

          creationPromise = fetch(joinURL(baseURL, '/users'), { method: 'POST' });
          await expectFetchError(creationPromise);

          creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
          expect(creationRequests).toHaveLength(1);
        });
      });
    });

    it('should throw an error when trying to create a POST request handler if not running', async () => {
      const interceptor = createInternalHttpInterceptor(interceptorOptions);
      expect(interceptor.isRunning()).toBe(false);

      await expect(async () => {
        await interceptor.post('/');
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
        it('should show a warning when logging is enabled and a POST request is unhandled and bypassed', async () => {
          await usingHttpInterceptor<{
            '/users': {
              POST: {
                request: {
                  headers: { 'x-value': string };
                  body: UserCreationBody;
                };
                response: {
                  201: { body: User };
                };
              };
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const creationHandler = await promiseIfRemote(
                interceptor
                  .post('/users')
                  .with({ headers: { 'x-value': '1' } })
                  .respond({
                    status: 201,
                    body: users[0],
                  }),
                interceptor,
              );

              let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
              expect(creationRequests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const creationResponse = await fetch(joinURL(baseURL, '/users'), {
                  method: 'POST',
                  headers: { 'content-type': 'application/json', 'x-value': '1' },
                  body: JSON.stringify(users[0] satisfies UserCreationBody),
                });
                expect(creationResponse.status).toBe(201);

                creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
                expect(creationRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const creationRequest = new Request(joinURL(baseURL, '/users'), {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(users[0] satisfies UserCreationBody),
                });
                const creationRequestClone = creationRequest.clone();
                const creationPromise = fetch(creationRequest);
                await expectFetchError(creationPromise);

                creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
                expect(creationRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(1);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const warnMessage = spies.warn.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(warnMessage, {
                  type: 'warn',
                  platform,
                  request: creationRequestClone,
                });
              });
            },
          );
        });
      }

      if (type === 'remote') {
        it('should show an error when logging is enabled and a POST request is unhandled and rejected', async () => {
          await usingHttpInterceptor<{
            '/users': {
              POST: {
                request: {
                  headers: { 'x-value': string };
                  body: UserCreationBody;
                };
                response: {
                  201: { body: User };
                };
              };
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const creationHandler = await promiseIfRemote(
                interceptor
                  .post('/users')
                  .with({ headers: { 'x-value': '1' } })
                  .respond({
                    status: 201,
                    body: users[0],
                  }),
                interceptor,
              );

              let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
              expect(creationRequests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const creationResponse = await fetch(joinURL(baseURL, '/users'), {
                  method: 'POST',
                  headers: { 'content-type': 'application/json', 'x-value': '1' },
                  body: JSON.stringify(users[0] satisfies UserCreationBody),
                });
                expect(creationResponse.status).toBe(201);

                creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
                expect(creationRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const creationRequest = new Request(joinURL(baseURL, '/users'), {
                  method: 'POST',
                  headers: { 'content-type': 'application/json', 'x-value': '2' },
                  body: JSON.stringify(users[0] satisfies UserCreationBody),
                });
                const creationRequestClone = creationRequest.clone();
                const creationPromise = fetch(creationRequest);
                await expectFetchError(creationPromise);

                creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
                expect(creationRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(1);

                const errorMessage = spies.error.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(errorMessage, {
                  type: 'error',
                  platform,
                  request: creationRequestClone,
                });
              });
            },
          );
        });
      }
    });

    it.each([{ overrideDefault: false }, { overrideDefault: 'static' }, { overrideDefault: 'function' }])(
      'should not show a warning or error when logging is disabled and a POST request is unhandled: override default $overrideDefault',
      async ({ overrideDefault }) => {
        if (overrideDefault === 'static') {
          http.default.onUnhandledRequest({ log: false });
        } else if (overrideDefault === 'function') {
          http.default.onUnhandledRequest(vi.fn());
        }

        await usingHttpInterceptor<{
          '/users': {
            POST: {
              request: {
                headers: { 'x-value': string };
                body: UserCreationBody;
              };
              response: {
                201: { body: User };
              };
            };
          };
        }>(
          {
            ...interceptorOptions,
            onUnhandledRequest: overrideDefault === false ? { log: false } : {},
          },
          async (interceptor) => {
            const creationHandler = await promiseIfRemote(
              interceptor
                .post('/users')
                .with({ headers: { 'x-value': '1' } })
                .respond({
                  status: 201,
                  body: users[0],
                }),
              interceptor,
            );

            let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
            expect(creationRequests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (spies) => {
              const creationResponse = await fetch(joinURL(baseURL, '/users'), {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-value': '1' },
                body: JSON.stringify(users[0] satisfies UserCreationBody),
              });
              expect(creationResponse.status).toBe(201);

              creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
              expect(creationRequests).toHaveLength(1);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);

              const creationRequest = new Request(joinURL(baseURL, '/users'), {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-value': '2' },
                body: JSON.stringify(users[0] satisfies UserCreationBody),
              });
              const creationPromise = fetch(creationRequest);
              await expectFetchError(creationPromise);

              creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
              expect(creationRequests).toHaveLength(1);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);
            });
          },
        );
      },
    );

    it('should support a custom unhandled POST request handler', async () => {
      const onUnhandledRequest = vi.fn(async (request: Request, context: UnhandledRequestStrategy.HandlerContext) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          await context.log();
        }
      });

      await usingHttpInterceptor<{
        '/users': {
          POST: {
            request: {
              headers: { 'x-value': string };
              searchParams: { name?: string };
              body: UserCreationBody;
            };
            response: {
              201: { body: User };
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const creationHandler = await promiseIfRemote(
          interceptor
            .post('/users')
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 201,
              body: users[0],
            }),
          interceptor,
        );

        let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const creationResponse = await fetch(joinURL(baseURL, '/users'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-value': '1' },
            body: JSON.stringify(users[0] satisfies UserCreationBody),
          });
          expect(creationResponse.status).toBe(201);

          creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
          expect(creationRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const searchParams = new HttpSearchParams({ name: 'User 1' });

          let creationPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-value': '2' },
            body: JSON.stringify(users[0] satisfies UserCreationBody),
          });
          await expectFetchError(creationPromise);

          creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
          expect(creationRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const creationRequest = new Request(joinURL(baseURL, '/users'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-value': '2' },
            body: JSON.stringify(users[0] satisfies UserCreationBody),
          });
          const creationRequestClone = creationRequest.clone();
          creationPromise = fetch(creationRequest);
          await expectFetchError(creationPromise);

          creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
          expect(creationRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

          const messageType = type === 'local' ? 'warn' : 'error';
          expect(spies.warn).toHaveBeenCalledTimes(messageType === 'warn' ? 1 : 0);
          expect(spies.error).toHaveBeenCalledTimes(messageType === 'error' ? 1 : 0);

          const errorMessage = spies[messageType].mock.calls[0].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, {
            type: messageType,
            platform,
            request: creationRequestClone,
          });
        });
      });
    });

    it('should log an error if a custom unhandled POST request handler throws', async () => {
      const error = new Error('Unhandled request.');

      const onUnhandledRequest = vi.fn((request: Request) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          throw error;
        }
      });

      await usingHttpInterceptor<{
        '/users': {
          POST: {
            request: {
              headers: { 'x-value': string };
              searchParams: { name?: string };
              body: UserCreationBody;
            };
            response: {
              201: { body: User };
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const creationHandler = await promiseIfRemote(
          interceptor
            .post('/users')
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 201,
              body: users[0],
            }),
          interceptor,
        );

        let creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
        expect(creationRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const creationResponse = await fetch(joinURL(baseURL, '/users'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-value': '1' },
            body: JSON.stringify(users[0] satisfies UserCreationBody),
          });
          expect(creationResponse.status).toBe(201);

          creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
          expect(creationRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const searchParams = new HttpSearchParams({ name: 'User 1' });

          let creationPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-value': '2' },
            body: JSON.stringify(users[0] satisfies UserCreationBody),
          });
          await expectFetchError(creationPromise);

          creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
          expect(creationRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const creationRequest = new Request(joinURL(baseURL, '/users'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-value': '2' },
            body: JSON.stringify(users[0] satisfies UserCreationBody),
          });
          creationPromise = fetch(creationRequest);
          await expectFetchError(creationPromise);

          creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
          expect(creationRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(1);

          expect(spies.error).toHaveBeenCalledWith(error);
        });
      });
    });
  });
}
