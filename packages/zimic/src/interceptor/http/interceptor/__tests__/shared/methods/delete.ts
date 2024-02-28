import { afterAll, afterEach, beforeAll, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';
import HttpInterceptorWorker from '@/interceptor/http/interceptorWorker/HttpInterceptorWorker';
import HttpRequestTracker from '@/interceptor/http/requestTracker/HttpRequestTracker';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorSchema } from '../../../types/schema';
import { SharedHttpInterceptorTestsOptions } from '../interceptorTests';

export function declareDeleteHttpInterceptorTests({ platform }: SharedHttpInterceptorTestsOptions) {
  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  const worker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
  const baseURL = 'http://localhost:3000';

  beforeAll(async () => {
    await worker.start();
  });

  afterEach(() => {
    expect(worker.interceptorsWithHandlers()).toHaveLength(0);
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should support intercepting DELETE requests with a static response body', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const deletionTracker = interceptor.delete('/users/:id').respond({
        status: 200,
        body: users[0],
      });
      expect(deletionTracker).toBeInstanceOf(HttpRequestTracker);

      const deletionRequests = deletionTracker.requests();
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(`${baseURL}/users/${1}`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      const deletedUsers = (await deletionResponse.json()) as User;
      expect(deletedUsers).toEqual(users[0]);

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

  it('should support intercepting DELETE requests with a computed response body, based on the request body', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          request: { body: User };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const deletionTracker = interceptor.delete('/users/:id').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<User>();

        return {
          status: 200,
          body: {
            name: request.body.name,
          },
        };
      });

      const deletionRequests = deletionTracker.requests();
      expect(deletionRequests).toHaveLength(0);

      const userName = 'User (other)';

      const deletionResponse = await fetch(`${baseURL}/users/${1}`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      expect(deletionResponse.status).toBe(200);

      const deletedUsers = (await deletionResponse.json()) as User;
      expect(deletedUsers).toEqual<User>({ name: userName });

      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<User>();
      expect(deletionRequest.body).toEqual<User>({ name: userName });

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual<User>({ name: userName });
    });
  });

  it('should support intercepting DELETE requests having search params', async () => {
    type UserDeletionSearchParams = HttpInterceptorSchema.SearchParams<{
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
    }>({ worker, baseURL }, async (interceptor) => {
      const deletionTracker = interceptor.delete(`/users/:id`).respond((request) => {
        expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserDeletionSearchParams>>();
        expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

        return {
          status: 200,
          body: users[0],
        };
      });
      expect(deletionTracker).toBeInstanceOf(HttpRequestTracker);

      const deletionRequests = deletionTracker.requests();
      expect(deletionRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserDeletionSearchParams>({
        tag: 'admin',
      });

      const deletionResponse = await fetch(`${baseURL}/users/${1}?${searchParams.toString()}`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.searchParams).toEqualTypeOf<HttpSearchParams<UserDeletionSearchParams>>();
      expect(deletionRequest.searchParams).toBeInstanceOf(HttpSearchParams);
      expect(deletionRequest.searchParams).toEqual(searchParams);
      expect(deletionRequest.searchParams.get('tag')).toBe('admin');
    });
  });

  it('should support intercepting DELETE requests having headers', async () => {
    type UserDeletionRequestHeaders = HttpInterceptorSchema.Headers<{
      'Keep-Alive'?: string;
      Authorization?: `Bearer ${string}`;
    }>;
    type UserDeletionResponseHeaders = HttpInterceptorSchema.Headers<{
      'Keep-Alive'?: string;
      Authorization?: `Bearer ${string}-response`;
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
    }>({ worker, baseURL }, async (interceptor) => {
      const deletionTracker = interceptor.delete(`/users/:id`).respond((request) => {
        expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserDeletionRequestHeaders>>();
        expect(request.headers).toBeInstanceOf(HttpHeaders);

        const authorizationHeader = request.headers.get('Authorization')!;
        expect(authorizationHeader).not.toBe(null);

        return {
          status: 200,
          headers: {
            Authorization: `${authorizationHeader}-response`,
          },
          body: users[0],
        };
      });
      expect(deletionTracker).toBeInstanceOf(HttpRequestTracker);

      const deletionRequests = deletionTracker.requests();
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(`${baseURL}/users/${1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer token',
        } satisfies UserDeletionRequestHeaders,
      });
      expect(deletionResponse.status).toBe(200);

      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.headers).toEqualTypeOf<HttpHeaders<UserDeletionRequestHeaders>>();
      expect(deletionRequest.headers).toBeInstanceOf(HttpHeaders);
      expect(deletionRequest.headers.get('Authorization')).toBe('Bearer token');
      expect(deletionRequest.headers.get('Keep-Alive')).toBe(null);

      expectTypeOf(deletionRequest.response.headers).toEqualTypeOf<HttpHeaders<UserDeletionResponseHeaders>>();
      expect(deletionRequest.response.headers).toBeInstanceOf(HttpHeaders);
      expect(deletionRequest.response.headers.get('Authorization')).toBe('Bearer token-response');
    });
  });

  it('should support intercepting DELETE requests with a dynamic path', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const genericDeletionTracker = interceptor.delete('/users/:id').respond({
        status: 200,
        body: users[0],
      });
      expect(genericDeletionTracker).toBeInstanceOf(HttpRequestTracker);

      const genericDeletionRequests = genericDeletionTracker.requests();
      expect(genericDeletionRequests).toHaveLength(0);

      const genericDeletionResponse = await fetch(`${baseURL}/users/${1}`, { method: 'DELETE' });
      expect(genericDeletionResponse.status).toBe(200);

      const genericDeletedUser = (await genericDeletionResponse.json()) as User;
      expect(genericDeletedUser).toEqual(users[0]);

      expect(genericDeletionRequests).toHaveLength(1);
      const [genericDeletionRequest] = genericDeletionRequests;
      expect(genericDeletionRequest).toBeInstanceOf(Request);

      expectTypeOf(genericDeletionRequest.body).toEqualTypeOf<null>();
      expect(genericDeletionRequest.body).toBe(null);

      expectTypeOf(genericDeletionRequest.response.status).toEqualTypeOf<200>();
      expect(genericDeletionRequest.response.status).toEqual(200);

      expectTypeOf(genericDeletionRequest.response.body).toEqualTypeOf<User>();
      expect(genericDeletionRequest.response.body).toEqual(users[0]);

      genericDeletionTracker.bypass();

      const specificDeletionTracker = interceptor.delete<'/users/:id'>(`/users/${1}`).respond({
        status: 200,
        body: users[0],
      });
      expect(specificDeletionTracker).toBeInstanceOf(HttpRequestTracker);

      const specificDeletionRequests = specificDeletionTracker.requests();
      expect(specificDeletionRequests).toHaveLength(0);

      const specificDeletionResponse = await fetch(`${baseURL}/users/${1}`, { method: 'DELETE' });
      expect(specificDeletionResponse.status).toBe(200);

      const specificDeletedUser = (await specificDeletionResponse.json()) as User;
      expect(specificDeletedUser).toEqual(users[0]);

      expect(specificDeletionRequests).toHaveLength(1);
      const [specificDeletionRequest] = specificDeletionRequests;
      expect(specificDeletionRequest).toBeInstanceOf(Request);

      expectTypeOf(specificDeletionRequest.body).toEqualTypeOf<null>();
      expect(specificDeletionRequest.body).toBe(null);

      expectTypeOf(specificDeletionRequest.response.status).toEqualTypeOf<200>();
      expect(specificDeletionRequest.response.status).toEqual(200);

      expectTypeOf(specificDeletionRequest.response.body).toEqualTypeOf<User>();
      expect(specificDeletionRequest.response.body).toEqual(users[0]);

      const unmatchedDeletionPromise = fetch(`${baseURL}/users/${2}`, { method: 'DELETE' });
      await expect(unmatchedDeletionPromise).rejects.toThrowError();
    });
  });

  it('should not intercept a DELETE request without a registered response', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          request: { body: User };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const userName = 'User (other)';

      let deletionPromise = fetch(`${baseURL}/users/${1}`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      await expect(deletionPromise).rejects.toThrowError();

      const deletionTrackerWithoutResponse = interceptor.delete(`/users/:id`);
      expect(deletionTrackerWithoutResponse).toBeInstanceOf(HttpRequestTracker);

      const deletionRequestsWithoutResponse = deletionTrackerWithoutResponse.requests();
      expect(deletionRequestsWithoutResponse).toHaveLength(0);

      let [deletionRequestWithoutResponse] = deletionRequestsWithoutResponse;
      expectTypeOf<typeof deletionRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof deletionRequestWithoutResponse.response>().toEqualTypeOf<never>();

      deletionPromise = fetch(`${baseURL}/users/${1}`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      await expect(deletionPromise).rejects.toThrowError();

      expect(deletionRequestsWithoutResponse).toHaveLength(0);

      [deletionRequestWithoutResponse] = deletionRequestsWithoutResponse;
      expectTypeOf<typeof deletionRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof deletionRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const deletionTrackerWithResponse = deletionTrackerWithoutResponse.respond({
        status: 200,
        body: users[0],
      });

      const deletionResponse = await fetch(`${baseURL}/users/${1}`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      expect(deletionResponse.status).toBe(200);

      const deletedUsers = (await deletionResponse.json()) as User;
      expect(deletedUsers).toEqual(users[0]);

      expect(deletionRequestsWithoutResponse).toHaveLength(0);
      const deletionRequestsWithResponse = deletionTrackerWithResponse.requests();
      expect(deletionRequestsWithResponse).toHaveLength(1);

      const [deletionRequest] = deletionRequestsWithResponse;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<User>();
      expect(deletionRequest.body).toEqual<User>({ name: userName });

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual<User>(users[0]);
    });
  });

  it('should consider only the last declared response when intercepting DELETE requests', async () => {
    interface ServerErrorResponseBody {
      message: string;
    }

    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const deletionTracker = interceptor
        .delete('/users/:id')
        .respond({
          status: 200,
          body: users[0],
        })
        .respond({
          status: 200,
          body: users[1],
        });

      const deletionRequests = deletionTracker.requests();
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(`${baseURL}/users/${1}`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      const deletionUsers = (await deletionResponse.json()) as User;
      expect(deletionUsers).toEqual(users[1]);

      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<null>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[1]);

      const errorDeletionTracker = interceptor.delete('/users/:id').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const errorDeletionRequests = errorDeletionTracker.requests();
      expect(errorDeletionRequests).toHaveLength(0);

      const otherDeletionResponse = await fetch(`${baseURL}/users/${1}`, { method: 'DELETE' });
      expect(otherDeletionResponse.status).toBe(500);

      const serverError = (await otherDeletionResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      expect(deletionRequests).toHaveLength(1);

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

  it('should ignore trackers with bypassed responses when intercepting DELETE requests', async () => {
    interface ServerErrorResponseBody {
      message: string;
    }

    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const deletionTracker = interceptor
        .delete('/users/:id')
        .respond({
          status: 200,
          body: users[0],
        })
        .bypass();

      const initialDeletionRequests = deletionTracker.requests();
      expect(initialDeletionRequests).toHaveLength(0);

      const deletionPromise = fetch(`${baseURL}/users/${1}`, { method: 'DELETE' });
      await expect(deletionPromise).rejects.toThrowError();

      deletionTracker.respond({
        status: 200,
        body: users[1],
      });

      expect(initialDeletionRequests).toHaveLength(0);
      const deletionRequests = deletionTracker.requests();
      expect(deletionRequests).toHaveLength(0);

      let deletionResponse = await fetch(`${baseURL}/users/${1}`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      let createdUsers = (await deletionResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

      expect(deletionRequests).toHaveLength(1);
      let [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<null>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[1]);

      const errorDeletionTracker = interceptor.delete('/users/:id').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const errorDeletionRequests = errorDeletionTracker.requests();
      expect(errorDeletionRequests).toHaveLength(0);

      const otherDeletionResponse = await fetch(`${baseURL}/users/${1}`, { method: 'DELETE' });
      expect(otherDeletionResponse.status).toBe(500);

      const serverError = (await otherDeletionResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      expect(deletionRequests).toHaveLength(1);

      expect(errorDeletionRequests).toHaveLength(1);
      const [errorDeletionRequest] = errorDeletionRequests;
      expect(errorDeletionRequest).toBeInstanceOf(Request);

      expectTypeOf(errorDeletionRequest.body).toEqualTypeOf<null>();
      expect(errorDeletionRequest.body).toBe(null);

      expectTypeOf(errorDeletionRequest.response.status).toEqualTypeOf<500>();
      expect(errorDeletionRequest.response.status).toEqual(500);

      expectTypeOf(errorDeletionRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorDeletionRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      errorDeletionTracker.bypass();

      deletionResponse = await fetch(`${baseURL}/users/${1}`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      createdUsers = (await deletionResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

      expect(errorDeletionRequests).toHaveLength(1);

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

  it('should ignore all trackers after cleared when intercepting DELETE requests', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const deletionTracker = interceptor.delete('/users/:id').respond({
        status: 200,
        body: users[0],
      });

      interceptor.clear();

      const initialDeletionRequests = deletionTracker.requests();
      expect(initialDeletionRequests).toHaveLength(0);

      const deletionPromise = fetch(`${baseURL}/users/${1}`, { method: 'DELETE' });
      await expect(deletionPromise).rejects.toThrowError();
    });
  });

  it('should support creating new trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      let deletionTracker = interceptor.delete('/users/:id').respond({
        status: 200,
        body: users[0],
      });

      interceptor.clear();

      deletionTracker = interceptor.delete('/users/:id').respond({
        status: 200,
        body: users[1],
      });

      const deletionRequests = deletionTracker.requests();
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(`${baseURL}/users/${1}`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      const createdUsers = (await deletionResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

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

  it('should support reusing previous trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const deletionTracker = interceptor.delete('/users/:id').respond({
        status: 200,
        body: users[0],
      });

      interceptor.clear();

      deletionTracker.respond({
        status: 200,
        body: users[1],
      });

      const deletionRequests = deletionTracker.requests();
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(`${baseURL}/users/${1}`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      const createdUsers = (await deletionResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

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
}
