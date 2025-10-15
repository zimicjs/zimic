import { HttpSchema, StrictHeaders } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { expectResponseStatus } from '@tests/utils/requests';

import createFetch from '../factory';
import { FetchRequest, FetchResponse } from '../types/requests';

describe('FetchClient > Bodies > Plain text', () => {
  const baseURL = 'http://localhost:3000';

  it('should support requests and responses with a plain text body', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'text/plain' };
            body: 'request';
          };
          response: {
            201: { body: 'response' };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .with({ body: 'request' })
        .respond({
          status: 201,
          body: 'response',
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'request',
      });

      expectResponseStatus(response, 201);
      expect(await response.text()).toBe('response');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<never>>();
      expectTypeOf(response.text).toEqualTypeOf<() => Promise<'response'>>();
      expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'text/plain' }>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<never>>();
      expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<'request'>>();
      expect(await response.request.text()).toBe('request');
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should consider requests and responses with empty plain text bodies as empty', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'text/plain' };
            body?: 'request';
          };
          response: {
            201: { body?: 'response' };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .respond({
          status: 201,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
      });

      expectResponseStatus(response, 201);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<never>>();
      expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'text/plain' }>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<never>>();
      expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
      expect(await response.request.text()).toBe('');
      expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });
});
