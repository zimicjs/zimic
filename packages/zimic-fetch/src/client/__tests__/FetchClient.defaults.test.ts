import { HttpSchema } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { expectResponseStatus } from '@tests/utils/requests';

import createFetch from '../factory';
import { FetchDefaults, FetchOptions } from '../types/public';
import { FetchResponse, FetchRequest } from '../types/requests';

describe('FetchClient > Defaults', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
  ];

  it('should support creating a fetch client without defaults', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor.get('/users').respond({ status: 200, body: users }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      expect(fetch.defaults).toEqual<FetchDefaults>({
        baseURL,
        headers: {},
        searchParams: {},
      });

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));
    });
  });

  it('should support creating a fetch client with defaults', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers?: { 'content-type': 'application/json' };
            searchParams?: { limit: number };
            body?: { name: string };
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .with({
          headers: { 'content-type': 'application/json' },
          searchParams: { limit: '10' },
        })
        .respond({ status: 200, body: users })
        .times(1);

      const defaults = {
        baseURL,
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        searchParams: { limit: '10' },
        body: JSON.stringify({ name: 'User 1' }),
        keepalive: true,
        mode: 'cors',
        redirect: 'follow',
        priority: 'high',
        referrer: 'about:client',
        referrerPolicy: 'origin',
        signal: new AbortController().signal,
      } satisfies FetchOptions<Schema>;

      const fetch = createFetch<Schema>(defaults);

      expect(fetch.defaults).toEqual<FetchDefaults>(defaults);

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users?limit=10'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users?limit=10'));

      expect(response.request.cache).toBe(defaults.cache);
      expect(response.request.headers.get('content-type')).toBe(defaults.headers['content-type']);
      expect(response.request.credentials).toBe(defaults.credentials);
      expect(await response.request.text()).toBe(defaults.body);
      expect(response.request.keepalive).toBe(defaults.keepalive);
      expect(response.request.mode).toBe(defaults.mode);
      expect(response.request.redirect).toBe(defaults.redirect);
      expect(response.request.referrer).toBe(defaults.referrer);
      expect(response.request.referrerPolicy).toBe(defaults.referrerPolicy);
      expect(response.request.signal).toBeInstanceOf(AbortSignal);
    });
  });

  it('should support changing a fetch client defaults after it was created', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers?: { 'content-type': 'application/json' };
            searchParams?: { limit: number };
            body?: { name: string };
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .with({
          headers: { 'content-type': 'application/json' },
          searchParams: { limit: '10' },
        })
        .respond({ status: 200, body: users })
        .times(1);

      const otherBaseURL = 'http://localhost:3001';
      expect(otherBaseURL).not.toBe(baseURL);

      const fetch = createFetch<Schema>({ baseURL: otherBaseURL });

      expect(fetch.defaults).toEqual<FetchDefaults>({
        baseURL: otherBaseURL,
        headers: {},
        searchParams: {},
      });

      const defaults = {
        baseURL,
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        searchParams: { limit: '10' },
        body: JSON.stringify({ name: 'User 1' }),
        keepalive: true,
        mode: 'cors',
        redirect: 'follow',
        priority: 'high',
        referrer: 'about:client',
        referrerPolicy: 'origin',
        signal: new AbortController().signal,
      } satisfies FetchOptions<Schema>;

      fetch.defaults.baseURL = defaults.baseURL;
      fetch.defaults.cache = defaults.cache;
      fetch.defaults.credentials = defaults.credentials;
      fetch.defaults.headers['content-type'] = defaults.headers['content-type'];
      fetch.defaults.searchParams.limit = defaults.searchParams.limit;
      fetch.defaults.body = defaults.body;
      fetch.defaults.keepalive = defaults.keepalive;
      fetch.defaults.mode = defaults.mode;
      fetch.defaults.redirect = defaults.redirect;
      fetch.defaults.priority = defaults.priority;
      fetch.defaults.referrer = defaults.referrer;
      fetch.defaults.referrerPolicy = defaults.referrerPolicy;
      fetch.defaults.signal = defaults.signal;

      expect(fetch.defaults).toEqual<FetchDefaults>(defaults);

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users?limit=10'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users?limit=10'));

      expect(response.request.cache).toBe(defaults.cache);
      expect(response.request.headers.get('content-type')).toBe(defaults.headers['content-type']);
      expect(response.request.credentials).toBe(defaults.credentials);
      expect(await response.request.text()).toBe(defaults.body);
      expect(response.request.keepalive).toBe(defaults.keepalive);
      expect(response.request.mode).toBe(defaults.mode);
      expect(response.request.redirect).toBe(defaults.redirect);
      expect(response.request.referrer).toBe(defaults.referrer);
      expect(response.request.referrerPolicy).toBe(defaults.referrerPolicy);
      expect(response.request.signal).toBeInstanceOf(AbortSignal);
    });
  });

  it('should merge request headers with defaults', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers?: {
              'content-type'?: 'application/json';
              'accept-language'?: string;
            };
            searchParams?: { limit: number };
            body?: { name: string };
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .with({
          headers: {
            'content-type': 'application/json',
            'accept-language': 'en',
          },
        })
        .respond({ status: 200, body: users })
        .times(1);

      const fetch = createFetch<Schema>({
        baseURL,
        headers: { 'accept-language': 'en' },
      });

      expect(fetch.defaults).toEqual<FetchDefaults>({
        baseURL,
        headers: { 'accept-language': 'en' },
        searchParams: {},
      });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.headers.get('content-type')).toBe('application/json');
      expect(response.request.headers.get('accept-language')).toBe('en');
    });
  });

  it('should prefer request headers over defaults, if overlapping', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers?: {
              'content-type'?: 'application/json';
              'accept-language'?: string;
            };
            searchParams?: { limit: number };
            body?: { name: string };
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .with({
          headers: {
            'content-type': 'application/json',
            'accept-language': 'fr',
          },
        })
        .respond({ status: 200, body: users })
        .times(1);

      const fetch = createFetch<Schema>({
        baseURL,
        headers: { 'accept-language': 'en' },
      });

      expect(fetch.defaults).toEqual<FetchDefaults>({
        baseURL,
        headers: { 'accept-language': 'en' },
        searchParams: {},
      });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'accept-language': 'fr' },
      });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.headers.get('content-type')).toBe('application/json');
      expect(response.request.headers.get('accept-language')).toBe('fr');
    });
  });

  it('should merge search params with defaults', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: {
            searchParams: { page?: number; limit?: number; username: string[] };
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .with({ searchParams: { page: '1', limit: '10', username: ['my', 'other'] } })
        .respond({ status: 200, body: users })
        .times(1);

      const fetch = createFetch<Schema>({
        baseURL,
        searchParams: { limit: '10' },
      });

      expect(fetch.defaults).toEqual<FetchDefaults>({
        baseURL,
        headers: {},
        searchParams: { limit: '10' },
      });

      const response = await fetch('/users', {
        method: 'GET',
        searchParams: { page: '1', username: ['my', 'other'] },
      });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users?limit=10&page=1&username=my&username=other'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users?limit=10&page=1&username=my&username=other'));
    });
  });

  it('should prefer search params over defaults, if overlapping', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: {
            searchParams: { page?: number; limit?: number; username: string[] };
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .with({ searchParams: { page: '1', limit: '20', username: ['any', 'other'] } })
        .respond({ status: 200, body: users })
        .times(1);

      const fetch = createFetch<Schema>({
        baseURL,
        searchParams: { limit: '10', username: ['my', 'other'] },
      });

      expect(fetch.defaults).toEqual<FetchDefaults>({
        baseURL,
        headers: {},
        searchParams: { limit: '10', username: ['my', 'other'] },
      });

      const response = await fetch('/users', {
        method: 'GET',
        searchParams: { page: '1', limit: '20', username: ['any', 'other'] },
      });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users?limit=20&page=1&username=any&username=other'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users?limit=20&page=1&username=any&username=other'));
    });
  });
});
