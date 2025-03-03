import { HttpSchema } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { expectResponseStatus } from '@tests/utils/requests';

import createFetch from '../factory';

describe('FetchClient > isResponseError', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
  ];

  it('should correctly check a fetch response error without path params', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            body: User;
          };
          response: {
            201: { body: User };
          };
        };
        GET: {
          response: {
            200: { body: User[] };
            500: { body: { message: string } };
          };
        };
      };

      '/users/:userId': {
        GET: {
          response: {
            200: { body: User };
            404: {};
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .respond({
          status: 500,
          body: { message: 'Internal server error' },
        })
        .times(1);

      const fetch = createFetch<Schema>({
        baseURL,
      });

      const response = await fetch('/users', {
        method: 'GET',
      });

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.status).toEqualTypeOf<200 | 500>();
      expectResponseStatus(response, 500);

      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
      expect(response.request.method).toBe('GET');

      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();
      expect(response.request.path).toBe('/users');

      expect(fetch.isResponseError(response.error, 'GET', '/users')).toBe(true);
      expect(fetch.isResponseError(response.error, 'POST', '/users')).toBe(false);
      expect(fetch.isResponseError(response.error, 'GET', '/users/:userId')).toBe(false);
    });
  });

  it('should correctly check a fetch response error with path params', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            body: User;
          };
          response: {
            201: { body: User };
          };
        };
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };

      '/users/:userId': {
        GET: {
          response: {
            200: { body: User };
            404: {};
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get(`/users/${users[0].id}`)
        .respond({
          status: 404,
        })
        .times(1);

      const fetch = createFetch<Schema>({
        baseURL,
      });

      const response = await fetch(`/users/${users[0].id}`, {
        method: 'GET',
      });

      expectTypeOf(response.status).toEqualTypeOf<200 | 404>();
      expectResponseStatus(response, 404);

      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
      expect(response.request.method).toBe('GET');

      expectTypeOf(response.request.path).toEqualTypeOf<`/users/${string}`>();
      expect(response.request.path).toBe(`/users/${users[0].id}`);

      expect(fetch.isResponseError(response.error, 'GET', '/users')).toBe(false);
      expect(fetch.isResponseError(response.error, 'POST', '/users')).toBe(false);
      expect(fetch.isResponseError(response.error, 'GET', '/users/:userId')).toBe(true);
    });
  });

  it('should correctly check a fetch response error without a leading slash in the path', async () => {
    type Schema = HttpSchema<{
      users: {
        POST: {
          request: {
            body: User;
          };
          response: {
            201: { body: User };
          };
        };
        GET: {
          response: {
            200: { body: User[] };
            500: { body: { message: string } };
          };
        };
      };

      'users/:userId': {
        GET: {
          response: {
            200: { body: User };
            404: {};
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get('users')
        .respond({
          status: 500,
          body: { message: 'Internal server error' },
        })
        .times(1);

      const fetch = createFetch<Schema>({
        baseURL,
      });

      const response = await fetch('users', {
        method: 'GET',
      });

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.status).toEqualTypeOf<200 | 500>();
      expectResponseStatus(response, 500);

      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
      expect(response.request.method).toBe('GET');

      expectTypeOf(response.request.path).toEqualTypeOf<'users'>();
      expect(response.request.path).toBe('/users');

      expect(fetch.isResponseError(response.error, 'GET', 'users')).toBe(true);

      // @ts-expect-error Forcing a leading slash in the path
      expect(fetch.isResponseError(response.error, 'GET', '/users')).toBe(true);
      // @ts-expect-error Forcing a trailing slash in the path
      expect(fetch.isResponseError(response.error, 'GET', 'users/')).toBe(true);
      // @ts-expect-error Forcing a leading and trailing slash in the path
      expect(fetch.isResponseError(response.error, 'GET', '/users/')).toBe(true);

      expect(fetch.isResponseError(response.error, 'POST', 'users')).toBe(false);

      // @ts-expect-error Forcing a leading slash in the path
      expect(fetch.isResponseError(response.error, 'POST', '/users')).toBe(false);
      // @ts-expect-error Forcing a trailing slash in the path
      expect(fetch.isResponseError(response.error, 'POST', 'users/')).toBe(false);
      // @ts-expect-error Forcing a leading and trailing slash in the path
      expect(fetch.isResponseError(response.error, 'POST', '/users/')).toBe(false);

      expect(fetch.isResponseError(response.error, 'GET', 'users/:userId')).toBe(false);

      // @ts-expect-error Forcing a leading slash in the path
      expect(fetch.isResponseError(response.error, 'GET', '/users/:userId')).toBe(false);
      // @ts-expect-error Forcing a trailing slash in the path
      expect(fetch.isResponseError(response.error, 'GET', 'users/:userId/')).toBe(false);
      // @ts-expect-error Forcing a leading and trailing slash in the path
      expect(fetch.isResponseError(response.error, 'GET', '/users/:userId/')).toBe(false);
    });
  });

  it('should correctly check a fetch response error with a trailing slash in the path', async () => {
    type Schema = HttpSchema<{
      'users/': {
        POST: {
          request: {
            body: User;
          };
          response: {
            201: { body: User };
          };
        };
        GET: {
          response: {
            200: { body: User[] };
            500: { body: { message: string } };
          };
        };
      };

      'users/:userId/': {
        GET: {
          response: {
            200: { body: User };
            404: {};
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get('users/')
        .respond({
          status: 500,
          body: { message: 'Internal server error' },
        })
        .times(1);
      const fetch = createFetch<Schema>({
        baseURL,
      });

      const response = await fetch('users/', {
        method: 'GET',
      });

      expect(response.url).toBe(joinURL(baseURL, '/users/'));

      expectTypeOf(response.status).toEqualTypeOf<200 | 500>();
      expectResponseStatus(response, 500);

      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
      expect(response.request.method).toBe('GET');

      expectTypeOf(response.request.path).toEqualTypeOf<'users/'>();
      expect(response.request.path).toBe('/users/');

      expect(fetch.isResponseError(response.error, 'GET', 'users/')).toBe(true);

      // @ts-expect-error Forcing a no leading or training slashes in the path
      expect(fetch.isResponseError(response.error, 'GET', 'users')).toBe(true);
      // @ts-expect-error Forcing a leading slash in the path
      expect(fetch.isResponseError(response.error, 'GET', '/users')).toBe(true);
      // @ts-expect-error Forcing a leading and trailing slash in the path
      expect(fetch.isResponseError(response.error, 'GET', '/users/')).toBe(true);

      expect(fetch.isResponseError(response.error, 'POST', 'users/')).toBe(false);

      // @ts-expect-error Forcing a trailing slash in the path
      expect(fetch.isResponseError(response.error, 'POST', 'users')).toBe(false);
      // @ts-expect-error Forcing a leading slash in the path
      expect(fetch.isResponseError(response.error, 'POST', '/users')).toBe(false);
      // @ts-expect-error Forcing a leading and trailing slash in the path
      expect(fetch.isResponseError(response.error, 'POST', '/users/')).toBe(false);

      expect(fetch.isResponseError(response.error, 'GET', 'users/:userId/')).toBe(false);

      // @ts-expect-error Forcing a trailing slash in the path
      expect(fetch.isResponseError(response.error, 'GET', 'users/:userId')).toBe(false);
      // @ts-expect-error Forcing a leading and trailing slash in the path
      expect(fetch.isResponseError(response.error, 'GET', '/users/:userId')).toBe(false);
      // @ts-expect-error Forcing a leading slash in the path
      expect(fetch.isResponseError(response.error, 'GET', '/users/:userId/')).toBe(false);
    });
  });

  it('should correctly check a fetch response error with a leading and trailing slash in the path', async () => {
    type Schema = HttpSchema<{
      '/users/': {
        POST: {
          request: {
            body: User;
          };
          response: {
            201: { body: User };
          };
        };
        GET: {
          response: {
            200: { body: User[] };
            500: { body: { message: string } };
          };
        };
      };

      '/users/:userId/': {
        GET: {
          response: {
            200: { body: User };
            404: {};
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get('/users/')
        .respond({
          status: 500,
          body: { message: 'Internal server error' },
        })
        .times(1);
      const fetch = createFetch<Schema>({
        baseURL,
      });

      const response = await fetch('/users/', {
        method: 'GET',
      });

      expect(response.url).toBe(joinURL(baseURL, '/users/'));

      expectTypeOf(response.status).toEqualTypeOf<200 | 500>();
      expectResponseStatus(response, 500);

      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
      expect(response.request.method).toBe('GET');

      expectTypeOf(response.request.path).toEqualTypeOf<'/users/'>();
      expect(response.request.path).toBe('/users/');

      expect(fetch.isResponseError(response.error, 'GET', '/users/')).toBe(true);

      // @ts-expect-error Forcing a trailing slash in the path
      expect(fetch.isResponseError(response.error, 'GET', 'users')).toBe(true);
      // @ts-expect-error Forcing a trailing slash in the path
      expect(fetch.isResponseError(response.error, 'GET', 'users/')).toBe(true);
      // @ts-expect-error Forcing a leading and trailing slash in the path
      expect(fetch.isResponseError(response.error, 'GET', '/users')).toBe(true);

      expect(fetch.isResponseError(response.error, 'POST', '/users/')).toBe(false);

      // @ts-expect-error Forcing a trailing slash in the path
      expect(fetch.isResponseError(response.error, 'POST', 'users')).toBe(false);
      // @ts-expect-error Forcing a leading and trailing slash in the path
      expect(fetch.isResponseError(response.error, 'POST', '/users')).toBe(false);
      // @ts-expect-error Forcing a trailing slash in the path
      expect(fetch.isResponseError(response.error, 'POST', 'users/')).toBe(false);

      expect(fetch.isResponseError(response.error, 'GET', '/users/:userId/')).toBe(false);

      // @ts-expect-error Forcing a trailing slash in the path
      expect(fetch.isResponseError(response.error, 'GET', 'users/:userId')).toBe(false);
      // @ts-expect-error Forcing a leading and trailing slash in the path
      expect(fetch.isResponseError(response.error, 'GET', '/users/:userId')).toBe(false);
      // @ts-expect-error Forcing a trailing slash in the path
      expect(fetch.isResponseError(response.error, 'GET', 'users/:userId/')).toBe(false);
    });
  });

  it('should correctly check non-fetch response errors', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .respond({
          status: 200,
          body: users,
        })
        .times(1);
      const fetch = createFetch<Schema>({
        baseURL,
      });

      const response = await globalThis.fetch(`${fetch.defaults.baseURL}/users`, {
        method: 'GET',
      });

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(fetch.isRequest(new Error(), 'GET', '/users')).toBe(false);
      expect(fetch.isRequest('string', 'GET', '/users')).toBe(false);
      expect(fetch.isRequest(null, 'GET', '/users')).toBe(false);
      expect(fetch.isRequest(undefined, 'GET', '/users')).toBe(false);
    });
  });
});
