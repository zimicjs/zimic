import { expect, expectTypeOf, it } from 'vitest';

import HttpRequestTracker from '@/interceptor/http/HttpRequestTracker';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import HttpInterceptor from '../../../HttpInterceptor';
import { HttpInterceptorOptions } from '../../../types/options';
import { HttpInterceptorSchema } from '../../../types/schema';

export function declareDeleteHttpInterceptorTests(
  createInterceptor: <Schema extends HttpInterceptorSchema>(options: HttpInterceptorOptions) => HttpInterceptor<Schema>,
) {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  it('should support intercepting DELETE requests with a static response body', async () => {
    const interceptor = createInterceptor<{
      '/users': {
        DELETE: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const deletionTracker = interceptor.delete('/users').respond({
        status: 200,
        body: users[0],
      });
      expect(deletionTracker).toBeInstanceOf(HttpRequestTracker);

      const deletionRequests = deletionTracker.requests();
      expect(deletionRequests).toHaveLength(0);

      const deletionResponse = await fetch(`${baseURL}/users`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      const deletedUsers = (await deletionResponse.json()) as User;
      expect(deletedUsers).toEqual(users[0]);

      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<never>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[0]);
    });
  });

  it('should support intercepting DELETE requests with a computed response body, based on the request body', async () => {
    const interceptor = createInterceptor<{
      '/users': {
        DELETE: {
          request: { body: User };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const deletionTracker = interceptor.delete('/users').respond((request) => {
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

      const deletionResponse = await fetch(`${baseURL}/users`, {
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

  it('should support intercepting DELETE requests with a dynamic route', async () => {
    const interceptor = createInterceptor<{
      '/users/:id': {
        DELETE: {
          response: {
            200: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

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

      expectTypeOf(genericDeletionRequest.body).toEqualTypeOf<never>();
      expect(genericDeletionRequest.body).toBe(null);

      expectTypeOf(genericDeletionRequest.response.status).toEqualTypeOf<200>();
      expect(genericDeletionRequest.response.status).toEqual(200);

      expectTypeOf(genericDeletionRequest.response.body).toEqualTypeOf<User>();
      expect(genericDeletionRequest.response.body).toEqual(users[0]);

      genericDeletionTracker.bypass();

      const specificDeletionTracker = interceptor.delete(`/users/${1}`).respond({
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

      expectTypeOf(specificDeletionRequest.body).toEqualTypeOf<never>();
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
    const interceptor = createInterceptor<{
      '/users': {
        DELETE: {
          request: { body: User };
          response: {
            200: { body: User };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const userName = 'User (other)';

      let deletionPromise = fetch(`${baseURL}/users`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      await expect(deletionPromise).rejects.toThrowError();

      const deletionTrackerWithoutResponse = interceptor.delete('/users');
      expect(deletionTrackerWithoutResponse).toBeInstanceOf(HttpRequestTracker);

      const deletionRequestsWithoutResponse = deletionTrackerWithoutResponse.requests();
      expect(deletionRequestsWithoutResponse).toHaveLength(0);

      let [deletionRequestWithoutResponse] = deletionRequestsWithoutResponse;
      expectTypeOf<typeof deletionRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof deletionRequestWithoutResponse.response.status>().toEqualTypeOf<never>();
      expectTypeOf<typeof deletionRequestWithoutResponse.response.body>().toEqualTypeOf<never>();

      deletionPromise = fetch(`${baseURL}/users`, {
        method: 'DELETE',
        body: JSON.stringify({ name: userName } satisfies User),
      });
      await expect(deletionPromise).rejects.toThrowError();

      expect(deletionRequestsWithoutResponse).toHaveLength(0);

      [deletionRequestWithoutResponse] = deletionRequestsWithoutResponse;
      expectTypeOf<typeof deletionRequestWithoutResponse.body>().toEqualTypeOf<User>();
      expectTypeOf<typeof deletionRequestWithoutResponse.response.status>().toEqualTypeOf<never>();
      expectTypeOf<typeof deletionRequestWithoutResponse.response.body>().toEqualTypeOf<never>();

      const deletionTrackerWithResponse = deletionTrackerWithoutResponse.respond({
        status: 200,
        body: users[0],
      });

      const deletionResponse = await fetch(`${baseURL}/users`, {
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

    const interceptor = createInterceptor<{
      '/users': {
        DELETE: {
          response: {
            200: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const deletionTracker = interceptor
        .delete('/users')
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

      const deletionResponse = await fetch(`${baseURL}/users`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      const deletionUsers = (await deletionResponse.json()) as User;
      expect(deletionUsers).toEqual(users[1]);

      expect(deletionRequests).toHaveLength(1);
      const [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<never>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[1]);

      const errorDeletionTracker = interceptor.delete('/users').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const errorDeletionRequests = errorDeletionTracker.requests();
      expect(errorDeletionRequests).toHaveLength(0);

      const otherDeletionResponse = await fetch(`${baseURL}/users`, { method: 'DELETE' });
      expect(otherDeletionResponse.status).toBe(500);

      const serverError = (await otherDeletionResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      expect(deletionRequests).toHaveLength(1);

      expect(errorDeletionRequests).toHaveLength(1);
      const [errorDeletionRequest] = errorDeletionRequests;
      expect(errorDeletionRequest).toBeInstanceOf(Request);

      expectTypeOf(errorDeletionRequest.body).toEqualTypeOf<never>();
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

    const interceptor = createInterceptor<{
      '/users': {
        DELETE: {
          response: {
            200: { body: User };
            500: { body: ServerErrorResponseBody };
          };
        };
      };
    }>({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      await interceptor.start();

      const deletionTracker = interceptor
        .delete('/users')
        .respond({
          status: 200,
          body: users[0],
        })
        .bypass();

      const initialDeletionRequests = deletionTracker.requests();
      expect(initialDeletionRequests).toHaveLength(0);

      const deletionPromise = fetch(`${baseURL}/users`, { method: 'DELETE' });
      await expect(deletionPromise).rejects.toThrowError();

      deletionTracker.respond({
        status: 200,
        body: users[1],
      });

      expect(initialDeletionRequests).toHaveLength(0);
      const deletionRequests = deletionTracker.requests();
      expect(deletionRequests).toHaveLength(0);

      let deletionResponse = await fetch(`${baseURL}/users`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      let createdUsers = (await deletionResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

      expect(deletionRequests).toHaveLength(1);
      let [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<never>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[1]);

      const errorDeletionTracker = interceptor.delete('/users').respond({
        status: 500,
        body: { message: 'Internal server error' },
      });

      const errorDeletionRequests = errorDeletionTracker.requests();
      expect(errorDeletionRequests).toHaveLength(0);

      const otherDeletionResponse = await fetch(`${baseURL}/users`, { method: 'DELETE' });
      expect(otherDeletionResponse.status).toBe(500);

      const serverError = (await otherDeletionResponse.json()) as ServerErrorResponseBody;
      expect(serverError).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      expect(deletionRequests).toHaveLength(1);

      expect(errorDeletionRequests).toHaveLength(1);
      const [errorDeletionRequest] = errorDeletionRequests;
      expect(errorDeletionRequest).toBeInstanceOf(Request);

      expectTypeOf(errorDeletionRequest.body).toEqualTypeOf<never>();
      expect(errorDeletionRequest.body).toBe(null);

      expectTypeOf(errorDeletionRequest.response.status).toEqualTypeOf<500>();
      expect(errorDeletionRequest.response.status).toEqual(500);

      expectTypeOf(errorDeletionRequest.response.body).toEqualTypeOf<ServerErrorResponseBody>();
      expect(errorDeletionRequest.response.body).toEqual<ServerErrorResponseBody>({ message: 'Internal server error' });

      errorDeletionTracker.bypass();

      deletionResponse = await fetch(`${baseURL}/users`, { method: 'DELETE' });
      expect(deletionResponse.status).toBe(200);

      createdUsers = (await deletionResponse.json()) as User;
      expect(createdUsers).toEqual(users[1]);

      expect(errorDeletionRequests).toHaveLength(1);

      expect(deletionRequests).toHaveLength(2);
      [deletionRequest] = deletionRequests;
      expect(deletionRequest).toBeInstanceOf(Request);

      expectTypeOf(deletionRequest.body).toEqualTypeOf<never>();
      expect(deletionRequest.body).toBe(null);

      expectTypeOf(deletionRequest.response.status).toEqualTypeOf<200>();
      expect(deletionRequest.response.status).toEqual(200);

      expectTypeOf(deletionRequest.response.body).toEqualTypeOf<User>();
      expect(deletionRequest.response.body).toEqual(users[1]);
    });
  });
}
