import { HttpSchema, StrictHeaders } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { expectResponseStatus } from '@tests/utils/requests';

import createFetch from '../factory';
import { FetchResponse, FetchRequest } from '../types/requests';

describe('FetchClient > Methods', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
  ];

  it('should support making GET requests', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .respond({
          status: 200,
          body: users,
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

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
    });
  });

  it('should support making GET requests using a URL instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .respond({
          status: 200,
          body: users,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const url = new URL('/users', baseURL);
      const response = await fetch(url, { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
    });
  });

  it('should support making GET requests using a Request instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: { body: User[] } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .respond({
          status: 200,
          body: users,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', { method: 'GET' });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('GET');
      expectTypeOf(request.method).toEqualTypeOf<'GET'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<never>>();

      const response = await fetch(request);

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
    });
  });

  it('should support making POST requests', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
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

  it('should support making POST requests using a URL instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
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

      const url = new URL('/users', baseURL);
      const response = await fetch(url, {
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

  it('should support making POST requests with a Request instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
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

      const request = new fetch.Request('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(user),
      });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('POST');
      expectTypeOf(request.method).toEqualTypeOf<'POST'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

      const response = await fetch(request);

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

  it('should support making PUT requests', async () => {
    type Schema = HttpSchema<{
      '/users': {
        PUT: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: { 200: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      await interceptor
        .put('/users')
        .with({ body: user })
        .respond({
          status: 200,
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(user),
      });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'PUT', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'PUT', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('PUT');
      expectTypeOf(response.request.method).toEqualTypeOf<'PUT'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();
    });
  });

  it('should support making PUT requests using a URL instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        PUT: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: { 200: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      await interceptor
        .put('/users')
        .with({ body: user })
        .respond({
          status: 200,
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const url = new URL('/users', baseURL);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(user),
      });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'PUT', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'PUT', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('PUT');
      expectTypeOf(response.request.method).toEqualTypeOf<'PUT'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();
    });
  });

  it('should support making PUT requests with a Request instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        PUT: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: { 200: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      await interceptor
        .put('/users')
        .with({ body: user })
        .respond({
          status: 200,
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(user),
      });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'PUT', '/users'>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('PUT');
      expectTypeOf(request.method).toEqualTypeOf<'PUT'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

      const response = await fetch(request);

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'PUT', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'PUT', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('PUT');
      expectTypeOf(response.request.method).toEqualTypeOf<'PUT'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();
    });
  });

  it('should support making PATCH requests', async () => {
    type Schema = HttpSchema<{
      '/users': {
        PATCH: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: { 200: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      await interceptor
        .patch('/users')
        .with({ body: user })
        .respond({
          status: 200,
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(user),
      });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'PATCH', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'PATCH', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('PATCH');
      expectTypeOf(response.request.method).toEqualTypeOf<'PATCH'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();
    });
  });

  it('should support making PATCH requests using a URL instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        PATCH: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: { 200: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      await interceptor
        .patch('/users')
        .with({ body: user })
        .respond({
          status: 200,
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const url = new URL('/users', baseURL);
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(user),
      });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'PATCH', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'PATCH', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('PATCH');
      expectTypeOf(response.request.method).toEqualTypeOf<'PATCH'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();
    });
  });

  it('should support making PATCH requests with a Request instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        PATCH: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: Partial<User>;
          };
          response: { 200: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const user = users[0];

      await interceptor
        .patch('/users')
        .with({ body: user })
        .respond({
          status: 200,
          body: user,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(user),
      });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'PATCH', '/users'>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('PATCH');
      expectTypeOf(request.method).toEqualTypeOf<'PATCH'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

      expectTypeOf(request.json).toEqualTypeOf<() => Promise<Partial<User>>>();
      expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

      const response = await fetch(request);

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'PATCH', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'PATCH', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('PATCH');
      expectTypeOf(response.request.method).toEqualTypeOf<'PATCH'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();
    });
  });

  it('should support making DELETE requests', async () => {
    type Schema = HttpSchema<{
      '/users': {
        DELETE: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: { 204: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.delete('/users').with({ body: users[0] }).respond({ status: 204 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(users[0]),
      });

      expectResponseStatus(response, 204);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'DELETE', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'DELETE', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('DELETE');
      expectTypeOf(response.request.method).toEqualTypeOf<'DELETE'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();
    });
  });

  it('should support making DELETE requests using a URL instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        DELETE: {
          response: { 204: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.delete('/users').respond({ status: 204 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const url = new URL('/users', baseURL);
      const response = await fetch(url, { method: 'DELETE' });

      expectResponseStatus(response, 204);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'DELETE', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'DELETE', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('DELETE');
      expectTypeOf(response.request.method).toEqualTypeOf<'DELETE'>();
    });
  });

  it('should support making DELETE requests with a Request instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        DELETE: {
          response: { 204: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.delete('/users').respond({ status: 204 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', { method: 'DELETE' });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'DELETE', '/users'>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('DELETE');
      expectTypeOf(request.method).toEqualTypeOf<'DELETE'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<never>>();

      const response = await fetch(request);

      expectResponseStatus(response, 204);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'DELETE', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'DELETE', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('DELETE');
      expectTypeOf(response.request.method).toEqualTypeOf<'DELETE'>();
    });
  });

  it('should support making HEAD requests', async () => {
    type Schema = HttpSchema<{
      '/users': {
        HEAD: {
          response: { 200: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.head('/users').respond({ status: 200 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', { method: 'HEAD' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'HEAD', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'HEAD', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('HEAD');
      expectTypeOf(response.request.method).toEqualTypeOf<'HEAD'>();
    });
  });

  it('should support making HEAD requests using a URL instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        HEAD: {
          response: { 200: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.head('/users').respond({ status: 200 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const url = new URL('/users', baseURL);
      const response = await fetch(url, { method: 'HEAD' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'HEAD', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'HEAD', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('HEAD');
      expectTypeOf(response.request.method).toEqualTypeOf<'HEAD'>();
    });
  });

  it('should support making HEAD requests with a Request instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        HEAD: {
          response: { 200: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.head('/users').respond({ status: 200 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', { method: 'HEAD' });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'HEAD', '/users'>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('HEAD');
      expectTypeOf(request.method).toEqualTypeOf<'HEAD'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<never>>();

      const response = await fetch(request);

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'HEAD', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'HEAD', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('HEAD');
      expectTypeOf(response.request.method).toEqualTypeOf<'HEAD'>();
    });
  });

  it('should support making OPTIONS requests', async () => {
    type Schema = HttpSchema<{
      '/users': {
        OPTIONS: {
          response: { 200: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.options('/users').respond({ status: 200 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', { method: 'OPTIONS' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'OPTIONS', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'OPTIONS', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('OPTIONS');
      expectTypeOf(response.request.method).toEqualTypeOf<'OPTIONS'>();
    });
  });

  it('should support making OPTIONS requests using a URL instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        OPTIONS: {
          response: { 200: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.options('/users').respond({ status: 200 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const url = new URL('/users', baseURL);
      const response = await fetch(url, { method: 'OPTIONS' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'OPTIONS', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'OPTIONS', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('OPTIONS');
      expectTypeOf(response.request.method).toEqualTypeOf<'OPTIONS'>();
    });
  });

  it('should support making OPTIONS requests with a Request instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        OPTIONS: {
          response: { 200: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.options('/users').respond({ status: 200 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', { method: 'OPTIONS' });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'OPTIONS', '/users'>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('OPTIONS');
      expectTypeOf(request.method).toEqualTypeOf<'OPTIONS'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<never>>();

      const response = await fetch(request);

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expectResponseStatus(response, 200);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'OPTIONS', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'OPTIONS', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('OPTIONS');
      expectTypeOf(response.request.method).toEqualTypeOf<'OPTIONS'>();
    });
  });

  it('should correctly type requests and responses with multiple methods', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 200: { body: User[] } };
        };

        PATCH: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: Partial<User>;
          };
          response: { 201: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const fetch = createFetch<Schema>({ baseURL });

      await interceptor
        .get('/users')
        .respond({
          status: 200,
          body: [],
        })
        .times(1);

      const getResponse = await fetch('/users', { method: 'GET' });
      expectTypeOf(getResponse.status).toEqualTypeOf<200>();
      expect(getResponse.status).toBe(200);
      expect(await getResponse.json()).toEqual([]);

      expect(getResponse).toBeInstanceOf(Response);
      expectTypeOf(getResponse satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(getResponse.url).toBe(joinURL(baseURL, '/users'));

      expect(getResponse.headers).toBeInstanceOf(Headers);
      expectTypeOf(getResponse.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

      expectTypeOf(getResponse.json).toEqualTypeOf<() => Promise<User[]>>();
      expectTypeOf(getResponse.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(getResponse.clone).toEqualTypeOf<() => typeof getResponse>();
      expectTypeOf(getResponse.error).toEqualTypeOf<null>();

      expect(getResponse.request).toBeInstanceOf(Request);
      expectTypeOf(getResponse.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(getResponse.request.url).toBe(joinURL(baseURL, '/users'));

      expect(getResponse.request.path).toBe('/users');
      expectTypeOf(getResponse.request.path).toEqualTypeOf<'/users'>();

      expect(getResponse.request.method).toBe('GET');
      expectTypeOf(getResponse.request.method).toEqualTypeOf<'GET'>();

      expect(getResponse.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(getResponse.request.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(getResponse.request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(getResponse.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(getResponse.request.clone).toEqualTypeOf<() => typeof getResponse.request>();

      await interceptor
        .patch('/users')
        .with({ body: { name: 'User 1' } })
        .respond({ status: 201, body: users[0] })
        .times(1);

      const patchResponse = await fetch('/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'User 1' }),
      });
      expectTypeOf(patchResponse.status).toEqualTypeOf<201>();
      expect(patchResponse.status).toBe(201);
      expect(await patchResponse.json()).toEqual(users[0]);

      expect(patchResponse).toBeInstanceOf(Response);
      expectTypeOf(patchResponse satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'PATCH', '/users'>>();

      expect(patchResponse.url).toBe(joinURL(baseURL, '/users'));

      expect(patchResponse.headers).toBeInstanceOf(Headers);
      expectTypeOf(patchResponse.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

      expectTypeOf(patchResponse.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(patchResponse.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(patchResponse.clone).toEqualTypeOf<() => typeof patchResponse>();
      expectTypeOf(patchResponse.error).toEqualTypeOf<null>();

      expect(patchResponse.request).toBeInstanceOf(Request);
      expectTypeOf(patchResponse.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'PATCH', '/users'>>();

      expect(patchResponse.request.url).toBe(joinURL(baseURL, '/users'));

      expect(patchResponse.request.path).toBe('/users');
      expectTypeOf(patchResponse.request.path).toEqualTypeOf<'/users'>();

      expect(patchResponse.request.method).toBe('PATCH');
      expectTypeOf(patchResponse.request.method).toEqualTypeOf<'PATCH'>();

      expect(patchResponse.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(patchResponse.request.headers).toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/json' }>
      >();

      expectTypeOf(patchResponse.request.json).toEqualTypeOf<() => Promise<Partial<User>>>();
      expectTypeOf(patchResponse.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(patchResponse.request.clone).toEqualTypeOf<() => typeof patchResponse.request>();
    });
  });

  it('should show a type error if trying to use a non-specified path and/or method', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: Omit<User, 'id'>;
          };
          response: { 201: { body: User } };
        };

        GET: {
          response: { 200: { body: User[] } };
        };
      };

      '/users/:id': {
        GET: {
          response: { 200: { body: User } };
        };

        PATCH: {
          request: {
            headers: { 'content-type': 'application/json' };
            body?: Partial<User>;
          };
          response: { 200: { body: User } };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const fetch = createFetch<Schema>({ baseURL });

      interceptor.post('/users').respond({ status: 201, body: users[0] });

      await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'User 1' }),
      });

      // @ts-expect-error Invalid body
      await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ other: 1 }),
      });

      // @ts-expect-error Invalid headers
      await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ name: 'User 1' }),
      });

      // @ts-expect-error Additional headers
      await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-custom': 'value' },
        body: JSON.stringify({ name: 'User 1' }),
      });

      // @ts-expect-error Headers and body are missing
      await fetch('/users', { method: 'POST' });

      // @ts-expect-error Headers are missing
      await fetch('/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'User 1' }),
      });

      // @ts-expect-error Body is missing
      await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });

      interceptor.get('/users/:id').respond({ status: 200, body: users[0] });
      await fetch('/users/1', { method: 'GET' });

      // @ts-expect-error Invalid method
      interceptor.post('/users/:id').respond({ status: 200 });
      // @ts-expect-error Invalid method
      await fetch('/users/1', { method: 'POST' });

      // @ts-expect-error Invalid path
      interceptor.get('/unknown').respond({ status: 200 });
      // @ts-expect-error Invalid path
      await fetch('/unknown', { method: 'GET' });

      interceptor.patch('/users/1').respond({ status: 200, body: users[0] });

      await fetch('/users/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'User 1' }),
      });

      await fetch('/users/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });

      // @ts-expect-error Invalid body
      await fetch('/users/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 1 }),
      });

      // @ts-expect-error Headers and body are missing
      await fetch('/users/1', { method: 'PATCH' });

      // @ts-expect-error Headers are missing
      await fetch('/users/1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'User 1' }),
      });

      await fetch('/users/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
      });
    });
  });
});
