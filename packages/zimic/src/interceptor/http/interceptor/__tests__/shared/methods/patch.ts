import { afterAll, afterEach, beforeAll, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';
import HttpInterceptorWorker from '@/interceptor/http/interceptorWorker/HttpInterceptorWorker';
import HttpRequestTracker from '@/interceptor/http/requestTracker/HttpRequestTracker';
import { JSONCompatible } from '@/types/json';
import { getCrypto } from '@tests/utils/crypto';
import { expectToThrowFetchError } from '@tests/utils/fetch';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorSchema } from '../../../types/schema';
import { SharedHttpInterceptorTestsOptions } from '../interceptorTests';

export async function declarePatchHttpInterceptorTests({ platform }: SharedHttpInterceptorTestsOptions) {
  const crypto = await getCrypto();

  const worker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
  const baseURL = 'http://localhost:3000';

  type User = JSONCompatible<{
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

  beforeAll(async () => {
    await worker.start();
  });

  afterEach(() => {
    expect(worker.interceptorsWithHandlers()).toHaveLength(0);
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should support intercepting PATCH requests with a static response body', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PATCH: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor.patch<'/users/:id'>(`/users/${users[0].id}`).respond({
        status: 200,
        body: users[0],
      });
      expect(updateTracker).toBeInstanceOf(HttpRequestTracker);

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH' });
      expect(updateResponse.status).toBe(200);

      const updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual(users[0]);

      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<null>();
      expect(updateRequest.body).toBe(null);

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual(users[0]);
    });
  });

  it('should support intercepting PATCH requests with a computed response body, based on the request body', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PATCH: {
          request: { body: Partial<User> };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor.patch<'/users/:id'>(`/users/${users[0].id}`).respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<Partial<User>>();

        const updatedUser: User = { ...users[0], ...request.body };

        return {
          status: 200,
          body: updatedUser,
        };
      });
      expect(updateTracker).toBeInstanceOf(HttpRequestTracker);

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const userName = 'User (other)';

      const updateResponse = await fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: userName } satisfies Partial<User>),
      });
      expect(updateResponse.status).toBe(200);

      const updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual<User>({ ...users[0], name: userName });

      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<Partial<User>>();
      expect(updateRequest.body).toEqual<Partial<User>>({ name: userName });

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual<User>({ ...users[0], name: userName });
    });
  });
  it('should support intercepting PATCH requests having headers', async () => {
    type UserUpdateRequestHeaders = HttpInterceptorSchema.Headers<{
      accept?: string;
    }>;
    type UserUpdateResponseHeaders = HttpInterceptorSchema.Headers<{
      'content-type'?: `application/${string}`;
      'cache-control'?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        PATCH: {
          request: {
            headers: UserUpdateRequestHeaders;
          };
          response: {
            200: {
              headers: UserUpdateResponseHeaders;
              body: User;
            };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor.patch<'/users/:id'>(`/users/${users[0].id}`).respond((request) => {
        expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserUpdateRequestHeaders>>();
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
      });
      expect(updateTracker).toBeInstanceOf(HttpRequestTracker);

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'PATCH',
        headers: {
          accept: 'application/json',
        } satisfies UserUpdateRequestHeaders,
      });
      expect(updateResponse.status).toBe(200);

      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.headers).toEqualTypeOf<HttpHeaders<UserUpdateRequestHeaders>>();
      expect(updateRequest.headers).toBeInstanceOf(HttpHeaders);
      expect(updateRequest.headers.get('accept')).toBe('application/json');

      expectTypeOf(updateRequest.response.headers).toEqualTypeOf<HttpHeaders<UserUpdateResponseHeaders>>();
      expect(updateRequest.response.headers).toBeInstanceOf(HttpHeaders);
      expect(updateRequest.response.headers.get('content-type')).toBe('application/json');
      expect(updateRequest.response.headers.get('cache-control')).toBe('no-cache');
    });
  });

  it('should support intercepting PATCH requests having search params', async () => {
    type UserUpdateSearchParams = HttpInterceptorSchema.SearchParams<{
      tag?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        PATCH: {
          request: {
            searchParams: UserUpdateSearchParams;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor.patch<'/users/:id'>(`/users/${users[0].id}`).respond((request) => {
        expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserUpdateSearchParams>>();
        expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

        return {
          status: 200,
          body: users[0],
        };
      });
      expect(updateTracker).toBeInstanceOf(HttpRequestTracker);

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserUpdateSearchParams>({
        tag: 'admin',
      });

      const updateResponse = await fetch(`${baseURL}/users/${users[0].id}?${searchParams.toString()}`, {
        method: 'PATCH',
      });
      expect(updateResponse.status).toBe(200);

      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.searchParams).toEqualTypeOf<HttpSearchParams<UserUpdateSearchParams>>();
      expect(updateRequest.searchParams).toBeInstanceOf(HttpSearchParams);
      expect(updateRequest.searchParams).toEqual(searchParams);
      expect(updateRequest.searchParams.get('tag')).toBe('admin');
    });
  });

  it('should support intercepting PATCH requests having headers restrictions', async () => {
    type UserUpdateHeaders = HttpInterceptorSchema.Headers<{
      'content-type'?: string;
      accept?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        PATCH: {
          request: {
            headers: UserUpdateHeaders;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor
        .patch<'/users/:id'>(`/users/${users[0].id}`)
        .with({
          headers: { 'content-type': 'application/json' },
        })
        .with((request) => {
          expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserUpdateHeaders>>();
          expect(request.headers).toBeInstanceOf(HttpHeaders);

          return request.headers.get('accept')?.includes('application/json') ?? false;
        })
        .respond((request) => {
          expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserUpdateHeaders>>();
          expect(request.headers).toBeInstanceOf(HttpHeaders);

          return {
            status: 200,
            body: users[0],
          };
        });
      expect(updateTracker).toBeInstanceOf(HttpRequestTracker);

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const headers = new HttpHeaders<UserUpdateHeaders>({
        'content-type': 'application/json',
        accept: 'application/json',
      });

      let updateResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH', headers });
      expect(updateResponse.status).toBe(200);
      expect(updateRequests).toHaveLength(1);

      headers.append('accept', 'application/xml');

      updateResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH', headers });
      expect(updateResponse.status).toBe(200);
      expect(updateRequests).toHaveLength(2);

      headers.delete('accept');

      let updateResponsePromise = fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH', headers });
      await expectToThrowFetchError(updateResponsePromise);
      expect(updateRequests).toHaveLength(2);

      headers.set('accept', 'application/json');
      headers.set('content-type', 'text/plain');

      updateResponsePromise = fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH', headers });
      await expectToThrowFetchError(updateResponsePromise);
      expect(updateRequests).toHaveLength(2);
    });
  });

  it('should support intercepting PATCH requests having search params restrictions', async () => {
    type UserUpdateSearchParams = HttpInterceptorSchema.SearchParams<{
      tag?: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        PATCH: {
          request: {
            searchParams: UserUpdateSearchParams;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor
        .patch<'/users/:id'>(`/users/${users[0].id}`)
        .with({
          searchParams: { tag: 'admin' },
        })
        .respond((request) => {
          expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserUpdateSearchParams>>();
          expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

          return {
            status: 200,
            body: users[0],
          };
        });
      expect(updateTracker).toBeInstanceOf(HttpRequestTracker);

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const searchParams = new HttpSearchParams<UserUpdateSearchParams>({
        tag: 'admin',
      });

      const updateResponse = await fetch(`${baseURL}/users/${users[0].id}?${searchParams.toString()}`, {
        method: 'PATCH',
      });
      expect(updateResponse.status).toBe(200);
      expect(updateRequests).toHaveLength(1);

      searchParams.delete('tag');

      const updateResponsePromise = fetch(`${baseURL}/users/${users[0].id}?${searchParams.toString()}`, {
        method: 'PATCH',
      });
      await expectToThrowFetchError(updateResponsePromise);
      expect(updateRequests).toHaveLength(1);
    });
  });

  it('should support intercepting PATCH requests having body restrictions', async () => {
    type UserUpdateBody = HttpInterceptorSchema.Body<Partial<User>>;

    await usingHttpInterceptor<{
      '/users/:id': {
        PATCH: {
          request: {
            body: UserUpdateBody;
          };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor
        .patch<'/users/:id'>(`/users/${users[0].id}`)
        .with({
          body: { name: users[0].name },
        })
        .respond((request) => {
          expectTypeOf(request.body).toEqualTypeOf<UserUpdateBody>();

          return {
            status: 200,
            body: users[0],
          };
        });
      expect(updateTracker).toBeInstanceOf(HttpRequestTracker);

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: users[0].name,
        } satisfies UserUpdateBody),
      });
      expect(updateResponse.status).toBe(200);
      expect(updateRequests).toHaveLength(1);

      let updateResponsePromise = fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: users[1].name,
        } satisfies UserUpdateBody),
      });
      await expectToThrowFetchError(updateResponsePromise);
      expect(updateRequests).toHaveLength(1);

      updateResponsePromise = fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({} satisfies UserUpdateBody),
      });
      await expectToThrowFetchError(updateResponsePromise);
      expect(updateRequests).toHaveLength(1);
    });
  });

  it('should support intercepting PATCH requests with a dynamic path', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PATCH: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const genericUpdateTracker = interceptor.patch('/users/:id').respond({
        status: 200,
        body: users[0],
      });
      expect(genericUpdateTracker).toBeInstanceOf(HttpRequestTracker);

      const genericUpdateRequests = genericUpdateTracker.requests();
      expect(genericUpdateRequests).toHaveLength(0);

      const genericUpdateResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH' });
      expect(genericUpdateResponse.status).toBe(200);

      const genericUpdatedUser = (await genericUpdateResponse.json()) as User;
      expect(genericUpdatedUser).toEqual(users[0]);

      expect(genericUpdateRequests).toHaveLength(1);
      const [genericUpdateRequest] = genericUpdateRequests;
      expect(genericUpdateRequest).toBeInstanceOf(Request);

      expectTypeOf(genericUpdateRequest.body).toEqualTypeOf<null>();
      expect(genericUpdateRequest.body).toBe(null);

      expectTypeOf(genericUpdateRequest.response.status).toEqualTypeOf<200>();
      expect(genericUpdateRequest.response.status).toEqual(200);

      expectTypeOf(genericUpdateRequest.response.body).toEqualTypeOf<User>();
      expect(genericUpdateRequest.response.body).toEqual(users[0]);

      genericUpdateTracker.bypass();

      const specificUpdateTracker = interceptor.patch<'/users/:id'>(`/users/${users[0].id}`).respond({
        status: 200,
        body: users[0],
      });
      expect(specificUpdateTracker).toBeInstanceOf(HttpRequestTracker);

      const specificUpdateRequests = specificUpdateTracker.requests();
      expect(specificUpdateRequests).toHaveLength(0);

      const specificUpdateResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH' });
      expect(specificUpdateResponse.status).toBe(200);

      const specificUpdatedUser = (await specificUpdateResponse.json()) as User;
      expect(specificUpdatedUser).toEqual(users[0]);

      expect(specificUpdateRequests).toHaveLength(1);
      const [specificUpdateRequest] = specificUpdateRequests;
      expect(specificUpdateRequest).toBeInstanceOf(Request);

      expectTypeOf(specificUpdateRequest.body).toEqualTypeOf<null>();
      expect(specificUpdateRequest.body).toBe(null);

      expectTypeOf(specificUpdateRequest.response.status).toEqualTypeOf<200>();
      expect(specificUpdateRequest.response.status).toEqual(200);

      expectTypeOf(specificUpdateRequest.response.body).toEqualTypeOf<User>();
      expect(specificUpdateRequest.response.body).toEqual(users[0]);

      const unmatchedUpdatePromise = fetch(`${baseURL}/users/:id/${2}`, { method: 'PATCH' });
      await expectToThrowFetchError(unmatchedUpdatePromise);
    });
  });

  it('should not intercept a PATCH request without a registered response', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PATCH: {
          request: { body: Partial<User> };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const userName = 'User (other)';

      let updatePromise = fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: userName } satisfies Partial<User>),
      });
      await expectToThrowFetchError(updatePromise);

      const updateTrackerWithoutResponse = interceptor.patch<'/users/:id'>(`/users/${users[0].id}`);
      expect(updateTrackerWithoutResponse).toBeInstanceOf(HttpRequestTracker);

      const updateRequestsWithoutResponse = updateTrackerWithoutResponse.requests();
      expect(updateRequestsWithoutResponse).toHaveLength(0);

      let [updateRequestWithoutResponse] = updateRequestsWithoutResponse;
      expectTypeOf<typeof updateRequestWithoutResponse.body>().toEqualTypeOf<Partial<User>>();
      expectTypeOf<typeof updateRequestWithoutResponse.response>().toEqualTypeOf<never>();

      updatePromise = fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: userName } satisfies Partial<User>),
      });
      await expectToThrowFetchError(updatePromise);

      expect(updateRequestsWithoutResponse).toHaveLength(0);

      [updateRequestWithoutResponse] = updateRequestsWithoutResponse;
      expectTypeOf<typeof updateRequestWithoutResponse.body>().toEqualTypeOf<Partial<User>>();
      expectTypeOf<typeof updateRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const updateTrackerWithResponse = updateTrackerWithoutResponse.respond({
        status: 200,
        body: users[0],
      });

      const updateResponse = await fetch(`${baseURL}/users/${users[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: userName } satisfies Partial<User>),
      });
      expect(updateResponse.status).toBe(200);

      const updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual(users[0]);

      expect(updateRequestsWithoutResponse).toHaveLength(0);
      const updateRequestsWithResponse = updateTrackerWithResponse.requests();
      expect(updateRequestsWithResponse).toHaveLength(1);

      const [updateRequest] = updateRequestsWithResponse;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<Partial<User>>();
      expect(updateRequest.body).toEqual<Partial<User>>({ name: userName });

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual<User>(users[0]);
    });
  });

  it('should consider only the last declared response when intercepting PATCH requests', async () => {
    type ServerErrorResponseBody = JSONCompatible<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        PATCH: {
          response: {
            200: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor
        .patch<'/users/:id'>(`/users/${users[0].id}`)
        .respond({
          status: 200,
          body: users[0],
        })
        .respond({
          status: 200,
          body: users[1],
        });

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH' });
      expect(updateResponse.status).toBe(200);

      const updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual(users[1]);

      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<null>();
      expect(updateRequest.body).toBe(null);

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual(users[1]);

      const errorUpdateTracker = interceptor.patch<'/users/:id'>(`/users/${users[0].id}`).respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const errorUpdateRequests = errorUpdateTracker.requests();
      expect(errorUpdateRequests).toHaveLength(0);

      const otherUpdateResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH' });
      expect(otherUpdateResponse.status).toBe(500);

      const serverError = (await otherUpdateResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      expect(updateRequests).toHaveLength(1);

      expect(errorUpdateRequests).toHaveLength(1);
      const [errorUpdateRequest] = errorUpdateRequests;
      expect(errorUpdateRequest).toBeInstanceOf(Request);

      expectTypeOf(errorUpdateRequest.body).toEqualTypeOf<null>();
      expect(errorUpdateRequest.body).toBe(null);

      expectTypeOf(errorUpdateRequest.response.status).toEqualTypeOf<500>();
      expect(errorUpdateRequest.response.status).toEqual(500);

      expectTypeOf(errorUpdateRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorUpdateRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });
    });
  });

  it('should ignore trackers with bypassed responses when intercepting PATCH requests', async () => {
    type ServerErrorResponseBody = JSONCompatible<{
      message: string;
    }>;

    await usingHttpInterceptor<{
      '/users/:id': {
        PATCH: {
          response: {
            200: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor
        .patch<'/users/:id'>(`/users/${users[0].id}`)
        .respond({
          status: 200,
          body: users[0],
        })
        .bypass();

      const initialUpdateRequests = updateTracker.requests();
      expect(initialUpdateRequests).toHaveLength(0);

      const updatePromise = fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH' });
      await expectToThrowFetchError(updatePromise);

      updateTracker.respond({
        status: 200,
        body: users[1],
      });

      expect(initialUpdateRequests).toHaveLength(0);
      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      let updateResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH' });
      expect(updateResponse.status).toBe(200);

      let updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual(users[1]);

      expect(updateRequests).toHaveLength(1);
      let [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<null>();
      expect(updateRequest.body).toBe(null);

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual(users[1]);

      const errorUpdateTracker = interceptor.patch<'/users/:id'>(`/users/${users[0].id}`).respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const errorUpdateRequests = errorUpdateTracker.requests();
      expect(errorUpdateRequests).toHaveLength(0);

      const otherUpdateResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH' });
      expect(otherUpdateResponse.status).toBe(500);

      const serverError = (await otherUpdateResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      expect(updateRequests).toHaveLength(1);

      expect(errorUpdateRequests).toHaveLength(1);
      const [errorUpdateRequest] = errorUpdateRequests;
      expect(errorUpdateRequest).toBeInstanceOf(Request);

      expectTypeOf(errorUpdateRequest.body).toEqualTypeOf<null>();
      expect(errorUpdateRequest.body).toBe(null);

      expectTypeOf(errorUpdateRequest.response.status).toEqualTypeOf<500>();
      expect(errorUpdateRequest.response.status).toEqual(500);

      expectTypeOf(errorUpdateRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorUpdateRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      errorUpdateTracker.bypass();

      updateResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH' });
      expect(updateResponse.status).toBe(200);

      updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual(users[1]);

      expect(errorUpdateRequests).toHaveLength(1);

      expect(updateRequests).toHaveLength(2);
      [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<null>();
      expect(updateRequest.body).toBe(null);

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual(users[1]);
    });
  });

  it('should ignore all trackers after cleared when intercepting PATCH requests', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PATCH: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor.patch<'/users/:id'>(`/users/${users[0].id}`).respond({
        status: 200,
        body: users[0],
      });

      interceptor.clear();

      const initialUpdateRequests = updateTracker.requests();
      expect(initialUpdateRequests).toHaveLength(0);

      const updatePromise = fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH' });
      await expectToThrowFetchError(updatePromise);
    });
  });

  it('should support creating new trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PATCH: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      let updateTracker = interceptor.patch<'/users/:id'>(`/users/${users[0].id}`).respond({
        status: 200,
        body: users[0],
      });

      interceptor.clear();

      updateTracker = interceptor.patch<'/users/:id'>(`/users/${users[0].id}`).respond({
        status: 200,
        body: users[1],
      });

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH' });
      expect(updateResponse.status).toBe(200);

      const updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual(users[1]);

      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<null>();
      expect(updateRequest.body).toBe(null);

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual(users[1]);
    });
  });

  it('should support reusing current trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users/:id': {
        PATCH: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor.patch<'/users/:id'>(`/users/${users[0].id}`).respond({
        status: 200,
        body: users[0],
      });

      interceptor.clear();

      updateTracker.respond({
        status: 200,
        body: users[1],
      });

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(`${baseURL}/users/${users[0].id}`, { method: 'PATCH' });
      expect(updateResponse.status).toBe(200);

      const updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual(users[1]);

      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<null>();
      expect(updateRequest.body).toBe(null);

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual(users[1]);
    });
  });
}
