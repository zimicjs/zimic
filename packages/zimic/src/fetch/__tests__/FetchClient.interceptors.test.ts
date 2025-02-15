import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { HttpMethod, HttpSchema, StrictHeaders } from '@/http';
import { Default } from '@/types/utils';
import { joinURL } from '@/utils/urls';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import createFetch from '../factory';
import { Fetch } from '../types/public';
import { FetchRequest, FetchResponse } from '../types/requests';

describe('FetchClient (node) > Interceptors', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  it('should support intercepting requests', async () => {
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
        .times(1);

      const onRequest = vi.fn<Default<Fetch<Schema>['onRequest']>>((request, fetchSelf) => {
        expect(request).toBeInstanceOf(Request);
        expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest.Loose>();

        expect(request.url).toBe(joinURL(baseURL, '/users'));

        expect(request.path).toBe('/users');
        expectTypeOf(request.path).toEqualTypeOf<string>();

        expect(request.method).toBe('GET');
        expectTypeOf(request.method).toEqualTypeOf<HttpMethod>();

        expect(request.headers).toBeInstanceOf(Headers);
        expectTypeOf(request.headers).toEqualTypeOf<Headers>();

        // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-explicit-any
        expectTypeOf(request.json).toEqualTypeOf<() => Promise<any>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        expectTypeOf(fetchSelf).toEqualTypeOf(fetch);

        if (fetchSelf.isRequest(request, '/users', 'GET')) {
          expect(request).toBeInstanceOf(Request);
          expectTypeOf(request satisfies Request).toEqualTypeOf<
            FetchRequest<'/users', 'GET', Schema['/users']['GET']>
          >();
        }

        return request;
      });

      const fetch = createFetch<Schema>({
        baseURL,
        onRequest,
      });

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();

      expect(onRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('should support intercepting and modifying requests', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: {
            headers?: { 'accept-language'?: string };
          };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .with({
          headers: { 'accept-language': 'en' },
        })
        .respond({
          status: 200,
          body: users,
        })
        .times(1);

      const onRequest = vi.fn<Default<Fetch<Schema>['onRequest']>>((request) => {
        request.headers.set('accept-language', 'en');
        return request;
      });

      const fetch = createFetch<Schema>({
        baseURL,
        onRequest,
      });

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

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
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'accept-language'?: string }>>();

      expect(onRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('should support intercepting and creating modified requests', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: {
            headers?: { 'accept-language'?: string };
            searchParams?: { page?: number; limit?: number };
          };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .with({
          headers: { 'accept-language': 'en' },
          searchParams: { page: '1', limit: '10' },
        })
        .respond({
          status: 200,
          body: users,
        })
        .times(1);

      const onRequest = vi.fn<Default<Fetch<Schema>['onRequest']>>((request) => {
        const updatedURL = new URL(request.url);
        updatedURL.searchParams.set('page', '1');
        updatedURL.searchParams.set('limit', '10');

        const updatedRequest = new Request(updatedURL, request);
        updatedRequest.headers.set('accept-language', 'en');

        return updatedRequest;
      });

      const fetch = createFetch<Schema>({
        baseURL,
        onRequest,
      });

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users?page=1&limit=10'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users?page=1&limit=10'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'accept-language'?: string }>>();

      expect(onRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('should support intercepting responses', async () => {
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
        .times(1);

      const onResponse = vi.fn<Default<Fetch<Schema>['onResponse']>>((response, fetchSelf) => {
        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse.Loose>();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<Headers>();

        // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-explicit-any
        expectTypeOf(response.json).toEqualTypeOf<() => Promise<any>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest.Loose>();

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<string>();

        expect(response.request.method).toBe('GET');
        expectTypeOf(response.request.method).toEqualTypeOf<HttpMethod>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<Headers>();

        // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-explicit-any
        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<any>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        expectTypeOf(fetchSelf).toEqualTypeOf(fetch);

        if (fetchSelf.isResponse(response, '/users', 'GET')) {
          expect(response).toBeInstanceOf(Response);
          expectTypeOf(response satisfies Response).toEqualTypeOf<
            FetchResponse<'/users', 'GET', Schema['/users']['GET']>
          >();
        }

        return response;
      });

      const fetch = createFetch<Schema>({
        baseURL,
        onResponse,
      });

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
    });
  });

  it('should support intercepting and creating modified responses', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: {
              headers?: { 'content-language'?: string };
              body: User[];
            };
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

      const onResponse = vi.fn<Default<Fetch<Schema>['onResponse']>>((response) => {
        const updatedHeaders = new Headers(response.headers);
        updatedHeaders.set('content-language', 'en');

        const updatedResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: updatedHeaders,
        });

        return updatedResponse;
      });

      const fetch = createFetch<Schema>({
        baseURL,
        onResponse,
      });

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.url).toBe('');

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-language'?: string }>>();
      expect(response.headers.get('content-language')).toBe('en');

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
    });
  });
});
