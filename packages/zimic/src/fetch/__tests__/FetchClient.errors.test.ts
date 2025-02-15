import { describe, expect, expectTypeOf, it } from 'vitest';

import { HttpSchema } from '@/http';
import { joinURL } from '@/utils/urls';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import FetchResponseError from '../errors/FetchResponseError';
import createFetch from '../factory';
import { FetchResponse, FetchResponsePerStatusCode } from '../types/requests';

describe('FetchClient (node) > Errors', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
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
});
