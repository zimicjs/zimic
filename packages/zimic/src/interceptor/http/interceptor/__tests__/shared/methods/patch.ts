import { afterAll, afterEach, beforeAll, expect, expectTypeOf, it } from 'vitest';

import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';
import InternalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/InternalHttpInterceptorWorker';
import InternalHttpRequestTracker from '@/interceptor/http/requestTracker/InternalHttpRequestTracker';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { SharedHttpInterceptorTestsOptions } from '../interceptorTests';

export function declarePatchHttpInterceptorTests({ platform }: SharedHttpInterceptorTestsOptions) {
  const worker = createHttpInterceptorWorker({ platform }) as InternalHttpInterceptorWorker;
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

  it('should support intercepting PATCH requests with a static response body', async () => {
    await usingHttpInterceptor<{
      '/users': {
        PATCH: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor.patch('/users').respond({
        status: 200,
        body: users[0],
      });
      expect(updateTracker).toBeInstanceOf(InternalHttpRequestTracker);

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(`${baseURL}/users`, { method: 'PATCH' });
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
      '/users': {
        PATCH: {
          request: { body: User };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor.patch('/users').respond((request) => {
        expectTypeOf(request.body).toEqualTypeOf<User>();

        return {
          status: 200,
          body: {
            name: request.body.name,
          },
        };
      });
      expect(updateTracker).toBeInstanceOf(InternalHttpRequestTracker);

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const userName = 'User (other)';

      const updateResponse = await fetch(`${baseURL}/users`, {
        method: 'PATCH',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      expect(updateResponse.status).toBe(200);

      const updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual<User>({ name: userName });

      expect(updateRequests).toHaveLength(1);
      const [updateRequest] = updateRequests;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<User>();
      expect(updateRequest.body).toEqual<User>({ name: userName });

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual<User>({ name: userName });
    });
  });

  it('should support intercepting PATCH requests with a dynamic route', async () => {
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
      expect(genericUpdateTracker).toBeInstanceOf(InternalHttpRequestTracker);

      const genericUpdateRequests = genericUpdateTracker.requests();
      expect(genericUpdateRequests).toHaveLength(0);

      const genericUpdateResponse = await fetch(`${baseURL}/users/${1}`, { method: 'PATCH' });
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

      const specificUpdateTracker = interceptor.patch<'/users/:id'>(`/users/${1}`).respond({
        status: 200,
        body: users[0],
      });
      expect(specificUpdateTracker).toBeInstanceOf(InternalHttpRequestTracker);

      const specificUpdateRequests = specificUpdateTracker.requests();
      expect(specificUpdateRequests).toHaveLength(0);

      const specificUpdateResponse = await fetch(`${baseURL}/users/${1}`, { method: 'PATCH' });
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

      const unmatchedUpdatePromise = fetch(`${baseURL}/users/${2}`, { method: 'PATCH' });
      await expect(unmatchedUpdatePromise).rejects.toThrowError();
    });
  });

  it('should not intercept a PATCH request without a registered response', async () => {
    await usingHttpInterceptor<{
      '/users': {
        PATCH: {
          request: { body: User };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const userName = 'User (other)';

      let updatePromise = fetch(`${baseURL}/users`, {
        method: 'PATCH',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      await expect(updatePromise).rejects.toThrowError();

      const updateTrackerWithoutResponse = interceptor.patch('/users');
      expect(updateTrackerWithoutResponse).toBeInstanceOf(InternalHttpRequestTracker);

      const updateRequestsWithoutResponse = updateTrackerWithoutResponse.requests();
      expect(updateRequestsWithoutResponse).toHaveLength(0);

      let [updateRequestWithoutResponse] = updateRequestsWithoutResponse;
      expectTypeOf<typeof updateRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof updateRequestWithoutResponse.response>().toEqualTypeOf<never>();

      updatePromise = fetch(`${baseURL}/users`, {
        method: 'PATCH',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      await expect(updatePromise).rejects.toThrowError();

      expect(updateRequestsWithoutResponse).toHaveLength(0);

      [updateRequestWithoutResponse] = updateRequestsWithoutResponse;
      expectTypeOf<typeof updateRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof updateRequestWithoutResponse.response>().toEqualTypeOf<never>();

      const updateTrackerWithResponse = updateTrackerWithoutResponse.respond({
        status: 200,
        body: users[0],
      });

      const updateResponse = await fetch(`${baseURL}/users`, {
        method: 'PATCH',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      expect(updateResponse.status).toBe(200);

      const updatedUsers = (await updateResponse.json()) as User;
      expect(updatedUsers).toEqual(users[0]);

      expect(updateRequestsWithoutResponse).toHaveLength(0);
      const updateRequestsWithResponse = updateTrackerWithResponse.requests();
      expect(updateRequestsWithResponse).toHaveLength(1);

      const [updateRequest] = updateRequestsWithResponse;
      expect(updateRequest).toBeInstanceOf(Request);

      expectTypeOf(updateRequest.body).toEqualTypeOf<User>();
      expect(updateRequest.body).toEqual<User>({ name: userName });

      expectTypeOf(updateRequest.response.status).toEqualTypeOf<200>();
      expect(updateRequest.response.status).toEqual(200);

      expectTypeOf(updateRequest.response.body).toEqualTypeOf<User>();
      expect(updateRequest.response.body).toEqual<User>(users[0]);
    });
  });

  it('should consider only the last declared response when intercepting PATCH requests', async () => {
    interface ServerErrorResponseBody {
      message: string;
    }

    await usingHttpInterceptor<{
      '/users': {
        PATCH: {
          response: {
            200: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor
        .patch('/users')
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

      const updateResponse = await fetch(`${baseURL}/users`, { method: 'PATCH' });
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

      const errorUpdateTracker = interceptor.patch('/users').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const errorUpdateRequests = errorUpdateTracker.requests();
      expect(errorUpdateRequests).toHaveLength(0);

      const otherUpdateResponse = await fetch(`${baseURL}/users`, { method: 'PATCH' });
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
    interface ServerErrorResponseBody {
      message: string;
    }

    await usingHttpInterceptor<{
      '/users': {
        PATCH: {
          response: {
            200: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor
        .patch('/users')
        .respond({
          status: 200,
          body: users[0],
        })
        .bypass();

      const initialUpdateRequests = updateTracker.requests();
      expect(initialUpdateRequests).toHaveLength(0);

      const updatePromise = fetch(`${baseURL}/users`, { method: 'PATCH' });
      await expect(updatePromise).rejects.toThrowError();

      updateTracker.respond({
        status: 200,
        body: users[1],
      });

      expect(initialUpdateRequests).toHaveLength(0);
      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      let updateResponse = await fetch(`${baseURL}/users`, { method: 'PATCH' });
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

      const errorUpdateTracker = interceptor.patch('/users').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const errorUpdateRequests = errorUpdateTracker.requests();
      expect(errorUpdateRequests).toHaveLength(0);

      const otherUpdateResponse = await fetch(`${baseURL}/users`, { method: 'PATCH' });
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

      updateResponse = await fetch(`${baseURL}/users`, { method: 'PATCH' });
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
      '/users': {
        PATCH: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor.patch('/users').respond({
        status: 200,
        body: users[0],
      });

      interceptor.clear();

      const initialUpdateRequests = updateTracker.requests();
      expect(initialUpdateRequests).toHaveLength(0);

      const updatePromise = fetch(`${baseURL}/users`, { method: 'PATCH' });
      await expect(updatePromise).rejects.toThrowError();
    });
  });

  it('should support creating new trackers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users': {
        PATCH: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      let updateTracker = interceptor.patch('/users').respond({
        status: 200,
        body: users[0],
      });

      interceptor.clear();

      updateTracker = interceptor.patch('/users').respond({
        status: 200,
        body: users[1],
      });

      const updateRequests = updateTracker.requests();
      expect(updateRequests).toHaveLength(0);

      const updateResponse = await fetch(`${baseURL}/users`, { method: 'PATCH' });
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
      '/users': {
        PATCH: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      const updateTracker = interceptor.patch('/users').respond({
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

      const updateResponse = await fetch(`${baseURL}/users`, { method: 'PATCH' });
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
