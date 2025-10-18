import { HttpSchema } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { expectResponseStatus } from '@tests/utils/requests';

import createFetch from '../factory';
import { FetchOptions } from '../types/public';
import { FetchResponse, FetchRequest } from '../types/requests';

describe('FetchClient > Defaults', () => {
  const baseURL = 'http://localhost:4000';

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

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.get('/users').respond({ status: 200, body: users }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      expect(fetch.baseURL).toBe(baseURL);
      expect(fetch.headers).toEqual({});
      expect(fetch.searchParams).toEqual({});
      expect(fetch.body).toBe(undefined);
      expect(fetch.mode).toBe(undefined);
      expect(fetch.cache).toBe(undefined);
      expect(fetch.credentials).toBe(undefined);
      expect(fetch.integrity).toBe(undefined);
      expect(fetch.keepalive).toBe(undefined);
      expect(fetch.priority).toBe(undefined);
      expect(fetch.redirect).toBe(undefined);
      expect(fetch.referrer).toBe(undefined);
      expect(fetch.referrerPolicy).toBe(undefined);
      expect(fetch.signal).toBe(undefined);
      expect(fetch.window).toBe(undefined);
      expect(fetch.duplex).toBe(undefined);

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
            searchParams?: {
              orderBy?: 'name:asc';
              limit?: number;
              full?: boolean;
            };
            body?: { name: string };
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .with({
          headers: { 'content-type': 'application/json' },
          searchParams: {
            orderBy: 'name:asc',
            limit: 10,
            full: true,
          },
        })
        .respond({ status: 200, body: users })
        .times(1);

      const defaults = {
        baseURL,
        headers: { 'content-type': 'application/json' },
        searchParams: { orderBy: 'name:asc', limit: 10, full: true },
        body: JSON.stringify({ name: 'User 1' }),
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        integrity: '',
        keepalive: true,
        priority: 'high',
        redirect: 'follow',
        referrer: 'about:client',
        referrerPolicy: 'origin',
        signal: new AbortController().signal,
        window: null,
        duplex: 'half',
      } satisfies FetchOptions<Schema>;

      const fetch = createFetch<Schema>(defaults);

      expect(fetch.baseURL).toBe(defaults.baseURL);
      expect(fetch.headers).toEqual(defaults.headers);
      expect(fetch.searchParams).toEqual(defaults.searchParams);
      expect(fetch.body).toBe(defaults.body);
      expect(fetch.mode).toBe(defaults.mode);
      expect(fetch.cache).toBe(defaults.cache);
      expect(fetch.credentials).toBe(defaults.credentials);
      expect(fetch.integrity).toBe(defaults.integrity);
      expect(fetch.keepalive).toBe(defaults.keepalive);
      expect(fetch.priority).toBe(defaults.priority);
      expect(fetch.redirect).toBe(defaults.redirect);
      expect(fetch.referrer).toBe(defaults.referrer);
      expect(fetch.referrerPolicy).toBe(defaults.referrerPolicy);
      expect(fetch.signal).toBe(defaults.signal);
      expect(fetch.window).toBe(defaults.window);
      expect(fetch.duplex).toBe(defaults.duplex);

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(
        joinURL(baseURL, `/users?orderBy=${encodeURIComponent('name:asc')}&limit=10&full=true`),
      );

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(
        joinURL(baseURL, `/users?orderBy=${encodeURIComponent('name:asc')}&limit=10&full=true`),
      );

      expect(response.request.cache).toBe(defaults.cache);
      expect(response.request.headers.get('content-type')).toBe(defaults.headers['content-type']);
      expect(response.request.credentials).toBe(defaults.credentials);
      expect(await response.request.text()).toBe(defaults.body);
      expect(response.request.integrity).toBe(defaults.integrity);
      expect(response.request.keepalive).toBe(defaults.keepalive);
      expect(response.request.mode).toBe(defaults.mode);
      expect(response.request.redirect).toBe(defaults.redirect);
      expect(response.request.referrer).toBe(defaults.referrer);
      expect(response.request.referrerPolicy).toBe(defaults.referrerPolicy);
      expect(response.request.signal).toBeInstanceOf(AbortSignal);
    });
  });

  it('should support creating a fetch client with defaults using `fetch.defaults`', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers?: { 'content-type': 'application/json' };
            searchParams?: {
              orderBy?: 'name:asc';
              limit?: number;
              full?: boolean;
            };
            body?: { name: string };
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .with({
          headers: { 'content-type': 'application/json' },
          searchParams: {
            orderBy: 'name:asc',
            limit: 10,
            full: true,
          },
        })
        .respond({ status: 200, body: users })
        .times(1);

      const defaults = {
        baseURL,
        headers: { 'content-type': 'application/json' },
        searchParams: { orderBy: 'name:asc', limit: 10, full: true },
        body: JSON.stringify({ name: 'User 1' }),
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        integrity: '',
        keepalive: true,
        priority: 'high',
        redirect: 'follow',
        referrer: 'about:client',
        referrerPolicy: 'origin',
        signal: new AbortController().signal,
        window: null,
        duplex: 'half',
      } satisfies FetchOptions<Schema>;

      const fetch = createFetch<Schema>(defaults);

      expect(fetch.defaults.baseURL).toBe(defaults.baseURL); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.headers).toEqual(defaults.headers); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.searchParams).toEqual(defaults.searchParams); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.body).toBe(defaults.body); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.mode).toBe(defaults.mode); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.cache).toBe(defaults.cache); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.credentials).toBe(defaults.credentials); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.integrity).toBe(defaults.integrity); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.keepalive).toBe(defaults.keepalive); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.priority).toBe(defaults.priority); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.redirect).toBe(defaults.redirect); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.referrer).toBe(defaults.referrer); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.referrerPolicy).toBe(defaults.referrerPolicy); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.signal).toBe(defaults.signal); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.window).toBe(defaults.window); // eslint-disable-line @typescript-eslint/no-deprecated
      expect(fetch.defaults.duplex).toBe(defaults.duplex); // eslint-disable-line @typescript-eslint/no-deprecated

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(
        joinURL(baseURL, `/users?orderBy=${encodeURIComponent('name:asc')}&limit=10&full=true`),
      );

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(
        joinURL(baseURL, `/users?orderBy=${encodeURIComponent('name:asc')}&limit=10&full=true`),
      );

      expect(response.request.cache).toBe(defaults.cache);
      expect(response.request.headers.get('content-type')).toBe(defaults.headers['content-type']);
      expect(response.request.credentials).toBe(defaults.credentials);
      expect(await response.request.text()).toBe(defaults.body);
      expect(response.request.integrity).toBe(defaults.integrity);
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
            searchParams?: {
              orderBy?: 'name:asc';
              limit?: number;
              full?: boolean;
            };
            body?: { name: string };
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .with({
          headers: { 'content-type': 'application/json' },
          searchParams: {
            orderBy: 'name:asc',
            limit: 10,
            full: true,
          },
        })
        .respond({ status: 200, body: users })
        .times(1);

      const otherBaseURL = 'http://localhost:4001';
      expect(otherBaseURL).not.toBe(baseURL);

      const fetch = createFetch<Schema>({ baseURL: otherBaseURL });

      expect(fetch.baseURL).toBe(otherBaseURL);
      expect(fetch.headers).toEqual({});
      expect(fetch.searchParams).toEqual({});

      const defaults = {
        baseURL,
        headers: { 'content-type': 'application/json' },
        searchParams: { orderBy: 'name:asc', limit: 10, full: true },
        body: JSON.stringify({ name: 'User 1' }),
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        integrity: '',
        keepalive: true,
        priority: 'high',
        redirect: 'follow',
        referrer: 'about:client',
        referrerPolicy: 'origin',
        signal: new AbortController().signal,
        window: null,
        duplex: 'half',
      } satisfies FetchOptions<Schema>;

      fetch.baseURL = defaults.baseURL;
      expect(fetch.baseURL).toBe(defaults.baseURL);

      fetch.headers['content-type'] = defaults.headers['content-type'];
      expect(fetch.headers).toEqual(defaults.headers);

      fetch.searchParams = defaults.searchParams;
      expect(fetch.searchParams).toEqual(defaults.searchParams);

      fetch.body = defaults.body;
      expect(fetch.body).toBe(defaults.body);

      fetch.mode = defaults.mode;
      expect(fetch.mode).toBe(defaults.mode);

      fetch.cache = defaults.cache;
      expect(fetch.cache).toBe(defaults.cache);

      fetch.credentials = defaults.credentials;
      expect(fetch.credentials).toBe(defaults.credentials);

      fetch.integrity = defaults.integrity;
      expect(fetch.integrity).toBe(defaults.integrity);

      fetch.keepalive = defaults.keepalive;
      expect(fetch.keepalive).toBe(defaults.keepalive);

      fetch.priority = defaults.priority;
      expect(fetch.priority).toBe(defaults.priority);

      fetch.redirect = defaults.redirect;
      expect(fetch.redirect).toBe(defaults.redirect);

      fetch.referrer = defaults.referrer;
      expect(fetch.referrer).toBe(defaults.referrer);

      fetch.referrerPolicy = defaults.referrerPolicy;
      expect(fetch.referrerPolicy).toBe(defaults.referrerPolicy);

      fetch.signal = defaults.signal;
      expect(fetch.signal).toBe(defaults.signal);

      fetch.window = defaults.window;
      expect(fetch.window).toBe(defaults.window);

      fetch.duplex = defaults.duplex;
      expect(fetch.duplex).toBe(defaults.duplex);

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(
        joinURL(baseURL, `/users?orderBy=${encodeURIComponent('name:asc')}&limit=10&full=true`),
      );

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(
        joinURL(baseURL, `/users?orderBy=${encodeURIComponent('name:asc')}&limit=10&full=true`),
      );

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

  it('should support changing a fetch client defaults after it was created using `fetch.defaults`', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers?: { 'content-type': 'application/json' };
            searchParams?: {
              orderBy?: 'name:asc';
              limit?: number;
              full?: boolean;
            };
            body?: { name: string };
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .with({
          headers: { 'content-type': 'application/json' },
          searchParams: {
            orderBy: 'name:asc',
            limit: 10,
            full: true,
          },
        })
        .respond({ status: 200, body: users })
        .times(1);

      const otherBaseURL = 'http://localhost:4001';
      expect(otherBaseURL).not.toBe(baseURL);

      const fetch = createFetch<Schema>({ baseURL: otherBaseURL });

      expect(fetch.baseURL).toBe(otherBaseURL);
      expect(fetch.headers).toEqual({});
      expect(fetch.searchParams).toEqual({});

      const defaults = {
        baseURL,
        headers: { 'content-type': 'application/json' },
        searchParams: { orderBy: 'name:asc', limit: 10, full: true },
        body: JSON.stringify({ name: 'User 1' }),
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        integrity: '',
        keepalive: true,
        priority: 'high',
        redirect: 'follow',
        referrer: 'about:client',
        referrerPolicy: 'origin',
        signal: new AbortController().signal,
        window: null,
        duplex: 'half',
      } satisfies FetchOptions<Schema>;

      fetch.baseURL = defaults.baseURL;
      expect(fetch.defaults.baseURL).toBe(defaults.baseURL); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.headers['content-type'] = defaults.headers['content-type'];
      expect(fetch.defaults.headers).toEqual(defaults.headers); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.searchParams = defaults.searchParams;
      expect(fetch.defaults.searchParams).toEqual(defaults.searchParams); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.body = defaults.body;
      expect(fetch.defaults.body).toBe(defaults.body); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.mode = defaults.mode;
      expect(fetch.defaults.mode).toBe(defaults.mode); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.cache = defaults.cache;
      expect(fetch.defaults.cache).toBe(defaults.cache); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.credentials = defaults.credentials;
      expect(fetch.defaults.credentials).toBe(defaults.credentials); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.integrity = defaults.integrity;
      expect(fetch.defaults.integrity).toBe(defaults.integrity); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.keepalive = defaults.keepalive;
      expect(fetch.defaults.keepalive).toBe(defaults.keepalive); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.priority = defaults.priority;
      expect(fetch.defaults.priority).toBe(defaults.priority); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.redirect = defaults.redirect;
      expect(fetch.defaults.redirect).toBe(defaults.redirect); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.referrer = defaults.referrer;
      expect(fetch.defaults.referrer).toBe(defaults.referrer); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.referrerPolicy = defaults.referrerPolicy;
      expect(fetch.defaults.referrerPolicy).toBe(defaults.referrerPolicy); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.signal = defaults.signal;
      expect(fetch.defaults.signal).toBe(defaults.signal); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.window = defaults.window;
      expect(fetch.defaults.window).toBe(defaults.window); // eslint-disable-line @typescript-eslint/no-deprecated

      fetch.duplex = defaults.duplex;
      expect(fetch.defaults.duplex).toBe(defaults.duplex); // eslint-disable-line @typescript-eslint/no-deprecated

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(
        joinURL(baseURL, `/users?orderBy=${encodeURIComponent('name:asc')}&limit=10&full=true`),
      );

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(
        joinURL(baseURL, `/users?orderBy=${encodeURIComponent('name:asc')}&limit=10&full=true`),
      );

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

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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

      expect(fetch.headers).toEqual({ 'accept-language': 'en' });

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

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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

      expect(fetch.headers).toEqual({ 'accept-language': 'en' });

      const response = await fetch('/users', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept-language': 'fr',
        },
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
            searchParams: {
              page?: number;
              limit?: number;
              username: string[];
            };
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .with({
          searchParams: {
            page: 1,
            limit: 10,
            username: ['my', 'other'],
          },
        })
        .respond({ status: 200, body: users })
        .times(1);

      const fetch = createFetch<Schema>({
        baseURL,
        searchParams: { limit: 10 },
      });

      expect(fetch.searchParams).toEqual({ limit: 10 });

      const response = await fetch('/users', {
        method: 'GET',
        searchParams: { page: 1, username: ['my', 'other'] },
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
            searchParams: {
              page?: number;
              limit?: number;
              username: string[];
            };
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .with({
          searchParams: {
            page: 1,
            limit: 20,
            username: ['any', 'other'],
          },
        })
        .respond({ status: 200, body: users })
        .times(1);

      const fetch = createFetch<Schema>({
        baseURL,
        searchParams: { limit: 10, username: ['my', 'other'] },
      });

      expect(fetch.searchParams).toEqual({ limit: 10, username: ['my', 'other'] });

      const response = await fetch('/users', {
        method: 'GET',
        searchParams: { page: 1, limit: 20, username: ['any', 'other'] },
      });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users?page=1&limit=20&username=any&username=other'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users?page=1&limit=20&username=any&username=other'));
    });
  });
});
