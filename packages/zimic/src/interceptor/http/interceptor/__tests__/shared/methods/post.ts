import { beforeEach, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { JSONValue } from '@/types/json';
import { getCrypto } from '@/utils/crypto';
import { fetchWithTimeout, joinURL } from '@/utils/fetch';
import { expectFetchError } from '@tests/utils/fetch';
import { createInternalHttpInterceptor, usingHttpInterceptor } from '@tests/utils/interceptors';

import NotStartedHttpInterceptorError from '../../../errors/NotStartedHttpInterceptorError';
import { HttpInterceptorOptions } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../types';

export async function declarePostHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  const crypto = await getCrypto();

  type User = JSONValue<{
    id: string;
    name: string;
  }>;

  type UserCreationBody = Omit<User, 'id'>;

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

  it('should support intercepting POST requests with a static response body', async () => {
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

  it('should support intercepting POST requests with a computed response body, based on the request body', async () => {
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
      'content-type'?: `application/${string}`;
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
              'content-type': 'application/json',
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
      expect(creationRequest.response.headers.get('content-type')).toBe('application/json');
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

  it('should support intercepting POST requests having headers restrictions', async () => {
    type UserCreationHeaders = HttpSchema.Headers<{
      'content-type'?: string;
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
            headers: { 'content-type': 'application/json' },
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
        'content-type': 'application/json',
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

      let creationResponsePromise = fetch(joinURL(baseURL, '/users'), { method: 'POST', headers });
      await expectFetchError(creationResponsePromise);
      creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
      expect(creationRequests).toHaveLength(2);

      headers.set('accept', 'application/json');
      headers.set('content-type', 'text/plain');

      creationResponsePromise = fetch(joinURL(baseURL, '/users'), { method: 'POST', headers });
      await expectFetchError(creationResponsePromise);
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

      const creationResponsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'POST' });
      await expectFetchError(creationResponsePromise);
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
        body: JSON.stringify(users[0] satisfies UserCreationBody),
      });
      expect(creationResponse.status).toBe(200);

      creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
      expect(creationRequests).toHaveLength(1);

      const creationResponsePromise = fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        body: JSON.stringify(users[1] satisfies UserCreationBody),
      });
      await expectFetchError(creationResponsePromise);

      creationRequests = await promiseIfRemote(creationHandler.requests(), interceptor);
      expect(creationRequests).toHaveLength(1);
    });
  });

  it('should support intercepting POST requests with a dynamic path', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        POST: {
          response: {
            201: { body: User };
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const genericCreationHandler = await promiseIfRemote(
        interceptor.post('/users/:id').respond({
          status: 201,
          body: users[0],
        }),
        interceptor,
      );
      expect(genericCreationHandler).toBeInstanceOf(Handler);

      let genericCreationRequests = await promiseIfRemote(genericCreationHandler.requests(), interceptor);
      expect(genericCreationRequests).toHaveLength(0);

      const genericCreationResponse = await fetch(joinURL(baseURL, `/users/${1}`), { method: 'POST' });
      expect(genericCreationResponse.status).toBe(201);

      const genericCreatedUser = (await genericCreationResponse.json()) as User;
      expect(genericCreatedUser).toEqual(users[0]);

      genericCreationRequests = await promiseIfRemote(genericCreationHandler.requests(), interceptor);
      expect(genericCreationRequests).toHaveLength(1);
      const [genericCreationRequest] = genericCreationRequests;
      expect(genericCreationRequest).toBeInstanceOf(Request);

      expectTypeOf(genericCreationRequest.body).toEqualTypeOf<null>();
      expect(genericCreationRequest.body).toBe(null);

      expectTypeOf(genericCreationRequest.response.status).toEqualTypeOf<201>();
      expect(genericCreationRequest.response.status).toEqual(201);

      expectTypeOf(genericCreationRequest.response.body).toEqualTypeOf<User>();
      expect(genericCreationRequest.response.body).toEqual(users[0]);

      await promiseIfRemote(genericCreationHandler.bypass(), interceptor);

      const specificCreationHandler = await promiseIfRemote(
        interceptor.post(`/users/${1}`).respond({
          status: 201,
          body: users[0],
        }),
        interceptor,
      );
      expect(specificCreationHandler).toBeInstanceOf(Handler);

      let specificCreationRequests = await promiseIfRemote(specificCreationHandler.requests(), interceptor);
      expect(specificCreationRequests).toHaveLength(0);

      const specificCreationResponse = await fetch(joinURL(baseURL, `/users/${1}`), { method: 'POST' });
      expect(specificCreationResponse.status).toBe(201);

      const specificCreatedUser = (await specificCreationResponse.json()) as User;
      expect(specificCreatedUser).toEqual(users[0]);

      specificCreationRequests = await promiseIfRemote(specificCreationHandler.requests(), interceptor);
      expect(specificCreationRequests).toHaveLength(1);
      const [specificCreationRequest] = specificCreationRequests;
      expect(specificCreationRequest).toBeInstanceOf(Request);

      expectTypeOf(specificCreationRequest.body).toEqualTypeOf<null>();
      expect(specificCreationRequest.body).toBe(null);

      expectTypeOf(specificCreationRequest.response.status).toEqualTypeOf<201>();
      expect(specificCreationRequest.response.status).toEqual(201);

      expectTypeOf(specificCreationRequest.response.body).toEqualTypeOf<User>();
      expect(specificCreationRequest.response.body).toEqual(users[0]);

      const unmatchedCreationPromise = fetch(joinURL(baseURL, `/users/${2}`), { method: 'POST' });
      await expectFetchError(unmatchedCreationPromise);
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
      expect(errorCreationRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

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
}
