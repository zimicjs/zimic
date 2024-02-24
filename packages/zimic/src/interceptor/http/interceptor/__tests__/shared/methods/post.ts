import { afterAll, afterEach, beforeAll, expect, expectTypeOf, it } from 'vitest';

import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';
import HttpInterceptorWorker from '@/interceptor/http/interceptorWorker/HttpInterceptorWorker';
import HttpRequestTracker from '@/interceptor/http/requestTracker/HttpRequestTracker';
import HttpSearchParams from '@/interceptor/http/searchParams/HttpSearchParams';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorSchema } from '../../../types/schema';
import { SharedHttpInterceptorTestsOptions } from '../interceptorTests';

export function declarePostHttpInterceptorTests({ platform }: SharedHttpInterceptorTestsOptions) {
  const worker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  beforeAll(async () => {
    await worker.start();
  });

  afterEach(() => {
    expect(worker.interceptorsWithHandlers()).toHaveLength(0);
  });

  afterAll(async () => {
    await worker.stop();
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
    }>({ worker, baseURL }, async (interceptor) => {
      const creationTracker = interceptor.post('/users').respond({
        status: 201,
        body: users[0],
      });
      expect(creationTracker).toBeInstanceOf(HttpRequestTracker);

      const creationRequests = creationTracker.requests();
      expect(creationRequests).toHaveLength(0);

      const creationResponse = await fetch(`${baseURL}/users`, { method: 'POST' });
      expect(creationResponse.status).toBe(201);

      const createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual(users[0]);

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
          request: { body: User };
          response: {
            201: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const creationTracker = interceptor.post('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<User>();

        return {
          status: 201,
          body: {
            name: request.body.name,
          },
        };
      });
      expect(creationTracker).toBeInstanceOf(HttpRequestTracker);

      const creationRequests = creationTracker.requests();
      expect(creationRequests).toHaveLength(0);

      const userName = 'User (other)';

      const creationResponse = await fetch(`${baseURL}/users`, {
        method: 'POST',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      expect(creationResponse.status).toBe(201);

      const createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual<User>({ name: userName });

      expect(creationRequests).toHaveLength(1);
      const [creationRequest] = creationRequests;
      expect(creationRequest).toBeInstanceOf(Request);

      expectTypeOf(creationRequest.body).toEqualTypeOf<User>();
      expect(creationRequest.body).toEqual<User>({ name: userName });

      expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
      expect(creationRequest.response.status).toEqual(201);

      expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
      expect(creationRequest.response.body).toEqual<User>({ name: userName });
    });
  });

  it('should support intercepting POST requests having search params', async () => {
    type UserCreationSearchParams = HttpInterceptorSchema.RequestSearchParams<{
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
    }>({ worker, baseURL }, async (interceptor) => {
      const creationTracker = interceptor.post('/users').respond((request) => {
        expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserCreationSearchParams>>();

        return {
          status: 201,
          body: users[0],
        };
      });
      expect(creationTracker).toBeInstanceOf(HttpRequestTracker);

      const creationRequests = creationTracker.requests();
      expect(creationRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserCreationSearchParams>({
        tag: 'admin',
      });

      const creationResponse = await fetch(`${baseURL}/users?${searchParams.toString()}`, { method: 'POST' });
      expect(creationResponse.status).toBe(201);

      const createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual(users[0]);

      expect(creationRequests).toHaveLength(1);
      const [creationRequest] = creationRequests;
      expect(creationRequest).toBeInstanceOf(Request);

      expectTypeOf(creationRequest.searchParams).toEqualTypeOf<HttpSearchParams<UserCreationSearchParams>>();
      expect(creationRequest.searchParams).toEqual(searchParams);
      expect(creationRequest.searchParams.get('tag')).toBe('admin');
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
    }>({ worker, baseURL }, async (interceptor) => {
      const genericCreationTracker = interceptor.post('/users/:id').respond({
        status: 201,
        body: users[0],
      });
      expect(genericCreationTracker).toBeInstanceOf(HttpRequestTracker);

      const genericCreationRequests = genericCreationTracker.requests();
      expect(genericCreationRequests).toHaveLength(0);

      const genericCreationResponse = await fetch(`${baseURL}/users/${1}`, { method: 'POST' });
      expect(genericCreationResponse.status).toBe(201);

      const genericCreatedUser = (await genericCreationResponse.json()) as User;
      expect(genericCreatedUser).toEqual(users[0]);

      expect(genericCreationRequests).toHaveLength(1);
      const [genericCreationRequest] = genericCreationRequests;
      expect(genericCreationRequest).toBeInstanceOf(Request);

      expectTypeOf(genericCreationRequest.body).toEqualTypeOf<null>();
      expect(genericCreationRequest.body).toBe(null);

      expectTypeOf(genericCreationRequest.response.status).toEqualTypeOf<201>();
      expect(genericCreationRequest.response.status).toEqual(201);

      expectTypeOf(genericCreationRequest.response.body).toEqualTypeOf<User>();
      expect(genericCreationRequest.response.body).toEqual(users[0]);

      genericCreationTracker.bypass();

      const specificCreationTracker = interceptor.post<'/users/:id'>(`/users/${1}`).respond({
        status: 201,
        body: users[0],
      });
      expect(specificCreationTracker).toBeInstanceOf(HttpRequestTracker);

      const specificCreationRequests = specificCreationTracker.requests();
      expect(specificCreationRequests).toHaveLength(0);

      const specificCreationResponse = await fetch(`${baseURL}/users/${1}`, { method: 'POST' });
      expect(specificCreationResponse.status).toBe(201);

      const specificCreatedUser = (await specificCreationResponse.json()) as User;
      expect(specificCreatedUser).toEqual(users[0]);

      expect(specificCreationRequests).toHaveLength(1);
      const [specificCreationRequest] = specificCreationRequests;
      expect(specificCreationRequest).toBeInstanceOf(Request);

      expectTypeOf(specificCreationRequest.body).toEqualTypeOf<null>();
      expect(specificCreationRequest.body).toBe(null);

      expectTypeOf(specificCreationRequest.response.status).toEqualTypeOf<201>();
      expect(specificCreationRequest.response.status).toEqual(201);

      expectTypeOf(specificCreationRequest.response.body).toEqualTypeOf<User>();
      expect(specificCreationRequest.response.body).toEqual(users[0]);

      const unmatchedCreationPromise = fetch(`${baseURL}/users/${2}`, { method: 'POST' });
      await expect(unmatchedCreationPromise).rejects.toThrowError();
    });
  });

  it('should not intercept a POST request without a registered response', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: { body: User };
          response: {
            201: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const userName = 'User (other)';

      let creationPromise = fetch(`${baseURL}/users`, {
        method: 'POST',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      await expect(creationPromise).rejects.toThrowError();

      const creationTrackerWithoutResponse = interceptor.post('/users');
      expect(creationTrackerWithoutResponse).toBeInstanceOf(HttpRequestTracker);

      const creationRequestsWithoutResponse = creationTrackerWithoutResponse.requests();
      expect(creationRequestsWithoutResponse).toHaveLength(0);

      let [creationRequestWithoutResponse] = creationRequestsWithoutResponse;
      expectTypeOf<typeof creationRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof creationRequestWithoutResponse.response>().toEqualTypeOf<never>();

      creationPromise = fetch(`${baseURL}/users`, {
        method: 'POST',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      await expect(creationPromise).rejects.toThrowError();

      expect(creationRequestsWithoutResponse).toHaveLength(0);

      [creationRequestWithoutResponse] = creationRequestsWithoutResponse;
      expectTypeOf<typeof creationRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof creationRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const creationTrackerWithResponse = creationTrackerWithoutResponse.respond({
        status: 201,
        body: users[0],
      });

      const creationResponse = await fetch(`${baseURL}/users`, {
        method: 'POST',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      expect(creationResponse.status).toBe(201);

      const createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual(users[0]);

      expect(creationRequestsWithoutResponse).toHaveLength(0);
      const creationRequestsWithResponse = creationTrackerWithResponse.requests();
      expect(creationRequestsWithResponse).toHaveLength(1);

      const [creationRequest] = creationRequestsWithResponse;
      expect(creationRequest).toBeInstanceOf(Request);

      expectTypeOf(creationRequest.body).toEqualTypeOf<User>();
      expect(creationRequest.body).toEqual<User>({ name: userName });

      expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
      expect(creationRequest.response.status).toEqual(201);

      expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
      expect(creationRequest.response.body).toEqual<User>(users[0]);
    });
  });

  it('should consider only the last declared response when intercepting POST requests', async () => {
    interface ServerErrorResponseBody {
      message: string;
    }

    await usingHttpInterceptor<{
      '/users': {
        POST: {
          response: {
            201: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const creationTracker = interceptor
        .post('/users')
        .respond({
          status: 201,
          body: users[0],
        })
        .respond({
          status: 201,
          body: users[1],
        });

      creationTracker.respond({
        status: 201,
        body: users[1],
      });

      const creationRequests = creationTracker.requests();
      expect(creationRequests).toHaveLength(0);

      const creationResponse = await fetch(`${baseURL}/users`, { method: 'POST' });
      expect(creationResponse.status).toBe(201);

      const createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

      expect(creationRequests).toHaveLength(1);
      const [creationRequest] = creationRequests;
      expect(creationRequest).toBeInstanceOf(Request);

      expectTypeOf(creationRequest.body).toEqualTypeOf<null>();
      expect(creationRequest.body).toBe(null);

      expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
      expect(creationRequest.response.status).toEqual(201);

      expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
      expect(creationRequest.response.body).toEqual(users[1]);

      const errorCreationTracker = interceptor.post('/users').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const errorCreationRequests = errorCreationTracker.requests();
      expect(errorCreationRequests).toHaveLength(0);

      const otherCreationResponse = await fetch(`${baseURL}/users`, { method: 'POST' });
      expect(otherCreationResponse.status).toBe(500);

      const serverError = (await otherCreationResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      expect(creationRequests).toHaveLength(1);

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

  it('should ignore trackers with bypassed responses when intercepting POST requests', async () => {
    interface ServerErrorResponseBody {
      message: string;
    }

    await usingHttpInterceptor<{
      '/users': {
        POST: {
          response: {
            201: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const creationTracker = interceptor
        .post('/users')
        .respond({
          status: 201,
          body: users[0],
        })
        .bypass();

      const initialCreationRequests = creationTracker.requests();
      expect(initialCreationRequests).toHaveLength(0);

      const creationPromise = fetch(`${baseURL}/users`, { method: 'POST' });
      await expect(creationPromise).rejects.toThrowError();

      creationTracker.respond({
        status: 201,
        body: users[1],
      });

      expect(initialCreationRequests).toHaveLength(0);
      const creationRequests = creationTracker.requests();
      expect(creationRequests).toHaveLength(0);

      let creationResponse = await fetch(`${baseURL}/users`, { method: 'POST' });
      expect(creationResponse.status).toBe(201);

      let createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

      expect(creationRequests).toHaveLength(1);
      let [creationRequest] = creationRequests;
      expect(creationRequest).toBeInstanceOf(Request);

      expectTypeOf(creationRequest.body).toEqualTypeOf<null>();
      expect(creationRequest.body).toBe(null);

      expectTypeOf(creationRequest.response.status).toEqualTypeOf<201>();
      expect(creationRequest.response.status).toEqual(201);

      expectTypeOf(creationRequest.response.body).toEqualTypeOf<User>();
      expect(creationRequest.response.body).toEqual(users[1]);

      const errorCreationTracker = interceptor.post('/users').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const errorCreationRequests = errorCreationTracker.requests();
      expect(errorCreationRequests).toHaveLength(0);

      const otherCreationResponse = await fetch(`${baseURL}/users`, { method: 'POST' });
      expect(otherCreationResponse.status).toBe(500);

      const serverError = (await otherCreationResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      expect(creationRequests).toHaveLength(1);

      expect(errorCreationRequests).toHaveLength(1);
      const [errorCreationRequest] = errorCreationRequests;
      expect(errorCreationRequest).toBeInstanceOf(Request);

      expectTypeOf(errorCreationRequest.body).toEqualTypeOf<null>();
      expect(errorCreationRequest.body).toBe(null);

      expectTypeOf(errorCreationRequest.response.status).toEqualTypeOf<500>();
      expect(errorCreationRequest.response.status).toEqual(500);

      expectTypeOf(errorCreationRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorCreationRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      errorCreationTracker.bypass();

      creationResponse = await fetch(`${baseURL}/users`, { method: 'POST' });
      expect(creationResponse.status).toBe(201);

      createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

      expect(errorCreationRequests).toHaveLength(1);

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

  it('should ignore all trackers after cleared when intercepting POST requests', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          response: {
            201: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const creationTracker = interceptor.post('/users').respond({
        status: 201,
        body: users[0],
      });

      interceptor.clear();

      const initialCreationRequests = creationTracker.requests();
      expect(initialCreationRequests).toHaveLength(0);

      const creationPromise = fetch(`${baseURL}/users`, { method: 'POST' });
      await expect(creationPromise).rejects.toThrowError();
    });
  });

  it('should support creating new trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          response: {
            201: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      let creationTracker = interceptor.post('/users').respond({
        status: 201,
        body: users[0],
      });

      interceptor.clear();

      creationTracker = interceptor.post('/users').respond({
        status: 201,
        body: users[1],
      });

      const creationRequests = creationTracker.requests();
      expect(creationRequests).toHaveLength(0);

      const creationResponse = await fetch(`${baseURL}/users`, { method: 'POST' });
      expect(creationResponse.status).toBe(201);

      const createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

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

  it('should support reusing current trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          response: {
            201: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const creationTracker = interceptor.post('/users').respond({
        status: 201,
        body: users[0],
      });

      interceptor.clear();

      creationTracker.respond({
        status: 201,
        body: users[1],
      });

      const creationRequests = creationTracker.requests();
      expect(creationRequests).toHaveLength(0);

      const creationResponse = await fetch(`${baseURL}/users`, { method: 'POST' });
      expect(creationResponse.status).toBe(201);

      const createdUsers = (await creationResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

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
