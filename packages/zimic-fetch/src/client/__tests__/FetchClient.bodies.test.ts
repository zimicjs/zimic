import { HttpSchema } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { expectResponseStatus } from '@tests/utils/requests';

import createFetch from '../factory';
import { FetchRequest } from '../types/requests';

describe('FetchClient > Bodies', () => {
  const baseURL = 'http://localhost:3000';

  it('should show a type error if trying to use a non-assignable request body', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            body: { name?: string };
          };
          response: { 204: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      interceptor.post('/users').respond({ status: 204 });

      const fetch = createFetch<Schema>({ baseURL });

      // @ts-expect-error The content type was not declared
      await fetch('/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'User 1' }),
      });

      // @ts-expect-error The content type is incorrect
      await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'other' },
        body: JSON.stringify({ name: 'User 1' }),
      });

      await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'User 1' }),
      });

      await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });

      // @ts-expect-error Forcing an invalid request body
      await fetch('/users', {
        method: 'POST',
        body: 'invalid',
      });
    });
  });

  it('should support requests with no body and no request declaration', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          response: { 204: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.post('/users').respond({ status: 204 }).times(8);

      const fetch = createFetch<Schema>({ baseURL });

      const responses = [
        await fetch('/users', { method: 'POST' }),
        await fetch('/users', { method: 'POST', body: null }),
        await fetch('/users', { method: 'POST', body: undefined }),
        // @ts-expect-error Forcing a body
        await fetch('/users', { method: 'POST', body: {} }),
      ];

      for (const request of [
        new fetch.Request('/users', { method: 'POST' }),
        new fetch.Request('/users', { method: 'POST', body: null }),
        new fetch.Request('/users', { method: 'POST', body: undefined }),
        // @ts-expect-error Forcing some headers
        new fetch.Request('/users', { method: 'POST', body: {} }),
      ]) {
        expect(request).toBeInstanceOf(Request);
        expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

        expect(request.url).toBe(joinURL(baseURL, '/users'));

        expectTypeOf(request.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(request.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(request.formData).toEqualTypeOf<() => Promise<never>>();

        const response = await fetch(request);
        responses.push(response);
      }

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<204>();
        expectResponseStatus(response, 204);

        expect(await response.text()).toBe('');
      }
    });
  });

  it('should support requests with no body and an empty request declaration', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {};
          response: { 204: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor.post('/users').respond({ status: 204 }).times(8);

      const fetch = createFetch<Schema>({ baseURL });

      const responses = [
        await fetch('/users', { method: 'POST' }),
        await fetch('/users', { method: 'POST', body: null }),
        await fetch('/users', { method: 'POST', body: undefined }),
        // @ts-expect-error Forcing a body
        await fetch('/users', { method: 'POST', body: {} }),
      ];

      for (const request of [
        new fetch.Request('/users', { method: 'POST' }),
        new fetch.Request('/users', { method: 'POST', body: null }),
        new fetch.Request('/users', { method: 'POST', body: undefined }),
        // @ts-expect-error Forcing some headers
        new fetch.Request('/users', { method: 'POST', body: {} }),
      ]) {
        expect(request).toBeInstanceOf(Request);
        expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

        expect(request.url).toBe(joinURL(baseURL, '/users'));

        expectTypeOf(request.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(request.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(request.formData).toEqualTypeOf<() => Promise<never>>();

        const response = await fetch(request);
        responses.push(response);
      }

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<204>();
        expectResponseStatus(response, 204);

        expect(await response.text()).toBe('');
      }
    });
  });

  it('should support requests with no body and a non-empty request declaration', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: { headers: { language: string } };
          response: { 204: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const headers = { language: 'en' };

      await interceptor.post('/users').with({ headers }).respond({ status: 204 }).times(8);

      const fetch = createFetch<Schema>({ baseURL });

      const responses = [
        await fetch('/users', { method: 'POST', headers }),
        await fetch('/users', { method: 'POST', headers, body: null }),
        await fetch('/users', { method: 'POST', headers, body: undefined }),
        // @ts-expect-error Forcing a body
        await fetch('/users', { method: 'POST', headers, body: {} }),
      ];

      for (const request of [
        new fetch.Request('/users', { method: 'POST', headers }),
        new fetch.Request('/users', { method: 'POST', headers, body: null }),
        new fetch.Request('/users', { method: 'POST', headers, body: undefined }),
        // @ts-expect-error Forcing some headers
        new fetch.Request('/users', { method: 'POST', headers, body: {} }),
      ]) {
        expect(request).toBeInstanceOf(Request);
        expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

        expect(request.url).toBe(joinURL(baseURL, '/users'));

        expectTypeOf(request.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(request.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(request.formData).toEqualTypeOf<() => Promise<never>>();

        const response = await fetch(request);
        responses.push(response);
      }

      for (const response of responses) {
        expectTypeOf(response.status).toEqualTypeOf<204>();
        expectResponseStatus(response, 204);

        expect(await response.text()).toBe('');
      }
    });
  });
});
