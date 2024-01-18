import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from 'vitest';

import HttpRequestTracker from '../../HttpRequestTracker';
import type BrowserHttpInterceptor from '../BrowserHttpInterceptor';
import type NodeHttpInterceptor from '../NodeHttpInterceptor';
import { HttpInterceptorOptions } from '../types/options';
import { HTTP_INTERCEPTOR_METHODS, HttpInterceptorMethod, HttpInterceptorSchema } from '../types/schema';

export function createHttpInterceptorTests<
  Interceptor extends typeof BrowserHttpInterceptor | typeof NodeHttpInterceptor,
>(InterceptorClass: Interceptor) {
  const defaultBaseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  async function usingInterceptor<Schema extends HttpInterceptorSchema>(
    options: HttpInterceptorOptions,
    callback: (interceptor: BrowserHttpInterceptor<Schema> | NodeHttpInterceptor<Schema>) => Promise<void> | void,
  ) {
    const interceptor = new InterceptorClass<Schema>(options);

    try {
      await callback(interceptor);
    } finally {
      interceptor.stop();
    }
  }

  it('should not throw an error when started multiple times', async () => {
    await usingInterceptor({ baseURL: defaultBaseURL }, async (interceptor) => {
      expect(interceptor.isRunning()).toBe(false);
      await interceptor.start();
      expect(interceptor.isRunning()).toBe(true);
      await interceptor.start();
      expect(interceptor.isRunning()).toBe(true);
      await interceptor.start();
      expect(interceptor.isRunning()).toBe(true);
    });
  });

  it('should not throw an error when stopped without running', async () => {
    await usingInterceptor({ baseURL: defaultBaseURL }, (interceptor) => {
      expect(interceptor.isRunning()).toBe(false);
      interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
      interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
      interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
    });
  });

  it('should not throw an error when stopped multiple times while running', async () => {
    await usingInterceptor({ baseURL: defaultBaseURL }, async (interceptor) => {
      expect(interceptor.isRunning()).toBe(false);
      await interceptor.start();
      expect(interceptor.isRunning()).toBe(true);
      interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
      interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
      interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
    });
  });

  it('should show a typescript error if trying to use a non-specified status code', async () => {
    await usingInterceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>({ baseURL: defaultBaseURL }, async (interceptor) => {
      await interceptor.start();

      interceptor.get('/users').respond({
        status: 200,
        body: users,
      });

      interceptor.get('/users').respond({
        // @ts-expect-error
        status: 201,
        body: users,
      });

      // @ts-expect-error
      interceptor.get('/users').respond(() => ({
        status: 201,
        body: users,
      }));
    });
  });

  it('should show a typescript error if trying to use a non-assignable response body', async () => {
    await usingInterceptor<{
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
    }>({ baseURL: defaultBaseURL }, async (interceptor) => {
      await interceptor.start();

      interceptor.get('/users').respond({
        status: 200,
        body: users,
      });
      interceptor.post('/notifications/read').respond({
        status: 204,
      });

      interceptor.get('/users').respond({
        status: 200,
        // @ts-expect-error
        body: '',
      });
      // @ts-expect-error
      interceptor.get('/users').respond(() => ({
        status: 200,
        body: '',
      }));

      interceptor.post('/notifications/read').respond({
        status: 204,
        // @ts-expect-error
        body: users,
      });
      // @ts-expect-error
      interceptor.post('/notifications/read').respond(() => ({
        status: 204,
        body: users,
      }));
    });
  });

  it('should show a typescript error if trying to use a non-specified path and/or method', async () => {
    await usingInterceptor<{
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
    }>({ baseURL: defaultBaseURL }, async (interceptor) => {
      await interceptor.start();

      interceptor.get('/users');
      interceptor.get('/users/:id');
      interceptor.get(`/users/${123}`);
      interceptor.post('/notifications/read');

      // @ts-expect-error
      interceptor.post('/users');
      // @ts-expect-error
      interceptor.post('/users/:id');
      // @ts-expect-error
      interceptor.post(`/users/${123}`);
      // @ts-expect-error
      interceptor.get('/notifications/read');

      // @ts-expect-error
      interceptor.get('/path');
      // @ts-expect-error
      interceptor.post('/path');

      // @ts-expect-error
      interceptor.put('/users');
    });
  });

  describe('Methods', () => {
    const verifiedMethods: HttpInterceptorMethod[] = [];

    afterAll(() => {
      expect(new Set(verifiedMethods)).toEqual(new Set(HTTP_INTERCEPTOR_METHODS));
    });

    describe('GET', () => {
      beforeAll(() => {
        verifiedMethods.push('GET');
      });

      it('should support intercepting GET requests with a static response body', async () => {
        await usingInterceptor<{
          '/users': {
            GET: {
              response: {
                200: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          const userListTracker = interceptor.get('/users').respond({
            status: 200,
            body: users[0],
          });
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'GET',
          });
          expect(userListResponse.status).toBe(200);

          const fetchedUsers = (await userListResponse.json()) as User;
          expect(fetchedUsers).toEqual(users[0]);
        });
      });

      it('should support intercepting GET requests with a computed response body', async () => {
        await usingInterceptor<{
          '/users': {
            GET: {
              response: {
                200: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          const userName = `User (other ${Math.random()})`;

          const userListTracker = interceptor.get('/users').respond(() => ({
            status: 200,
            body: { name: userName },
          }));
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'GET',
          });
          expect(userListResponse.status).toBe(200);

          const fetchedUsers = (await userListResponse.json()) as User;
          expect(fetchedUsers).toEqual<User>({ name: userName });
        });
      });

      it('should not intercept a GET request without a registered response', async () => {
        await usingInterceptor<{
          '/users': {
            GET: {
              response: {
                200: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          let fetchPromise = fetch(`${defaultBaseURL}/users`, { method: 'GET' });
          await expect(fetchPromise).rejects.toThrowError();

          const userListTracker = interceptor.get('/users');
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          fetchPromise = fetch(`${defaultBaseURL}/users`, { method: 'GET' });
          await expect(fetchPromise).rejects.toThrowError();

          userListTracker.respond({
            status: 200,
            body: users[0],
          });

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'GET',
          });
          expect(userListResponse.status).toBe(200);

          const fetchedUsers = (await userListResponse.json()) as User;
          expect(fetchedUsers).toEqual(users[0]);
        });
      });
    });

    describe('POST', () => {
      beforeAll(() => {
        verifiedMethods.push('POST');
      });

      it('should support intercepting POST requests with a static response body', async () => {
        await usingInterceptor<{
          '/users': {
            POST: {
              response: {
                201: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          const userListTracker = interceptor.post('/users').respond({
            status: 201,
            body: users[0],
          });
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'POST',
          });
          expect(userListResponse.status).toBe(201);

          const fetchedUsers = (await userListResponse.json()) as User;
          expect(fetchedUsers).toEqual(users[0]);
        });
      });

      it('should support intercepting POST requests with a computed response body, based on request body', async () => {
        await usingInterceptor<{
          '/users': {
            POST: {
              request: { body: User };
              response: {
                201: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          const userListTracker = interceptor.post('/users').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<User>();

            return {
              status: 201,
              body: {
                name: request.body.name,
              },
            };
          });
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          const userName = 'User (other)';

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'POST',
            body: JSON.stringify({ name: userName } satisfies User),
          });
          expect(userListResponse.status).toBe(201);

          const fetchedUsers = (await userListResponse.json()) as User;
          expect(fetchedUsers).toEqual<User>({ name: userName });
        });
      });

      it('should not intercept a POST request without a registered response', async () => {
        await usingInterceptor<{
          '/users': {
            POST: {
              response: {
                201: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          let fetchPromise = fetch(`${defaultBaseURL}/users`, { method: 'POST' });
          await expect(fetchPromise).rejects.toThrowError();

          const userListTracker = interceptor.post('/users');
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          fetchPromise = fetch(`${defaultBaseURL}/users`, { method: 'POST' });
          await expect(fetchPromise).rejects.toThrowError();

          userListTracker.respond({
            status: 201,
            body: users[0],
          });

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'POST',
          });
          expect(userListResponse.status).toBe(201);

          const fetchedUsers = (await userListResponse.json()) as User;
          expect(fetchedUsers).toEqual(users[0]);
        });
      });
    });

    describe('PUT', () => {
      beforeAll(() => {
        verifiedMethods.push('PUT');
      });

      it('should support intercepting PUT requests with a static response body', async () => {
        await usingInterceptor<{
          '/users': {
            PUT: {
              response: {
                200: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          const userListTracker = interceptor.put('/users').respond({
            status: 200,
            body: users[0],
          });
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'PUT',
          });
          expect(userListResponse.status).toBe(200);

          const fetchedUsers = (await userListResponse.json()) as User;
          expect(fetchedUsers).toEqual(users[0]);
        });
      });

      it('should support intercepting PUT requests with a computed response body, based on request body', async () => {
        await usingInterceptor<{
          '/users': {
            PUT: {
              request: { body: User };
              response: {
                200: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          const userListTracker = interceptor.put('/users').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<User>();

            return {
              status: 200,
              body: {
                name: request.body.name,
              },
            };
          });
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          const userName = 'User (other)';

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'PUT',
            body: JSON.stringify({ name: userName } satisfies User),
          });
          expect(userListResponse.status).toBe(200);

          const fetchedUsers = (await userListResponse.json()) as User;
          expect(fetchedUsers).toEqual<User>({ name: userName });
        });
      });

      it('should not intercept a PUT request without a registered response', async () => {
        await usingInterceptor<{
          '/users': {
            PUT: {
              response: {
                200: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          let fetchPromise = fetch(`${defaultBaseURL}/users`, { method: 'PUT' });
          await expect(fetchPromise).rejects.toThrowError();

          const userListTracker = interceptor.put('/users');
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          fetchPromise = fetch(`${defaultBaseURL}/users`, { method: 'PUT' });
          await expect(fetchPromise).rejects.toThrowError();

          userListTracker.respond({
            status: 200,
            body: users[0],
          });

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'PUT',
          });
          expect(userListResponse.status).toBe(200);

          const fetchedUsers = (await userListResponse.json()) as User;
          expect(fetchedUsers).toEqual(users[0]);
        });
      });
    });

    describe('PATCH', () => {
      beforeAll(() => {
        verifiedMethods.push('PATCH');
      });

      it('should support intercepting PATCH requests with a static response body', async () => {
        await usingInterceptor<{
          '/users': {
            PATCH: {
              response: {
                200: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          const userListTracker = interceptor.patch('/users').respond({
            status: 200,
            body: users[0],
          });
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'PATCH',
          });
          expect(userListResponse.status).toBe(200);
        });
      });

      it('should support intercepting PATCH requests with a computed response body, based on request body', async () => {
        await usingInterceptor<{
          '/users': {
            PATCH: {
              request: { body: User };
              response: {
                200: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          const userListTracker = interceptor.patch('/users').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<User>();

            return {
              status: 200,
              body: {
                name: request.body.name,
              },
            };
          });
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          const userName = 'User (other)';

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'PATCH',
            body: JSON.stringify({ name: userName } satisfies User),
          });
          expect(userListResponse.status).toBe(200);

          const fetchedUsers = (await userListResponse.json()) as User;
          expect(fetchedUsers).toEqual<User>({ name: userName });
        });
      });

      it('should not intercept a PATCH request without a registered response', async () => {
        await usingInterceptor<{
          '/users': {
            PATCH: {
              response: {
                200: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          let fetchPromise = fetch(`${defaultBaseURL}/users`, { method: 'PATCH' });
          await expect(fetchPromise).rejects.toThrowError();

          const userListTracker = interceptor.patch('/users');
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          fetchPromise = fetch(`${defaultBaseURL}/users`, { method: 'PATCH' });
          await expect(fetchPromise).rejects.toThrowError();

          userListTracker.respond({
            status: 200,
            body: users[0],
          });

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'PATCH',
          });
          expect(userListResponse.status).toBe(200);

          const fetchedUsers = (await userListResponse.json()) as User;
          expect(fetchedUsers).toEqual(users[0]);
        });
      });
    });

    describe('DELETE', () => {
      beforeAll(() => {
        verifiedMethods.push('DELETE');
      });

      it('should support intercepting DELETE requests with a static response body', async () => {
        await usingInterceptor<{
          '/users': {
            DELETE: {
              response: {
                200: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          const userListTracker = interceptor.delete('/users').respond({
            status: 200,
            body: users[0],
          });
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'DELETE',
          });
          expect(userListResponse.status).toBe(200);

          const fetchedUsers = (await userListResponse.json()) as User;
          expect(fetchedUsers).toEqual(users[0]);
        });
      });

      it('should support intercepting DELETE requests with a computed response body, based on request body', async () => {
        await usingInterceptor<{
          '/users': {
            DELETE: {
              request: { body: User };
              response: {
                200: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          const userListTracker = interceptor.delete('/users').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<User>();

            return {
              status: 200,
              body: {
                name: request.body.name,
              },
            };
          });
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          const userName = 'User (other)';

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'DELETE',
            body: JSON.stringify({ name: userName } satisfies User),
          });
          expect(userListResponse.status).toBe(200);

          const fetchedUsers = (await userListResponse.json()) as User;
          expect(fetchedUsers).toEqual<User>({ name: userName });
        });
      });

      it('should not intercept a DELETE request without a registered response', async () => {
        await usingInterceptor<{
          '/users': {
            DELETE: {
              response: {
                200: { body: User };
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          let fetchPromise = fetch(`${defaultBaseURL}/users`, { method: 'DELETE' });
          await expect(fetchPromise).rejects.toThrowError();

          const userListTracker = interceptor.delete('/users');
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          fetchPromise = fetch(`${defaultBaseURL}/users`, { method: 'DELETE' });
          await expect(fetchPromise).rejects.toThrowError();

          userListTracker.respond({
            status: 200,
            body: users[0],
          });

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'DELETE',
          });
          expect(userListResponse.status).toBe(200);

          const fetchedUsers = (await userListResponse.json()) as User;
          expect(fetchedUsers).toEqual(users[0]);
        });
      });
    });

    describe('HEAD', () => {
      beforeAll(() => {
        verifiedMethods.push('HEAD');
      });

      it('should support intercepting HEAD requests with a static response body', async () => {
        await usingInterceptor<{
          '/users': {
            HEAD: {
              response: {
                200: {};
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          const userListTracker = interceptor.head('/users').respond({
            status: 200,
          });
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'HEAD',
          });
          expect(userListResponse.status).toBe(200);
        });
      });

      it('should support intercepting HEAD requests with a computed response body', async () => {
        await usingInterceptor<{
          '/users': {
            HEAD: {
              response: {
                200: {};
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          const userListTracker = interceptor.head('/users').respond(() => ({
            status: 200,
          }));
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'HEAD',
          });
          expect(userListResponse.status).toBe(200);
        });
      });

      it('should not intercept a HEAD request without a registered response', async () => {
        await usingInterceptor<{
          '/users': {
            HEAD: {
              response: {
                200: {};
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          let fetchPromise = fetch(`${defaultBaseURL}/users`, { method: 'HEAD' });
          await expect(fetchPromise).rejects.toThrowError();

          const userListTracker = interceptor.head('/users');
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          fetchPromise = fetch(`${defaultBaseURL}/users`, { method: 'HEAD' });
          await expect(fetchPromise).rejects.toThrowError();

          userListTracker.respond({
            status: 200,
          });

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'HEAD',
          });
          expect(userListResponse.status).toBe(200);
        });
      });
    });

    describe('OPTIONS', () => {
      beforeAll(() => {
        verifiedMethods.push('OPTIONS');
      });

      it('should support intercepting OPTIONS requests with a static response body', async () => {
        await usingInterceptor<{
          '/users': {
            OPTIONS: {
              response: {
                200: {};
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          const userListTracker = interceptor.options('/users').respond({
            status: 200,
          });
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'OPTIONS',
          });
          expect(userListResponse.status).toBe(200);
        });
      });

      it('should support intercepting OPTIONS requests with a computed response body, based on request body', async () => {
        await usingInterceptor<{
          '/users': {
            OPTIONS: {
              request: { body: User };
              response: {
                200: {};
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          const userListTracker = interceptor.options('/users').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<User>();
            return {
              status: 200,
            };
          });
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          const userName = 'User (other)';

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'OPTIONS',
            body: JSON.stringify({ name: userName } satisfies User),
          });
          expect(userListResponse.status).toBe(200);
        });
      });

      it('should not intercept an OPTIONS request without a registered response', async () => {
        await usingInterceptor<{
          '/users': {
            OPTIONS: {
              response: {
                200: {};
              };
            };
          };
        }>({ baseURL: defaultBaseURL }, async (interceptor) => {
          await interceptor.start();

          let fetchPromise = fetch(`${defaultBaseURL}/users`, { method: 'OPTIONS' });
          await expect(fetchPromise).rejects.toThrowError();

          const userListTracker = interceptor.options('/users');
          expect(userListTracker).toBeInstanceOf(HttpRequestTracker);

          fetchPromise = fetch(`${defaultBaseURL}/users`, { method: 'OPTIONS' });
          await expect(fetchPromise).rejects.toThrowError();

          userListTracker.respond({
            status: 200,
          });

          const userListResponse = await fetch(`${defaultBaseURL}/users`, {
            method: 'OPTIONS',
          });
          expect(userListResponse.status).toBe(200);
        });
      });
    });
  });
}
