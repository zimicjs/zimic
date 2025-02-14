import { describe, expect, expectTypeOf, it } from 'vitest';

import { HttpSchema, StrictHeaders } from '@/http';
import { joinURL } from '@/utils/urls';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import createFetch from '../factory';
import { FetchResponse, FetchRequest } from '../types/requests';

describe('FetchClient (node) > Methods', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  it('should support making GET requests', async () => {
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

      const response = await fetch('/users', { method: 'GET' });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<User[]>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<() => null>();

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

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should support making GET requests using a request instance', async () => {
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

      const request = new fetch.Request('/users', { method: 'GET' });
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

      const response = await fetch(request);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<User[]>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<() => null>();

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

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      const user: User = { name: 'User 1' };

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

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'POST', Schema['/users']['POST']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<() => null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'POST', Schema['/users']['POST']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('POST');
      expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should support making POST requests with a request instance', async () => {
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      const user: User = { name: 'User 1' };

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
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<'/users', 'POST', Schema['/users']['POST']>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('POST');
      expectTypeOf(request.method).toEqualTypeOf<'POST'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

      expectTypeOf(request.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

      const response = await fetch(request);

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'POST', Schema['/users']['POST']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<() => null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'POST', Schema['/users']['POST']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('POST');
      expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      const user: User = { name: 'User 1' };

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

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'PUT', Schema['/users']['PUT']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<() => null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'PUT', Schema['/users']['PUT']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('PUT');
      expectTypeOf(response.request.method).toEqualTypeOf<'PUT'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should support making PUT requests with a request instance', async () => {
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      const user: User = { name: 'User 1' };

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
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<'/users', 'PUT', Schema['/users']['PUT']>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('PUT');
      expectTypeOf(request.method).toEqualTypeOf<'PUT'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

      expectTypeOf(request.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

      const response = await fetch(request);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'PUT', Schema['/users']['PUT']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<() => null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'PUT', Schema['/users']['PUT']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('PUT');
      expectTypeOf(response.request.method).toEqualTypeOf<'PUT'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      const user: User = { name: 'User 1' };

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

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'PATCH', Schema['/users']['PATCH']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<() => null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'PATCH', Schema['/users']['PATCH']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('PATCH');
      expectTypeOf(response.request.method).toEqualTypeOf<'PATCH'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should support making PATCH requests with a request instance', async () => {
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      const user: User = { name: 'User 1' };

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
      expectTypeOf(request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'PATCH', Schema['/users']['PATCH']>
      >();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('PATCH');
      expectTypeOf(request.method).toEqualTypeOf<'PATCH'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

      expectTypeOf(request.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

      const response = await fetch(request);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(user);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'PATCH', Schema['/users']['PATCH']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<() => null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'PATCH', Schema['/users']['PATCH']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('PATCH');
      expectTypeOf(response.request.method).toEqualTypeOf<'PATCH'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should support making DELETE requests', async () => {
    type Schema = HttpSchema<{
      '/users': {
        DELETE: {
          response: { 204: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor.delete('/users').respond({ status: 204 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', { method: 'DELETE' });

      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'DELETE', Schema['/users']['DELETE']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<() => null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'DELETE', Schema['/users']['DELETE']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('DELETE');
      expectTypeOf(response.request.method).toEqualTypeOf<'DELETE'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should support making DELETE requests with a request instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        DELETE: {
          response: { 204: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor.delete('/users').respond({ status: 204 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', { method: 'DELETE' });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'DELETE', Schema['/users']['DELETE']>
      >();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('DELETE');
      expectTypeOf(request.method).toEqualTypeOf<'DELETE'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

      const response = await fetch(request);

      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'DELETE', Schema['/users']['DELETE']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<() => null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'DELETE', Schema['/users']['DELETE']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('DELETE');
      expectTypeOf(response.request.method).toEqualTypeOf<'DELETE'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor.head('/users').respond({ status: 200 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', { method: 'HEAD' });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'HEAD', Schema['/users']['HEAD']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<() => null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'HEAD', Schema['/users']['HEAD']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('HEAD');
      expectTypeOf(response.request.method).toEqualTypeOf<'HEAD'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor.head('/users').respond({ status: 200 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', { method: 'HEAD' });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<'/users', 'HEAD', Schema['/users']['HEAD']>>();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('HEAD');
      expectTypeOf(request.method).toEqualTypeOf<'HEAD'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

      const response = await fetch(request);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'HEAD', Schema['/users']['HEAD']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<() => null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'HEAD', Schema['/users']['HEAD']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('HEAD');
      expectTypeOf(response.request.method).toEqualTypeOf<'HEAD'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor.options('/users').respond({ status: 200 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', { method: 'OPTIONS' });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'OPTIONS', Schema['/users']['OPTIONS']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<() => null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'OPTIONS', Schema['/users']['OPTIONS']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('OPTIONS');
      expectTypeOf(response.request.method).toEqualTypeOf<'OPTIONS'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should support making OPTIONS requests with a request instance', async () => {
    type Schema = HttpSchema<{
      '/users': {
        OPTIONS: {
          response: { 200: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor.options('/users').respond({ status: 200 }).times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', { method: 'OPTIONS' });
      expect(request).toBeInstanceOf(Request);
      expectTypeOf(request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'OPTIONS', Schema['/users']['OPTIONS']>
      >();

      expect(request.url).toBe(joinURL(baseURL, '/users'));

      expect(request.path).toBe('/users');
      expectTypeOf(request.path).toEqualTypeOf<'/users'>();

      expect(request.method).toBe('OPTIONS');
      expectTypeOf(request.method).toEqualTypeOf<'OPTIONS'>();

      expect(request.headers).toBeInstanceOf(Headers);
      expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

      const response = await fetch(request);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'OPTIONS', Schema['/users']['OPTIONS']>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<() => null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'OPTIONS', Schema['/users']['OPTIONS']>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.path).toBe('/users');
      expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

      expect(response.request.method).toBe('OPTIONS');
      expectTypeOf(response.request.method).toEqualTypeOf<'OPTIONS'>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });
});
