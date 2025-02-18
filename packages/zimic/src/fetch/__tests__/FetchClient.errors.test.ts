import { HttpSchema } from '@zimic/http';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { joinURL } from '@/utils/urls';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import FetchResponseError from '../errors/FetchResponseError';
import createFetch from '../factory';
import { FetchResponse, FetchResponsePerStatusCode } from '../types/requests';

describe('FetchClient (node) > Errors', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
  ];

  it('should correctly type successful responses', async () => {
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, { checkTimes: true }, async (interceptor) => {
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
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.json).toEqualTypeOf<
        | (() => Promise<User[]>)
        | (() => Promise<{ code: 401; message: string }>)
        | (() => Promise<{ code: 403; message: string }>)
        | (() => Promise<{ code: 500; message: string }>)
      >();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 200>)
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 401>)
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 403>)
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 500>)
      >();

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<'/users', 'GET', Schema['/users']['GET']> | null>();

      expect(response.ok).toBe(true);

      /* istanbul ignore if -- @preserve
       * response.ok is true. This if is necessary to narrow the response to a successful type. */
      if (!response.ok) {
        expectTypeOf(response.status).toEqualTypeOf<401 | 403 | 500>();
        expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<'/users', 'GET', Schema['/users']['GET']>>();

        throw response.error;
      }

      expectTypeOf(response.status).toEqualTypeOf<200>();

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 200>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.clone).toEqualTypeOf<
        () => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 200>
      >();

      expectTypeOf(response.error).toEqualTypeOf<null>();
      expect(response.error).toBe(null);
    });
  });

  it('should correctly type failure responses', async () => {
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, { checkTimes: true }, async (interceptor) => {
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
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.json).toEqualTypeOf<
        | (() => Promise<User[]>)
        | (() => Promise<{ code: 401; message: string }>)
        | (() => Promise<{ code: 403; message: string }>)
        | (() => Promise<{ code: 500; message: string }>)
      >();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 200>)
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 401>)
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 403>)
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 500>)
      >();

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<'/users', 'GET', Schema['/users']['GET']> | null>();

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
        | FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 401>
        | FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 403>
        | FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 500>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.json).toEqualTypeOf<
        | (() => Promise<{ code: 401; message: string }>)
        | (() => Promise<{ code: 403; message: string }>)
        | (() => Promise<{ code: 500; message: string }>)
      >();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 401>)
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 403>)
        | (() => FetchResponsePerStatusCode<'/users', 'GET', Schema['/users']['GET'], 500>)
      >();

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<'/users', 'GET', Schema['/users']['GET']>>();
      expect(response.error).toEqual(
        new FetchResponseError<'/users', 'GET', Schema['/users']['GET']>(response.request, response),
      );
    });
  });

  it('should correctly check response errors', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: {
            200: { body: User };
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, { checkTimes: true }, async (interceptor) => {
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
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<'/users', 'GET', Schema['/users']['GET']> | null>();

      expect(response.ok).toBe(false);

      /* istanbul ignore if -- @preserve
       * response.ok is false. This if is necessary to narrow the response to a failed type. */
      if (response.ok) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        throw new Error('Expected a failed response.');
      }

      const error = response.error as unknown;

      expect(fetch.isResponseError(error, '/users', 'GET')).toBe(true);
      expect(fetch.isResponseError(error, '/users', 'POST')).toBe(false);
      expect(fetch.isResponseError(error, '/users/:id', 'GET')).toBe(false);

      /* istanbul ignore else -- @preserve
       * This if is necessary to narrow the error type to a specific error. */
      if (fetch.isResponseError(error, '/users', 'GET')) {
        expectTypeOf(error).toEqualTypeOf<FetchResponseError<'/users', 'GET', Schema['/users']['GET']>>();

        expect(error.request).toBe(response.request);
        expect(error.response).toBe(response);
        expect(error.cause).toBe(response);
      } else {
        expectTypeOf(error).toEqualTypeOf<unknown>();
      }
    });
  });

  it('should correctly check response errors considering path params', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: {
            200: { body: User };
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, { checkTimes: true }, async (interceptor) => {
      await interceptor
        .get(`/users/${users[0].id}`)
        .respond({
          status: 404,
          body: { code: 404, message: 'Not Found' },
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch(`/users/${users[0].id}`, { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200 | 404>();
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ code: 404, message: 'Not Found' });

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users/:id', 'GET', Schema['/users/:id']['GET']>
      >();

      expect(response.url).toBe(joinURL(baseURL, `/users/${users[0].id}`));
      expect(response.request.path).toBe(`/users/${users[0].id}`);

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<
        '/users/:id',
        'GET',
        Schema['/users/:id']['GET']
      > | null>();

      expect(response.ok).toBe(false);

      const error = response.error as unknown;

      expect(fetch.isResponseError(error, '/users', 'GET')).toBe(false);
      expect(fetch.isResponseError(error, '/users', 'POST')).toBe(false);
      expect(fetch.isResponseError(error, '/users/:id', 'GET')).toBe(true);

      /* istanbul ignore else -- @preserve
       * This if is necessary to narrow the error type to a specific error. */
      if (fetch.isResponseError(error, '/users/:id', 'GET')) {
        expectTypeOf(error).toEqualTypeOf<FetchResponseError<'/users/:id', 'GET', Schema['/users/:id']['GET']>>();

        expect(error.request).toBe(response.request);
        expect(error.response).toBe(response);
        expect(error.cause).toBe(response);
      } else {
        expectTypeOf(error).toEqualTypeOf<unknown>();
      }
    });
  });
});
