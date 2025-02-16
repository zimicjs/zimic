import { describe, expect, expectTypeOf, it } from 'vitest';

import { HttpSchema, StrictHeaders, HttpSearchParams } from '@/http';
import { joinURL } from '@/utils/urls';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import createFetch from '../factory';
import { Fetch } from '../types/public';
import { FetchRequest } from '../types/requests';

describe('FetchClient (node) > Search params', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  it('should support requests with search params as object', async () => {
    type RequestSearchParams = HttpSchema.SearchParams<{
      name?: string;
    }>;

    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: { searchParams: RequestSearchParams };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, { checkTimes: true }, async (interceptor) => {
      const searchParams: RequestSearchParams = { name: 'User' };

      await interceptor
        .get('/users')
        .with({ searchParams })
        .respond({
          status: 200,
          body: users,
        })
        .times(2);

      const fetch = createFetch<Schema>({ baseURL });
      expectTypeOf(fetch).toEqualTypeOf<Fetch<Schema>>();

      const responses = [
        await fetch('/users', {
          method: 'GET',
          searchParams,
        }),
      ];

      const request = new fetch.Request('/users', {
        method: 'GET',
        searchParams,
      });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<'/users', 'GET', Schema['/users']['GET']>>();

      expect(request.url).toBe(joinURL(baseURL, '/users?name=User'));

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

      responses.push(await fetch(request));

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expect(response.status).toBe(200);

        expect(await response.json()).toEqual(users);
      }
    });
  });

  it('should support requests with search params as instance', async () => {
    type RequestSearchParams = HttpSchema.SearchParams<{
      name?: string;
    }>;

    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: { searchParams: RequestSearchParams };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, { checkTimes: true }, async (interceptor) => {
      const searchParams = new HttpSearchParams<RequestSearchParams>({ name: 'User' });

      await interceptor
        .get('/users')
        .with({ searchParams })
        .respond({
          status: 200,
          body: users,
        })
        .times(2);

      const fetch = createFetch<Schema>({ baseURL });
      expectTypeOf(fetch).toEqualTypeOf<Fetch<Schema>>();

      const responses = [
        await fetch('/users', {
          method: 'GET',
          searchParams,
        }),
      ];

      const request = new fetch.Request('/users', {
        method: 'GET',
        searchParams,
      });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<'/users', 'GET', Schema['/users']['GET']>>();

      expect(request.url).toBe(joinURL(baseURL, '/users?name=User'));

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

      responses.push(await fetch(request));

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expect(response.status).toBe(200);

        expect(await response.json()).toEqual(users);
      }
    });
  });

  it('should support requests with search params containing invalid types', async () => {
    type RequestSearchParams = HttpSchema.SearchParams<{
      name: string;
      usernames: string[];
      orderBy?: ('name' | 'createdAt')[];
      date: Date; // Forcing an invalid type
      method: () => void; // Forcing an invalid type
    }>;

    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: { searchParams: RequestSearchParams };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, { checkTimes: true }, async (interceptor) => {
      expectTypeOf<RequestSearchParams>().toEqualTypeOf<{
        name: string;
        usernames: string[];
        orderBy?: ('name' | 'createdAt')[];
      }>();

      const searchParams: RequestSearchParams = {
        name: 'User',
        usernames: ['User 1', 'User 2'],
        orderBy: ['name'],
      };

      await interceptor
        .get('/users')
        .with({ searchParams })
        .respond({
          status: 200,
          body: users,
        })
        .times(2);

      const fetch = createFetch<Schema>({ baseURL });
      expectTypeOf(fetch).toEqualTypeOf<Fetch<Schema>>();

      const responses = [
        await fetch('/users', {
          method: 'GET',
          searchParams,
        }),
      ];

      const request = new fetch.Request('/users', {
        method: 'GET',
        searchParams,
      });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<'/users', 'GET', Schema['/users']['GET']>>();

      expect(request.url).toBe(joinURL(baseURL, '/users?name=User&usernames=User+1&usernames=User+2&orderBy=name'));

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

      responses.push(await fetch(request));

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expect(response.status).toBe(200);

        expect(await response.json()).toEqual(users);
      }
    });
  });

  it('should support requests with no search params', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: { body: User[] } };
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
        .times(8);

      const fetch = createFetch<Schema>({ baseURL });
      expectTypeOf(fetch).toEqualTypeOf<Fetch<Schema>>();

      const responses = [
        await fetch('/users', { method: 'GET' }),
        await fetch('/users', { method: 'GET', searchParams: undefined }),
        // @ts-expect-error Forcing the search params to be defined
        await fetch('/users', { method: 'GET', searchParams: {} }),
        // @ts-expect-error Forcing the search params to be defined
        await fetch('/users', { method: 'GET', searchParams: new HttpSearchParams() }),
      ];

      for (const request of [
        new fetch.Request('/users', { method: 'GET' }),
        new fetch.Request('/users', { method: 'GET', searchParams: undefined }),
        // @ts-expect-error Forcing the search params to be defined
        new fetch.Request('/users', { method: 'GET', searchParams: {} }),
        // @ts-expect-error Forcing the search params to be defined
        new fetch.Request('/users', { method: 'GET', searchParams: new HttpSearchParams() }),
      ]) {
        expect(request).toBeInstanceOf(Request);
        expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<'/users', 'GET', Schema['/users']['GET']>>();

        expect(request.url).toBe(joinURL(baseURL, '/users'));

        expect(request.headers).toBeInstanceOf(Headers);
        expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(request.json).toEqualTypeOf<() => Promise<null>>();
        expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

        responses.push(await fetch(request));
      }

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expect(response.status).toBe(200);

        expect(await response.json()).toEqual(users);
      }
    });
  });
});
