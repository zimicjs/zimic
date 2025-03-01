import { HttpSchema, StrictHeaders } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import createFetch from '../factory';
import { FetchRequest, FetchResponse } from '../types/requests';

describe('FetchClient > Bodies > Blob', () => {
  const baseURL = 'http://localhost:3000';

  it('should support requests and responses with a blob body', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/octet-stream' };
            body: Blob;
          };
          response: {
            201: { body: Blob };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      const requestBlob = new Blob(['request'], { type: 'application/octet-stream' });
      const responseBlob = new Blob(['response'], { type: 'application/octet-stream' });

      await interceptor
        .post('/users')
        .with({ body: requestBlob })
        .respond({
          status: 201,
          body: responseBlob,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: requestBlob,
      });

      expect(response.status).toBe(201);
      const receivedResponseBlob = await response.blob();
      expect(receivedResponseBlob.size).toBe(responseBlob.size);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<never>>();
      expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectTypeOf(response.blob).toEqualTypeOf<() => Promise<Blob>>();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/octet-stream' }>
      >();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<never>>();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectTypeOf(response.request.blob).toEqualTypeOf<() => Promise<Blob>>();
      expect(await response.request.blob()).toEqual(requestBlob);
      expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should consider requests and responses with empty blob bodies as null', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/octet-stream' };
            body?: Blob;
          };
          response: {
            201: {
              headers: { 'content-type': 'application/octet-stream' };
              body?: Blob;
            };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .respond({
          status: 201,
          headers: { 'content-type': 'application/octet-stream' },
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
      });

      expect(response.status).toBe(201);
      expect(await response.blob()).toEqual(new Blob([], { type: 'application/octet-stream' }));

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/octet-stream' }>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectTypeOf(response.blob).toEqualTypeOf<() => Promise<Blob>>();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/octet-stream' }>
      >();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectTypeOf(response.request.blob).toEqualTypeOf<() => Promise<Blob>>();
      expect(await response.request.blob()).toEqual(new Blob([], { type: 'application/octet-stream' }));
      expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should support requests and responses with an array buffer body', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/octet-stream' };
            body: ArrayBuffer;
          };
          response: {
            201: { body: ArrayBuffer };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      const requestArrayBuffer = new ArrayBuffer(2);
      const requestView = new Uint8Array(requestArrayBuffer);
      requestView[0] = 0xff;
      requestView[1] = 0x00;

      const responseBuffer = new ArrayBuffer(2);
      const responseView = new Uint8Array(responseBuffer);
      responseView[0] = 0x00;
      responseView[1] = 0xff;

      await interceptor
        .post('/users')
        .with({ body: new Blob([requestArrayBuffer], { type: 'application/octet-stream' }) })
        .respond({
          status: 201,
          body: new Blob([responseBuffer], { type: 'application/octet-stream' }),
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: requestArrayBuffer,
      });

      expect(response.status).toBe(201);
      expect(await response.arrayBuffer()).toEqual(responseBuffer);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<never>>();
      expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/octet-stream' }>
      >();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<never>>();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectTypeOf(response.request.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expect(await response.request.arrayBuffer()).toEqual(requestArrayBuffer);
      expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should consider requests and responses with empty array buffer bodies as null', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/octet-stream' };
            body?: ArrayBuffer;
          };
          response: {
            201: {
              headers: { 'content-type': 'application/octet-stream' };
              body?: ArrayBuffer;
            };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .respond({
          status: 201,
          headers: { 'content-type': 'application/octet-stream' },
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
      });

      expect(response.status).toBe(201);
      expect(await response.arrayBuffer()).toEqual(new ArrayBuffer(0));

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/octet-stream' }>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
      expectTypeOf(response.error).toEqualTypeOf<null>();

      expect(response.request).toBeInstanceOf(Request);
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/octet-stream' }>
      >();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectTypeOf(response.request.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expect(await response.request.arrayBuffer()).toEqual(new ArrayBuffer(0));
      expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });
});
