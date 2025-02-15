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

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<User[]>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
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

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<User[]>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
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
      expectTypeOf(response.error).toEqualTypeOf<null>();

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
      expectTypeOf(response.error).toEqualTypeOf<null>();

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

      expectTypeOf(response.status).toEqualTypeOf<200>();
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
      expectTypeOf(response.error).toEqualTypeOf<null>();

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

      expectTypeOf(response.status).toEqualTypeOf<200>();
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
      expectTypeOf(response.error).toEqualTypeOf<null>();

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

      expectTypeOf(response.status).toEqualTypeOf<200>();
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
      expectTypeOf(response.error).toEqualTypeOf<null>();

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
            body: Partial<User>;
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

      expectTypeOf(request.json).toEqualTypeOf<() => Promise<Partial<User>>>();
      expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(request.clone).toEqualTypeOf<() => typeof request>();

      const response = await fetch(request);

      expectTypeOf(response.status).toEqualTypeOf<200>();
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
      expectTypeOf(response.error).toEqualTypeOf<null>();

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

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<Partial<User>>>();
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
      expectTypeOf(response.error).toEqualTypeOf<null>();

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
      expectTypeOf(response.error).toEqualTypeOf<null>();

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

      expectTypeOf(response.status).toEqualTypeOf<200>();
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
      expectTypeOf(response.error).toEqualTypeOf<null>();

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

      expectTypeOf(response.status).toEqualTypeOf<200>();
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
      expectTypeOf(response.error).toEqualTypeOf<null>();

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

      expectTypeOf(response.status).toEqualTypeOf<200>();
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
      expectTypeOf(response.error).toEqualTypeOf<null>();

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

      expectTypeOf(response.status).toEqualTypeOf<200>();
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
      expectTypeOf(response.error).toEqualTypeOf<null>();

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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
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
      expectTypeOf(getResponse satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'GET', Schema['/users']['GET']>
      >();

      expect(getResponse.url).toBe(joinURL(baseURL, '/users'));

      expect(getResponse.headers).toBeInstanceOf(Headers);
      expectTypeOf(getResponse.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(getResponse.json).toEqualTypeOf<() => Promise<User[]>>();
      expectTypeOf(getResponse.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(getResponse.clone).toEqualTypeOf<() => typeof getResponse>();
      expectTypeOf(getResponse.error).toEqualTypeOf<null>();

      expect(getResponse.request).toBeInstanceOf(Request);
      expectTypeOf(getResponse.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'GET', Schema['/users']['GET']>
      >();

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
      expectTypeOf(patchResponse satisfies Response).toEqualTypeOf<
        FetchResponse<'/users', 'PATCH', Schema['/users']['PATCH']>
      >();

      expect(patchResponse.url).toBe(joinURL(baseURL, '/users'));

      expect(patchResponse.headers).toBeInstanceOf(Headers);
      expectTypeOf(patchResponse.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(patchResponse.json).toEqualTypeOf<() => Promise<User>>();
      expectTypeOf(patchResponse.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(patchResponse.clone).toEqualTypeOf<() => typeof patchResponse>();
      expectTypeOf(patchResponse.error).toEqualTypeOf<null>();

      expect(patchResponse.request).toBeInstanceOf(Request);
      expectTypeOf(patchResponse.request satisfies Request).toEqualTypeOf<
        FetchRequest<'/users', 'PATCH', Schema['/users']['PATCH']>
      >();

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
            body: User;
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

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
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
