import { HttpSchema, StrictHeaders, HttpHeaders, HttpFormData, HttpSearchParams } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { expectResponseStatus } from '@tests/utils/requests';

import createFetch from '../factory';
import { FetchRequest, FetchResponse } from '../types/requests';

describe('FetchClient > Headers', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
  ];

  it('should support requests with headers as an object', async () => {
    type RequestHeaders = HttpSchema.Headers<{
      'content-type': string;
    }>;

    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: { headers?: RequestHeaders };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<RequestHeaders>>();

      responses.push(await fetch(request));

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        expect(await response.json()).toEqual(users);
      }
    });
  });

  it('should support requests with headers as an instance', async () => {
    type RequestHeaders = HttpSchema.Headers<{
      'content-type': string;
    }>;

    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: { headers?: RequestHeaders };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<RequestHeaders>>();

      responses.push(await fetch(request));

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        expect(await response.json()).toEqual(users);
      }
    });
  });

  it('should support requests with headers containing invalid types', async () => {
    type RequestHeaders = HttpSchema.Headers<{
      'content-type': string;
      date?: Date; // Forcing an invalid type
      method?: () => void; // Forcing an invalid type
    }>;

    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: { headers: RequestHeaders };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<RequestHeaders>>();

      responses.push(await fetch(request));

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        expect(await response.json()).toEqual(users);
      }
    });
  });

  it('should support requests with no headers and no request declaration', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.get('/users').respond({ status: 200, body: users }).times(8);

      const fetch = createFetch<Schema>({ baseURL });

      const responses = [
        await fetch('/users', { method: 'GET' }),
        await fetch('/users', { method: 'GET', headers: undefined }),
        // @ts-expect-error Forcing some headers
        await fetch('/users', { method: 'GET', headers: {} }),
        // @ts-expect-error Forcing some headers
        await fetch('/users', { method: 'GET', headers: new HttpHeaders() }),
      ];

      for (const request of [
        new fetch.Request('/users', { method: 'GET' }),
        new fetch.Request('/users', { method: 'GET', headers: undefined }),
        // @ts-expect-error Forcing some headers
        new fetch.Request('/users', { method: 'GET', headers: {} }),
        // @ts-expect-error Forcing some headers
        new fetch.Request('/users', { method: 'GET', headers: new HttpHeaders() }),
      ]) {
        expect(request).toBeInstanceOf(Request);
        expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

        expect(request.url).toBe(joinURL(baseURL, '/users'));

        expect(request.headers).toBeInstanceOf(Headers);
        expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<never>>();

        const response = await fetch(request);
        responses.push(response);
      }

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        expect(await response.json()).toEqual(users);
      }
    });
  });

  it('should support requests with no headers and an empty request declaration', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: {};
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.get('/users').respond({ status: 200, body: users }).times(8);

      const fetch = createFetch<Schema>({ baseURL });

      const responses = [
        await fetch('/users', { method: 'GET' }),
        await fetch('/users', { method: 'GET', headers: undefined }),
        // @ts-expect-error Forcing some headers
        await fetch('/users', { method: 'GET', headers: {} }),
        // @ts-expect-error Forcing some headers
        await fetch('/users', { method: 'GET', headers: new HttpHeaders() }),
      ];

      for (const request of [
        new fetch.Request('/users', { method: 'GET' }),
        new fetch.Request('/users', { method: 'GET', headers: undefined }),
        // @ts-expect-error Forcing some headers
        new fetch.Request('/users', { method: 'GET', headers: {} }),
        // @ts-expect-error Forcing some headers
        new fetch.Request('/users', { method: 'GET', headers: new HttpHeaders() }),
      ]) {
        expect(request).toBeInstanceOf(Request);
        expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

        expect(request.url).toBe(joinURL(baseURL, '/users'));

        expect(request.headers).toBeInstanceOf(Headers);
        expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<never>>();

        const response = await fetch(request);
        responses.push(response);
      }

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        expect(await response.json()).toEqual(users);
      }
    });
  });

  it('should support requests with no headers and a non-empty request declaration', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: { searchParams: { query: string } };
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const searchParams = { query: users[0].name };

      await interceptor.get('/users').with({ searchParams }).respond({ status: 200, body: users }).times(8);

      const fetch = createFetch<Schema>({ baseURL });

      const responses = [
        await fetch('/users', { method: 'GET', searchParams }),
        await fetch('/users', { method: 'GET', searchParams, headers: undefined }),
        // @ts-expect-error Forcing some headers
        await fetch('/users', { method: 'GET', searchParams, headers: {} }),
        // @ts-expect-error Forcing some headers
        await fetch('/users', { method: 'GET', searchParams, headers: new HttpHeaders() }),
      ];

      for (const request of [
        new fetch.Request('/users', { method: 'GET', searchParams }),
        new fetch.Request('/users', { method: 'GET', searchParams, headers: undefined }),
        // @ts-expect-error Forcing some headers
        new fetch.Request('/users', { method: 'GET', searchParams, headers: {} }),
        // @ts-expect-error Forcing some headers
        new fetch.Request('/users', { method: 'GET', searchParams, headers: new HttpHeaders() }),
      ]) {
        expect(request).toBeInstanceOf(Request);
        expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

        expect(request.url).toBe(joinURL(baseURL, '/users?query=User+1'));

        expect(request.headers).toBeInstanceOf(Headers);
        expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<never>>();

        const response = await fetch(request);
        responses.push(response);
      }

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        expect(await response.json()).toEqual(users);
      }
    });
  });

  it('should support responses with headers as an object', async () => {
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

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': string }>>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();
    });
  });

  it('should support responses with headers as an instance', async () => {
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

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': string }>>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();
    });
  });

  it('should support responses with headers containing invalid types', async () => {
    type ResponseHeaders = HttpSchema.Headers<{
      'content-type': string;
      date?: Date; // Forcing an invalid type
      method?: () => void; // Forcing an invalid type
    }>;

    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: { headers: ResponseHeaders; body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).branded.toEqualTypeOf<
        StrictHeaders<ResponseHeaders & { 'content-type': string }>
      >();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();
    });
  });

  it('should support responses with no headers and an empty response declaration', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.get('/users').respond({ status: 200 }).times(4);

      const fetch = createFetch<Schema>({ baseURL });

      const responses = [
        await fetch('/users', { method: 'GET' }),
        await fetch('/users', { method: 'GET', headers: undefined }),
        // @ts-expect-error Forcing some headers
        await fetch('/users', { method: 'GET', headers: {} }),
        // @ts-expect-error Forcing some headers
        await fetch('/users', { method: 'GET', headers: new HttpHeaders() }),
      ];

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        expect(await response.text()).toBe('');

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();
      }
    });
  });

  it('should support responses with no headers and and a non-empty response declaration', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.get('/users').respond({ status: 200, body: users }).times(4);

      const fetch = createFetch<Schema>({ baseURL });

      const responses = [
        await fetch('/users', { method: 'GET' }),
        await fetch('/users', { method: 'GET', headers: undefined }),
        // @ts-expect-error Forcing some headers
        await fetch('/users', { method: 'GET', headers: {} }),
        // @ts-expect-error Forcing some headers
        await fetch('/users', { method: 'GET', headers: new HttpHeaders() }),
      ];

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        expect(await response.json()).toEqual(users);

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();
      }
    });
  });

  it('should infer the content type of requests with a JSON body if none is provided', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: { body: User };
          response: { 201: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      await interceptor
        .post('/users')
        .with({ body: user })
        .respond({
          status: 201,
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(user),
      });

      expectResponseStatus(response, 201);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('POST');
      expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();
    });
  });

  it('should combine the inferred content type of requests with a JSON body with existing headers', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { accept?: string };
            body: User;
          };
          response: { 201: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      await interceptor
        .post('/users')
        .with({
          headers: { accept: 'application/json' },
          body: user,
        })
        .respond({
          status: 201,
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(user),
      });

      expectResponseStatus(response, 201);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('POST');
      expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).branded.toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/json'; accept?: string }>
      >();
    });
  });

  it('should combine the inferred content type of requests with a JSON body with existing optional headers', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers?: { accept?: string };
            body?: User;
          };
          response: { 201: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      await interceptor
        .post('/users')
        .respond({
          status: 201,
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
      });

      expectResponseStatus(response, 201);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('POST');
      expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).branded.toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/json'; accept?: string }>
      >();
    });
  });

  it('should not infer the content type of requests with a JSON body if a content type is already declared', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': `application/json;charset=${string}` };
            body: User;
          };
          response: { 201: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      await interceptor
        .post('/users')
        .with({ body: user })
        .respond({
          status: 201,
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json;charset=utf-8' },
        body: JSON.stringify(user),
      });

      expectResponseStatus(response, 201);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('POST');
      expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<
        StrictHeaders<{ 'content-type': `application/json;charset=${string}` }>
      >();
    });
  });

  it('should not infer the content type of requests with a non-JSON body', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            body: HttpSearchParams<{ value?: string }> | HttpFormData<{ value?: string }> | Blob | string;
          };
          response: { 201: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      const requestSearchParams = new HttpSearchParams({
        value: user.name,
      });

      await interceptor
        .post('/users')
        .with({ body: requestSearchParams })
        .respond({
          status: 201,
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
        body: requestSearchParams,
      });

      expectResponseStatus(response, 201);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('POST');
      expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();
    });
  });

  it('should infer the content type of responses with a JSON body if none is provided', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          response: { 201: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      await interceptor
        .post('/users')
        .respond({
          status: 201,
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
      });

      expectResponseStatus(response, 201);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();
    });
  });

  it('should combine the inferred content type of responses with a JSON body with existing headers', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          response: {
            201: {
              headers: { 'content-language': string; 'x-custom'?: string };
              body: User;
            };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      await interceptor
        .post('/users')
        .respond({
          status: 201,
          headers: { 'content-language': 'en', 'x-custom': 'custom-value' },
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
      });

      expectResponseStatus(response, 201);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).branded.toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/json'; 'content-language': string; 'x-custom'?: string }>
      >();
    });
  });

  it('should combine the inferred content type of responses with a JSON body with existing optional headers', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          response: {
            201: {
              headers?: { 'content-language': string; 'x-custom'?: string };
              body: User;
            };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      await interceptor
        .post('/users')
        .respond({
          status: 201,
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
      });

      expectResponseStatus(response, 201);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).branded.toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/json'; 'content-language': string; 'x-custom'?: string }>
      >();
    });
  });

  it('should not infer the content type of responses with a JSON body if a content type is already declared', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          response: {
            201: {
              headers: { 'content-type': `application/json;charset=${string}` };
              body: User;
            };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      await interceptor
        .post('/users')
        .respond({
          status: 201,
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
      });

      expectResponseStatus(response, 201);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<
        StrictHeaders<{ 'content-type': `application/json;charset=${string}` }>
      >();
    });
  });

  it('should not infer the content type of responses with a non-JSON body', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          response: {
            201: {
              body: HttpSearchParams<{ value?: string }> | HttpFormData<{ value?: string }> | Blob | string;
            };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      const responseSearchParams = new HttpSearchParams({
        value: user.name,
      });

      await interceptor
        .post('/users')
        .respond({
          status: 201,
          body: responseSearchParams,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
      });

      expectResponseStatus(response, 201);
      const responseFormData = await response.formData();
      expect(responseFormData.get('value')).toEqual(responseSearchParams.get('value'));

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();
    });
  });
});
