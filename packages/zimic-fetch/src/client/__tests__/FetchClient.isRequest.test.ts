import { HttpSchema } from '@zimic/http';
import { joinURL } from '@zimic/utils/url';
import { describe, expect, expectTypeOf, it } from 'vitest';

import createFetch from '../factory';

describe('FetchClient > isRequest', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
  ];

  it('should check a fetch request without path params', () => {
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

    const fetch = createFetch<Schema>({
      baseURL,
    });

    const request = new fetch.Request('/users', {
      method: 'GET',
    });

    expect(request.url).toBe(joinURL(baseURL, '/users'));

    expectTypeOf(request.method).toEqualTypeOf<'GET'>();
    expect(request.method).toBe('GET');

    expectTypeOf(request.path).toEqualTypeOf<'/users'>();
    expect(request.path).toBe('/users');

    expect(fetch.isRequest(request, 'GET', '/users')).toBe(true);
    expect(fetch.isRequest(request, 'POST', '/users')).toBe(false);
    expect(fetch.isRequest(request, 'GET', '/users/:userId')).toBe(false);
  });

  it('should check a fetch request with path params', () => {
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

    const fetch = createFetch<Schema>({
      baseURL,
    });

    const request = new fetch.Request(`/users/${users[0].id}`, {
      method: 'GET',
    });

    expectTypeOf(request.method).toEqualTypeOf<'GET'>();
    expect(request.method).toBe('GET');

    expectTypeOf(request.path).toEqualTypeOf<`/users/${string}`>();
    expect(request.path).toBe(`/users/${users[0].id}`);

    expect(fetch.isRequest(request, 'GET', '/users')).toBe(false);
    expect(fetch.isRequest(request, 'POST', '/users')).toBe(false);
    expect(fetch.isRequest(request, 'GET', '/users/:userId')).toBe(true);
  });

  it('should check a fetch request without a leading slash in the path', () => {
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

    const fetch = createFetch<Schema>({
      baseURL,
    });

    const request = new fetch.Request('users', {
      method: 'GET',
    });

    expect(request.url).toBe(joinURL(baseURL, '/users'));

    expectTypeOf(request.method).toEqualTypeOf<'GET'>();
    expect(request.method).toBe('GET');

    expectTypeOf(request.path).toEqualTypeOf<'users'>();
    expect(request.path).toBe('/users');

    expect(fetch.isRequest(request, 'GET', 'users')).toBe(true);

    // @ts-expect-error Forcing a leading slash in the path
    expect(fetch.isRequest(request, 'GET', '/users')).toBe(true);
    // @ts-expect-error Forcing a trailing slash in the path
    expect(fetch.isRequest(request, 'GET', 'users/')).toBe(true);
    // @ts-expect-error Forcing a leading and trailing slash in the path
    expect(fetch.isRequest(request, 'GET', '/users/')).toBe(true);

    expect(fetch.isRequest(request, 'POST', 'users')).toBe(false);

    // @ts-expect-error Forcing a leading slash in the path
    expect(fetch.isRequest(request, 'POST', '/users')).toBe(false);
    // @ts-expect-error Forcing a trailing slash in the path
    expect(fetch.isRequest(request, 'POST', 'users/')).toBe(false);
    // @ts-expect-error Forcing a leading and trailing slash in the path
    expect(fetch.isRequest(request, 'POST', '/users/')).toBe(false);

    expect(fetch.isRequest(request, 'GET', 'users/:userId')).toBe(false);

    // @ts-expect-error Forcing a leading slash in the path
    expect(fetch.isRequest(request, 'GET', '/users/:userId')).toBe(false);
    // @ts-expect-error Forcing a trailing slash in the path
    expect(fetch.isRequest(request, 'GET', 'users/:userId/')).toBe(false);
    // @ts-expect-error Forcing a leading and trailing slash in the path
    expect(fetch.isRequest(request, 'GET', '/users/:userId/')).toBe(false);
  });

  it('should check a fetch request with a trailing slash in the path', () => {
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

    const fetch = createFetch<Schema>({
      baseURL,
    });

    const request = new fetch.Request('users/', {
      method: 'GET',
    });

    expect(request.url).toBe(joinURL(baseURL, '/users/'));

    expectTypeOf(request.method).toEqualTypeOf<'GET'>();
    expect(request.method).toBe('GET');

    expectTypeOf(request.path).toEqualTypeOf<'users/'>();
    expect(request.path).toBe('/users/');

    expect(fetch.isRequest(request, 'GET', 'users/')).toBe(true);

    // @ts-expect-error Forcing a no leading or training slashes in the path
    expect(fetch.isRequest(request, 'GET', 'users')).toBe(true);
    // @ts-expect-error Forcing a leading slash in the path
    expect(fetch.isRequest(request, 'GET', '/users')).toBe(true);
    // @ts-expect-error Forcing a leading and trailing slash in the path
    expect(fetch.isRequest(request, 'GET', '/users/')).toBe(true);

    expect(fetch.isRequest(request, 'POST', 'users/')).toBe(false);

    // @ts-expect-error Forcing a trailing slash in the path
    expect(fetch.isRequest(request, 'POST', 'users')).toBe(false);
    // @ts-expect-error Forcing a leading slash in the path
    expect(fetch.isRequest(request, 'POST', '/users')).toBe(false);
    // @ts-expect-error Forcing a leading and trailing slash in the path
    expect(fetch.isRequest(request, 'POST', '/users/')).toBe(false);

    expect(fetch.isRequest(request, 'GET', 'users/:userId/')).toBe(false);

    // @ts-expect-error Forcing a trailing slash in the path
    expect(fetch.isRequest(request, 'GET', 'users/:userId')).toBe(false);
    // @ts-expect-error Forcing a leading and trailing slash in the path
    expect(fetch.isRequest(request, 'GET', '/users/:userId')).toBe(false);
    // @ts-expect-error Forcing a leading slash in the path
    expect(fetch.isRequest(request, 'GET', '/users/:userId/')).toBe(false);
  });

  it('should check a fetch request with a leading and trailing slash in the path', () => {
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

    const fetch = createFetch<Schema>({
      baseURL,
    });

    const request = new fetch.Request('/users/', {
      method: 'GET',
    });

    expect(request.url).toBe(joinURL(baseURL, '/users/'));

    expectTypeOf(request.method).toEqualTypeOf<'GET'>();
    expect(request.method).toBe('GET');

    expectTypeOf(request.path).toEqualTypeOf<'/users/'>();
    expect(request.path).toBe('/users/');

    expect(fetch.isRequest(request, 'GET', '/users/')).toBe(true);

    // @ts-expect-error Forcing a trailing slash in the path
    expect(fetch.isRequest(request, 'GET', 'users')).toBe(true);
    // @ts-expect-error Forcing a trailing slash in the path
    expect(fetch.isRequest(request, 'GET', 'users/')).toBe(true);
    // @ts-expect-error Forcing a leading and trailing slash in the path
    expect(fetch.isRequest(request, 'GET', '/users')).toBe(true);

    expect(fetch.isRequest(request, 'POST', '/users/')).toBe(false);

    // @ts-expect-error Forcing a trailing slash in the path
    expect(fetch.isRequest(request, 'POST', 'users')).toBe(false);
    // @ts-expect-error Forcing a leading and trailing slash in the path
    expect(fetch.isRequest(request, 'POST', '/users')).toBe(false);
    // @ts-expect-error Forcing a trailing slash in the path
    expect(fetch.isRequest(request, 'POST', 'users/')).toBe(false);

    expect(fetch.isRequest(request, 'GET', '/users/:userId/')).toBe(false);

    // @ts-expect-error Forcing a trailing slash in the path
    expect(fetch.isRequest(request, 'GET', 'users/:userId')).toBe(false);
    // @ts-expect-error Forcing a leading and trailing slash in the path
    expect(fetch.isRequest(request, 'GET', '/users/:userId')).toBe(false);
    // @ts-expect-error Forcing a trailing slash in the path
    expect(fetch.isRequest(request, 'GET', 'users/:userId/')).toBe(false);
  });

  it('should check non-fetch requests', () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    const fetch = createFetch<Schema>({
      baseURL,
    });

    const request = new Request(`${fetch.baseURL}/users`, {
      method: 'GET',
    });

    expect(request.url).toBe(joinURL(baseURL, '/users'));

    expectTypeOf(request.method).toEqualTypeOf<string>();
    expect(request.method).toBe('GET');

    expect(fetch.isRequest(request, 'GET', '/users')).toBe(false);

    expect(fetch.isRequest(new Error(), 'GET', '/users')).toBe(false);
    expect(fetch.isRequest('string', 'GET', '/users')).toBe(false);
    expect(fetch.isRequest(null, 'GET', '/users')).toBe(false);
    expect(fetch.isRequest(undefined, 'GET', '/users')).toBe(false);
  });
});
