import { HttpSchema } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import createFetch from '../factory';
import { FetchResponse, FetchRequest } from '../types/requests';

describe('FetchClient > Path params', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    username: string;
  }

  const users: User[] = [{ username: 'user-1' }, { username: 'user-2' }];

  it('should support requests with dynamic paths containing one parameter at the start of the path', async () => {
    type Schema = HttpSchema<{
      '/:username': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get(`/${users[0].username}`)
        .respond({
          status: 200,
          body: users[0],
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch(`/${users[0].username}`, { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users[0]);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/:username'>>();

      expect(response.url).toBe(joinURL(baseURL, `/${users[0].username}`));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/:username'>>();

      expect(response.request.url).toBe(joinURL(baseURL, `/${users[0].username}`));

      expect(response.request.path).toBe(`/${users[0].username}`);
      expectTypeOf(response.request.path).toEqualTypeOf<`/${string}`>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
    });
  });

  it('should support requests with dynamic paths containing one parameter in the middle of the path', async () => {
    type Schema = HttpSchema<{
      '/users/:username/get': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get(`/users/${users[0].username}/get`)
        .respond({
          status: 200,
          body: users[0],
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch(`/users/${users[0].username}/get`, { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users[0]);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users/:username/get'>>();

      expect(response.url).toBe(joinURL(baseURL, `/users/${users[0].username}/get`));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<Schema, 'GET', '/users/:username/get'>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, `/users/${users[0].username}/get`));

      expect(response.request.path).toBe(`/users/${users[0].username}/get`);
      expectTypeOf(response.request.path).toEqualTypeOf<`/users/${string}/get`>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
    });
  });

  it('should support requests with dynamic paths containing one parameter at the end of the path', async () => {
    type Schema = HttpSchema<{
      '/users/:username': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get(`/users/${users[0].username}`)
        .respond({
          status: 200,
          body: users[0],
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch(`/users/${users[0].username}`, { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users[0]);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users/:username'>>();

      expect(response.url).toBe(joinURL(baseURL, `/users/${users[0].username}`));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users/:username'>>();

      expect(response.request.url).toBe(joinURL(baseURL, `/users/${users[0].username}`));

      expect(response.request.path).toBe(`/users/${users[0].username}`);
      expectTypeOf(response.request.path).toEqualTypeOf<`/users/${string}`>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
    });
  });

  it('should support requests with dynamic paths containing multiple, non-consecutive parameters', async () => {
    type Schema = HttpSchema<{
      '/users/:username/get/:other': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get(`/users/${users[0].username}/get/${users[1].username}`)
        .respond({
          status: 200,
          body: users[0],
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch(`/users/${users[0].username}/get/${users[1].username}`, { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users[0]);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<Schema, 'GET', '/users/:username/get/:other'>
      >();

      expect(response.url).toBe(joinURL(baseURL, `/users/${users[0].username}/get/${users[1].username}`));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<Schema, 'GET', '/users/:username/get/:other'>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, `/users/${users[0].username}/get/${users[1].username}`));

      expect(response.request.path).toBe(`/users/${users[0].username}/get/${users[1].username}`);
      expectTypeOf(response.request.path).toEqualTypeOf<`/users/${string}/get/${string}`>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
    });
  });

  it('should support requests with dynamic paths containing multiple, consecutive parameters', async () => {
    type Schema = HttpSchema<{
      '/users/:username/:other': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get(`/users/${users[0].username}/${users[1].username}`)
        .respond({
          status: 200,
          body: users[0],
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch(`/users/${users[0].username}/${users[1].username}`, { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users[0]);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<Schema, 'GET', '/users/:username/:other'>
      >();

      expect(response.url).toBe(joinURL(baseURL, `/users/${users[0].username}/${users[1].username}`));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<Schema, 'GET', '/users/:username/:other'>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, `/users/${users[0].username}/${users[1].username}`));

      expect(response.request.path).toBe(`/users/${users[0].username}/${users[1].username}`);
      expectTypeOf(response.request.path).toEqualTypeOf<`/users/${string}/${string}`>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
    });
  });

  it('should support requests with dynamic paths containing multiple, consecutive parameters ending with static path', async () => {
    type Schema = HttpSchema<{
      '/users/:username/:other/get': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get(`/users/${users[0].username}/${users[1].username}/get`)
        .respond({
          status: 200,
          body: users[0],
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch(`/users/${users[0].username}/${users[1].username}/get`, { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users[0]);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponse<Schema, 'GET', '/users/:username/:other/get'>
      >();

      expect(response.url).toBe(joinURL(baseURL, `/users/${users[0].username}/${users[1].username}/get`));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<
        FetchRequest<Schema, 'GET', '/users/:username/:other/get'>
      >();

      expect(response.request.url).toBe(joinURL(baseURL, `/users/${users[0].username}/${users[1].username}/get`));

      expect(response.request.path).toBe(`/users/${users[0].username}/${users[1].username}/get`);
      expectTypeOf(response.request.path).toEqualTypeOf<`/users/${string}/${string}/get`>();

      expect(response.request.method).toBe('GET');
      expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
    });
  });

  it('should support requests with static paths that conflict with a dynamic path, preferring the former', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };

      '/:username': {
        GET: {
          response: {
            200: { body: User };
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

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));
    });
  });
});
