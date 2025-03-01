import { HttpHeaders, HttpSchema, HttpSearchParams, StrictHeaders } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import { Default } from '@zimic/utils/types';
import joinURL from '@zimic/utils/url/joinURL';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import createFetch from '../factory';
import { Fetch } from '../types/public';
import { FetchRequest, FetchResponse } from '../types/requests';

describe('FetchClient > Listeners', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
  ];

  it('should support listening to requests', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: { 200: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .respond({
          status: 200,
          body: users[0],
        })
        .times(1);

      const onRequest = vi.fn<Default<Fetch<Schema>['onRequest']>>(async function (
        this: Fetch<Schema>,
        request: FetchRequest.Loose,
      ) {
        expect(request).toBeInstanceOf(Request);
        expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest.Loose>();

        expect(request.url).toBe(joinURL(baseURL, '/users'));

        expect(request.headers).toBeInstanceOf(Headers);
        expectTypeOf(request.headers).toEqualTypeOf<Headers>();

        // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-explicit-any
        expectTypeOf(request.json).toEqualTypeOf<() => Promise<any>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        expectTypeOf(this).toEqualTypeOf(fetch);

        expect(this.isRequest(request, 'POST', '/users')).toBe(true);

        /* istanbul ignore else -- @preserve
         * This else is necessary to narrow the error type to a specific error. */
        if (this.isRequest(request, 'POST', '/users')) {
          expect(request).toBeInstanceOf(Request);
          expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

          const requestClone = request.clone();
          expectTypeOf(requestClone).toEqualTypeOf(request);

          expect(requestClone.url).toBe(request.url);
          expect(requestClone.path).toBe(request.path);
          expect(requestClone.method).toBe(request.method);
          expect(requestClone.headers).toEqual(request.headers);

          const body = await requestClone.json();
          expectTypeOf(body).toEqualTypeOf<User>();
          expect(body).toEqual(users[0]);
        } else {
          expectTypeOf(request).toEqualTypeOf<FetchRequest.Loose>();
        }

        return request;
      });

      const fetch = createFetch<Schema>({
        baseURL,
        onRequest,
      });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(users[0]),
      });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users[0]);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(onRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('should support listening to requests with path params', async () => {
    type Schema = HttpSchema<{
      '/users/:id': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: { 200: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .post(`/users/${users[0].id}`)
        .respond({
          status: 200,
          body: users[0],
        })
        .times(1);

      const onRequest = vi.fn<Default<Fetch<Schema>['onRequest']>>(async function (
        this: Fetch<Schema>,
        request: FetchRequest.Loose,
      ) {
        expect(request).toBeInstanceOf(Request);
        expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest.Loose>();

        expect(request.url).toBe(joinURL(baseURL, `/users/${users[0].id}`));

        expect(request.headers).toBeInstanceOf(Headers);
        expectTypeOf(request.headers).toEqualTypeOf<Headers>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/unbound-method
        expectTypeOf(request.json).toEqualTypeOf<() => Promise<any>>();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        expectTypeOf(this).toEqualTypeOf(fetch);

        expect(this.isRequest(request, 'POST', '/users/:id')).toBe(true);

        /* istanbul ignore else -- @preserve
         * This else is necessary to narrow the error type to a specific error. */
        if (this.isRequest(request, 'POST', '/users/:id')) {
          expect(request).toBeInstanceOf(Request);
          expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users/:id'>>();

          const requestClone = request.clone();
          expectTypeOf(requestClone).toEqualTypeOf(request);

          expect(requestClone.url).toBe(request.url);
          expect(requestClone.path).toBe(request.path);
          expect(requestClone.method).toBe(request.method);
          expect(requestClone.headers).toEqual(request.headers);

          const body = await requestClone.json();
          expectTypeOf(body).toEqualTypeOf<User>();
          expect(body).toEqual(users[0]);
        } else {
          expectTypeOf(request).toEqualTypeOf<FetchRequest.Loose>();
        }

        return request;
      });

      const fetch = createFetch<Schema>({
        baseURL,
        onRequest,
      });

      const response = await fetch(`/users/${users[0].id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(users[0]),
      });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users[0]);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users/:id'>>();

      expect(response.url).toBe(joinURL(baseURL, `/users/${users[0].id}`));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users/:id'>>();

      expect(response.request.url).toBe(joinURL(baseURL, `/users/${users[0].id}`));

      expect(onRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('should support listening to and modifying requests', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers?: { 'accept-language'?: string };
          };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
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

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'accept-language'?: string }>>();
      expect(response.request.headers.get('accept-language')).toBe('en');

      expect(onRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('should support listening to and creating modified fetch requests', async () => {
    type HeadersSchema = HttpSchema.Headers<{
      'accept-language'?: string;
    }>;

    type SearchParamsSchema = HttpSchema.SearchParams<{
      page?: number;
      limit?: number;
    }>;

    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers?: HeadersSchema;
            searchParams?: SearchParamsSchema;
          };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .with({
          headers: { 'accept-language': 'en' },
          searchParams: { page: '1', limit: '10' },
        })
        .respond({
          status: 200,
          body: users,
        })
        .times(1);

      const onRequest = vi.fn<Default<Fetch<Schema>['onRequest']>>(function (
        this: Fetch<Schema>,
        request: FetchRequest.Loose,
      ) {
        if (this.isRequest(request, 'POST', '/users')) {
          const headers = new HttpHeaders<HeadersSchema>(request.headers);
          headers.set('accept-language', 'en');

          const url = new URL(request.url);
          const searchParams = new HttpSearchParams<SearchParamsSchema>(url.search);
          searchParams.set('page', '1');
          searchParams.set('limit', '10');

          const updatedRequest = new this.Request('/users', {
            method: 'POST',
            headers,
            searchParams,
          });

          return updatedRequest;
        }

        return request;
      });

      const fetch = createFetch<Schema>({
        baseURL,
        onRequest,
      });

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users?page=1&limit=10'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users?page=1&limit=10'));

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'accept-language'?: string }>>();
      expect(response.request.headers.get('accept-language')).toBe('en');

      expect(onRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('should support listening to and creating modified raw requests', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
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
        .post('/users')
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

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users?page=1&limit=10'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users?page=1&limit=10'));

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'accept-language'?: string }>>();
      expect(response.request.headers.get('accept-language')).toBe('en');

      expect(onRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('should support changing an `onRequest` listener after the fetch was created', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers?: { 'accept-language'?: string };
          };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .with({
          headers: { 'accept-language': 'en' },
        })
        .respond({
          status: 200,
          body: users,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });
      expect(fetch.onRequest).toBe(undefined);

      const onRequest = vi.fn<Default<Fetch<Schema>['onRequest']>>((request) => {
        request.headers.set('accept-language', 'en');
        return request;
      });

      const responseBeforeListener = fetch('/users', { method: 'POST' });
      await expectFetchError(responseBeforeListener);

      fetch.onRequest = onRequest;

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'accept-language'?: string }>>();
      expect(response.request.headers.get('accept-language')).toBe('en');

      expect(onRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('should support listening to responses', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .respond({
          status: 200,
          body: users,
        })
        .times(1);

      const onResponse = vi.fn<Default<Fetch<Schema>['onResponse']>>(function (
        this: Fetch<Schema>,
        response: FetchResponse.Loose,
      ) {
        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse.Loose>();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<Headers>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/unbound-method
        expectTypeOf(response.json).toEqualTypeOf<() => Promise<any>>();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest.Loose>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<Headers>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/unbound-method
        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<any>>();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        expectTypeOf(this).toEqualTypeOf(fetch);

        expect(this.isResponse(response, 'POST', '/users')).toBe(true);

        /* istanbul ignore else -- @preserve
         * This else is necessary to narrow the error type to a specific error. */
        if (this.isResponse(response, 'POST', '/users')) {
          expect(response).toBeInstanceOf(Response);
          expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();
        } else {
          expectTypeOf(response).toEqualTypeOf<FetchResponse.Loose>();
        }

        return response;
      });

      const fetch = createFetch<Schema>({
        baseURL,
        onResponse,
      });

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(onResponse).toHaveBeenCalledTimes(1);
    });
  });

  it('should support listening to responses with path params', async () => {
    type Schema = HttpSchema<{
      '/users/:id': {
        POST: {
          response: { 200: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .post(`/users/${users[0].id}`)
        .respond({
          status: 200,
          body: users[0],
        })
        .times(1);

      const onResponse = vi.fn<Default<Fetch<Schema>['onResponse']>>(function (
        this: Fetch<Schema>,
        response: FetchResponse.Loose,
      ) {
        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse.Loose>();

        expect(response.url).toBe(joinURL(baseURL, `/users/${users[0].id}`));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<Headers>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/unbound-method
        expectTypeOf(response.json).toEqualTypeOf<() => Promise<any>>();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest.Loose>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<Headers>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/unbound-method
        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<any>>();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        expectTypeOf(this).toEqualTypeOf(fetch);

        expect(this.isResponse(response, 'POST', '/users/:id')).toBe(true);

        /* istanbul ignore else -- @preserve
         * This else is necessary to narrow the error type to a specific error. */
        if (this.isResponse(response, 'POST', '/users/:id')) {
          expect(response).toBeInstanceOf(Response);
          expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users/:id'>>();
        } else {
          expectTypeOf(response).toEqualTypeOf<FetchResponse.Loose>();
        }

        return response;
      });

      const fetch = createFetch<Schema>({
        baseURL,
        onResponse,
      });

      const response = await fetch(`/users/${users[0].id}`, { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users[0]);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users/:id'>>();

      expect(response.url).toBe(joinURL(baseURL, `/users/${users[0].id}`));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users/:id'>>();

      expect(response.request.url).toBe(joinURL(baseURL, `/users/${users[0].id}`));

      expect(onResponse).toHaveBeenCalledTimes(1);
    });
  });

  it('should support listening to and creating modified raw responses', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
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
        .post('/users')
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

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe('');

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-language'?: string }>>();
      expect(response.headers.get('content-language')).toBe('en');

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(onResponse).toHaveBeenCalledTimes(1);
    });
  });

  it('should support changing an `onResponse` listener after the fetch was created', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
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
        .post('/users')
        .respond({
          status: 200,
          body: users,
        })
        .times(2);

      const fetch = createFetch<Schema>({ baseURL });

      const responseBeforeListener = await fetch('/users', { method: 'POST' });
      expect(responseBeforeListener.headers.has('content-language')).toBe(false);

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

      fetch.onResponse = onResponse;

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe('');

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-language'?: string }>>();
      expect(response.headers.get('content-language')).toBe('en');

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(onResponse).toHaveBeenCalledTimes(1);
    });
  });
});
