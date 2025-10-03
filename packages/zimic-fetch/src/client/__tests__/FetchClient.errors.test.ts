import { HttpSchema, JSONValue } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { expectResponseStatus } from '@tests/utils/requests';

import FetchResponseError from '../errors/FetchResponseError';
import createFetch from '../factory';
import { FetchResponse, FetchResponsePerStatusCode } from '../types/requests';

describe('FetchClient > Errors', () => {
  const baseURL = 'http://localhost:3000';

  type User = JSONValue<{
    id: string;
    name: string;
  }>;

  const users: User[] = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
  ];

  it('should type successful responses', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
            401: { body: { code: 401; message: string } };
            403: { body: { code: 403; message: string } };
            500: { body: { code: 500; message: string } };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .respond({
          status: 200,
          body: users,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200 | 401 | 403 | 500>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.json).toEqualTypeOf<
        | (() => Promise<User[]>)
        | (() => Promise<{ code: 401; message: string }>)
        | (() => Promise<{ code: 403; message: string }>)
        | (() => Promise<{ code: 500; message: string }>)
      >();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 200>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 401>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 403>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 500>)
      >();

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'> | null>();

      expect(response.ok).toBe(true);

      /* istanbul ignore if -- @preserve
       * response.ok is true. This if is necessary to narrow the response to a successful type. */
      if (!response.ok) {
        expectTypeOf(response.status).toEqualTypeOf<401 | 403 | 500>();
        expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'>>();

        throw response.error;
      }

      expectTypeOf(response.status).toEqualTypeOf<200>();

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponsePerStatusCode<Schema, 'GET', '/users', 200>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.clone).toEqualTypeOf<() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 200>>();

      expectTypeOf(response.error).toEqualTypeOf<null>();
      expect(response.error).toBe(null);
    });
  });

  it('should type failure responses', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
            401: { body: { code: 401; message: string } };
            403: { body: { code: 403; message: string } };
            500: { body: { code: 500; message: string } };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .respond({
          status: 403,
          body: { code: 403, message: 'Forbidden' },
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200 | 401 | 403 | 500>();
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: 403, message: 'Forbidden' });

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.json).toEqualTypeOf<
        | (() => Promise<User[]>)
        | (() => Promise<{ code: 401; message: string }>)
        | (() => Promise<{ code: 403; message: string }>)
        | (() => Promise<{ code: 500; message: string }>)
      >();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 200>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 401>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 403>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 500>)
      >();

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'> | null>();

      expect(response.ok).toBe(false);

      /* istanbul ignore if -- @preserve
       * response.ok is false. This if is necessary to narrow the response to a failed type. */
      if (response.ok) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        throw new Error('Expected a failed response.');
      }

      expectTypeOf(response.status).toEqualTypeOf<401 | 403 | 500>();

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        | FetchResponsePerStatusCode<Schema, 'GET', '/users', 401>
        | FetchResponsePerStatusCode<Schema, 'GET', '/users', 403>
        | FetchResponsePerStatusCode<Schema, 'GET', '/users', 500>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.json).toEqualTypeOf<
        | (() => Promise<{ code: 401; message: string }>)
        | (() => Promise<{ code: 403; message: string }>)
        | (() => Promise<{ code: 500; message: string }>)
      >();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 401>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 403>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 500>)
      >();

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'>>();
      expect(response.error).toEqual(new FetchResponseError<Schema, 'GET', '/users'>(response.request, response));
    });
  });

  it('should check response errors', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: {
            201: { body: User };
          };
        };

        GET: {
          response: {
            200: { body: User[] };
            401: { body: { code: 401; message: string } };
            403: { body: { code: 403; message: string } };
            500: { body: { code: 500; message: string } };
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
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .respond({
          status: 403,
          body: { code: 403, message: 'Forbidden' },
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200 | 401 | 403 | 500>();
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: 403, message: 'Forbidden' });

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'> | null>();

      expect(response.ok).toBe(false);

      /* istanbul ignore if -- @preserve
       * response.ok is false. This if is necessary to narrow the response to a failed type. */
      if (response.ok) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        throw new Error('Expected a failed response.');
      }

      expect(fetch.isResponseError(response.error, 'GET', '/users')).toBe(true);
      expect(fetch.isResponseError(response.error, 'POST', '/users')).toBe(false);
      expect(fetch.isResponseError(response.error, 'GET', '/users/:id')).toBe(false);

      /* istanbul ignore if -- @preserve
       * This if is necessary to narrow the error type to a specific error. */
      if (!fetch.isResponseError(response.error, 'GET', '/users')) {
        expectTypeOf(response.error).toEqualTypeOf<never>();
      }

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'>>();

      expect(response.error.request).toBe(response.request);
      expect(response.error.response).toBe(response);
      expect(response.error.cause).toBe(undefined);
    });
  });

  it('should check response errors considering path params', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: {
            201: { body: User };
          };
        };

        GET: {
          response: {
            200: { body: User[] };
            401: { body: { code: 401; message: string } };
            403: { body: { code: 403; message: string } };
            500: { body: { code: 500; message: string } };
          };
        };
      };

      '/users/:id': {
        GET: {
          response: {
            200: { body: User };
            404: { body: { code: 404; message: string } };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .get(`/users/${users[0].id}`)
        .respond({
          status: 404,
          body: { code: 404, message: 'Not Found' },
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch(`/users/${users[0].id}`, { method: 'GET' });

      expectResponseStatus(response, 404);
      expect(response.ok).toBe(false);

      expect(fetch.isResponseError(response.error, 'GET', '/users')).toBe(false);
      expect(fetch.isResponseError(response.error, 'POST', '/users')).toBe(false);
      expect(fetch.isResponseError(response.error, 'GET', '/users/:id')).toBe(true);

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users/:id'>>();

      expect(response.error.request).toBe(response.request);
      expect(response.error.response).toBe(response);
      expect(response.error.cause).toBe(undefined);
    });
  });
});
