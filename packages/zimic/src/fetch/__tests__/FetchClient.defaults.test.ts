import { describe, expect, expectTypeOf, it } from 'vitest';

import { HttpSchema } from '@/http';
import { joinURL } from '@/utils/urls';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import createFetch from '../factory';
import { FetchResponse, FetchRequest, FetchRequestInit } from '../types/requests';

import { FetchClientOptions } from '..';

describe('FetchClient (node) > Defaults', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  it('should support creating fetch clients without defaults', async () => {
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

      const fetch = createFetch<Schema>({ baseURL });

      expect(fetch.defaults).toEqual<FetchRequestInit.Defaults>({ baseURL });

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
    });
  });

  it('should support creating fetch clients with defaults', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers?: { 'content-type': 'application/json' };
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
        .with({ headers: { 'content-type': 'application/json' } })
        .respond({
          status: 200,
          body: users,
        })
        .times(1);

      const defaults = {
        baseURL,
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'User 1' }),
        keepalive: true,
        mode: 'cors',
        redirect: 'follow',
        priority: 'high',
        referrer: 'about:client',
        referrerPolicy: 'origin',
        signal: new AbortController().signal,
      } satisfies FetchClientOptions<Schema>;

      const fetch = createFetch<Schema>(defaults);

      expect(fetch.defaults).toEqual<FetchRequestInit.Defaults>(defaults);

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'POST', Schema['/users']['POST']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'POST', Schema['/users']['POST']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

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
        // .with({ headers: { 'content-type': 'application/json' } })
        .respond({
          status: 200,
          body: users,
        })
        .times(1);

      const otherBaseURL = 'http://localhost:3001';
      expect(otherBaseURL).not.toBe(baseURL);

      const fetch = createFetch<Schema>({ baseURL: otherBaseURL });

      expect(fetch.defaults).toEqual<FetchRequestInit.Defaults>({ baseURL: otherBaseURL });

      const defaults = {
        baseURL,
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'User 1' }),
        keepalive: true,
        mode: 'cors',
        redirect: 'follow',
        priority: 'high',
        referrer: 'about:client',
        referrerPolicy: 'origin',
        signal: new AbortController().signal,
      } satisfies FetchClientOptions<Schema>;

      fetch.defaults.baseURL = defaults.baseURL;
      fetch.defaults.cache = defaults.cache;
      fetch.defaults.credentials = defaults.credentials;
      fetch.defaults.headers = defaults.headers;
      fetch.defaults.body = defaults.body;
      fetch.defaults.keepalive = defaults.keepalive;
      fetch.defaults.mode = defaults.mode;
      fetch.defaults.redirect = defaults.redirect;
      fetch.defaults.priority = defaults.priority;
      fetch.defaults.referrer = defaults.referrer;
      fetch.defaults.referrerPolicy = defaults.referrerPolicy;
      fetch.defaults.signal = defaults.signal;

      expect(fetch.defaults).toEqual<FetchRequestInit.Defaults>(defaults);

      const response = await fetch('/users', { method: 'POST' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'POST', Schema['/users']['POST']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'POST', Schema['/users']['POST']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

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
});
