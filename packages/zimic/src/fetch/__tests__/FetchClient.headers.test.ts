import { describe, expect, expectTypeOf, it } from 'vitest';

import { HttpSchema, StrictHeaders, HttpHeaders } from '@/http';
import { joinURL } from '@/utils/urls';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import createFetch from '../factory';
import { Fetch } from '../types/public';
import { FetchRequest, FetchResponse } from '../types/requests';

describe('FetchClient (node) > Headers', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  it('should support requests with headers as object', async () => {
    type RequestHeaders = HttpSchema.Headers<{
      'content-type': string;
    }>;

    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: { headers: RequestHeaders };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      const headers: RequestHeaders = {
        'content-type': 'application/json',
      };

      await interceptor
        .get('/users')
        .with({ headers })
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
          headers,
        }),
      ];

      const request = new fetch.Request('/users', {
        method: 'GET',
        headers,
      });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<'/users', 'GET', Schema['/users']['GET']>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('GET');
      expectTypeOf(request.method).toEqualTypeOf<'GET'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<RequestHeaders>>();

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

  it('should support requests with headers as instance', async () => {
    type RequestHeaders = HttpSchema.Headers<{
      'content-type': string;
    }>;

    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: { headers: RequestHeaders };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      const headers = new HttpHeaders<RequestHeaders>({ 'content-type': 'application/json' });

      await interceptor
        .get('/users')
        .with({ headers })
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
          headers,
        }),
      ];

      const request = new fetch.Request('/users', {
        method: 'GET',
        headers,
      });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<'/users', 'GET', Schema['/users']['GET']>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('GET');
      expectTypeOf(request.method).toEqualTypeOf<'GET'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<RequestHeaders>>();

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

  it('should support requests with headers containing invalid types', async () => {
    type RequestHeaders = HttpSchema.Headers<{
      'content-type': string;
      date: Date; // Forcing an invalid type
      method: () => void; // Forcing an invalid type
    }>;

    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: { headers: RequestHeaders };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      expectTypeOf<RequestHeaders>().toEqualTypeOf<{
        'content-type': string;
      }>();

      const headers: RequestHeaders = {
        'content-type': 'application/json',
      };

      await interceptor
        .get('/users')
        .with({ headers })
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
          headers,
        }),
      ];

      const request = new fetch.Request('/users', {
        method: 'GET',
        headers,
      });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<'/users', 'GET', Schema['/users']['GET']>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('GET');
      expectTypeOf(request.method).toEqualTypeOf<'GET'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<RequestHeaders>>();

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

  it('should support requests with no headers', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: { body: User[] } };
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
        .times(8);

      const fetch = createFetch<Schema>({ baseURL });
      expectTypeOf(fetch).toEqualTypeOf<Fetch<Schema>>();

      const responses = [
        await fetch('/users', { method: 'GET' }),
        await fetch('/users', { method: 'GET', headers: undefined }),
        // @ts-expect-error Forcing the headers to be defined
        await fetch('/users', { method: 'GET', headers: {} }),
        // @ts-expect-error Forcing the headers to be defined
        await fetch('/users', { method: 'GET', headers: new HttpHeaders() }),
      ];

      for (const request of [
        new fetch.Request('/users', { method: 'GET' }),
        new fetch.Request('/users', { method: 'GET', headers: undefined }),
        // @ts-expect-error Forcing the headers to be defined
        new fetch.Request('/users', { method: 'GET', headers: {} }),
        // @ts-expect-error Forcing the headers to be defined
        new fetch.Request('/users', { method: 'GET', headers: new HttpHeaders() }),
      ]) {
        expect(request).toBeInstanceOf(Request);
        expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<'/users', 'GET', Schema['/users']['GET']>>();

        expect(request.url).toBe(joinURL(baseURL, '/users'));

        expect(request.path).toBe('/users');
        expectTypeOf(request.path).toEqualTypeOf<'/users'>();

        expect(request.method).toBe('GET');
        expectTypeOf(request.method).toEqualTypeOf<'GET'>();

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

  it('should support responses with headers as object', async () => {
    type ResponseHeaders = HttpSchema.Headers<{
      'content-type': string;
    }>;

    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: { headers: ResponseHeaders; body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      const headers: ResponseHeaders = {
        'content-type': 'application/json',
      };

      await interceptor
        .get('/users')
        .respond({
          status: 200,
          body: users,
          headers,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });
      expectTypeOf(fetch).toEqualTypeOf<Fetch<Schema>>();

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<ResponseHeaders>>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();
    });
  });

  it('should support responses with headers as instance', async () => {
    type ResponseHeaders = HttpSchema.Headers<{
      'content-type': string;
    }>;

    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: { headers: ResponseHeaders; body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      const headers = new HttpHeaders<ResponseHeaders>({ 'content-type': 'application/json' });

      await interceptor
        .get('/users')
        .respond({
          status: 200,
          body: users,
          headers,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });
      expectTypeOf(fetch).toEqualTypeOf<Fetch<Schema>>();

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<ResponseHeaders>>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();
    });
  });

  it('should support responses with headers containing invalid types', async () => {
    type ResponseHeaders = HttpSchema.Headers<{
      'content-type': string;
      date: Date; // Forcing an invalid type
      method: () => void; // Forcing an invalid type
    }>;

    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: { headers: ResponseHeaders; body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      expectTypeOf<ResponseHeaders>().toEqualTypeOf<{
        'content-type': string;
      }>();

      const headers: ResponseHeaders = {
        'content-type': 'application/json',
      };

      await interceptor
        .get('/users')
        .respond({
          status: 200,
          body: users,
          headers,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });
      expectTypeOf(fetch).toEqualTypeOf<Fetch<Schema>>();

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<ResponseHeaders>>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();
    });
  });

  it('should support responses with no headers', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: { body: User[] } };
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
        .times(4);

      const fetch = createFetch<Schema>({ baseURL });
      expectTypeOf(fetch).toEqualTypeOf<Fetch<Schema>>();

      const responses = [
        await fetch('/users', { method: 'GET' }),
        await fetch('/users', { method: 'GET', headers: undefined }),
        // @ts-expect-error Forcing the headers to be defined
        await fetch('/users', { method: 'GET', headers: {} }),
        // @ts-expect-error Forcing the headers to be defined
        await fetch('/users', { method: 'GET', headers: new HttpHeaders() }),
      ];

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expect(response.status).toBe(200);

        expect(await response.json()).toEqual(users);

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'GET', Schema['/users']['GET']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'GET', Schema['/users']['GET']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('GET');
        expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();
      }
    });
  });
});
