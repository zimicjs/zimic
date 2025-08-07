import { HttpSchema, StrictHeaders } from '@zimic/http';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { expectResponseStatus } from '@tests/utils/requests';

import createFetch from '../factory';

describe('FetchClient > Bodies > Binary', () => {
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
            201: {
              headers: { 'content-type': 'application/octet-stream' };
              body: Blob;
            };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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

      expectResponseStatus(response, 201);
      const receivedResponseBlob = await response.blob();
      expect(receivedResponseBlob.size).toBe(responseBlob.size);

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/octet-stream' }>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<never>>();
      expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.blob).toEqualTypeOf<() => Promise<Blob>>();
      expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/octet-stream' }>
      >();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<never>>();
      expectTypeOf(response.request.blob).toEqualTypeOf<() => Promise<Blob>>();
      expect(await response.request.blob()).toEqual(requestBlob);
      expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should consider requests and responses with empty blob bodies', async () => {
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

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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

      expectResponseStatus(response, 201);
      expect(await response.blob()).toEqual(new Blob([], { type: 'application/octet-stream' }));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/octet-stream' }>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.blob).toEqualTypeOf<() => Promise<Blob>>();
      expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/octet-stream' }>
      >();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
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
            201: {
              headers: { 'content-type': 'application/octet-stream' };
              body: ArrayBuffer;
            };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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
        .with({
          body: requestArrayBuffer,
        })
        .respond({
          status: 201,
          body: responseBuffer,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: requestArrayBuffer,
      });

      expectResponseStatus(response, 201);
      expect(await response.arrayBuffer()).toEqual(responseBuffer);

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/octet-stream' }>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<never>>();
      expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/octet-stream' }>
      >();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<never>>();
      expectTypeOf(response.request.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expect(await response.request.arrayBuffer()).toEqual(requestArrayBuffer);
      expectTypeOf(response.request.blob).toEqualTypeOf<() => Promise<Blob>>();
      expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should consider requests and responses with empty array buffer bodies', async () => {
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

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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

      expectResponseStatus(response, 201);
      expect(await response.arrayBuffer()).toEqual(new ArrayBuffer(0));

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/octet-stream' }>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/octet-stream' }>
      >();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.request.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expect(await response.request.arrayBuffer()).toEqual(new ArrayBuffer(0));
      expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.request.blob).toEqualTypeOf<() => Promise<Blob>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should support request and responses with an stream body', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/octet-stream' };
            body: ReadableStream;
          };
          response: {
            201: {
              headers: { 'content-type': 'application/octet-stream' };
              body: ReadableStream;
            };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      function startRequestStream(controller: ReadableStreamDefaultController<Uint8Array>) {
        controller.enqueue(new Uint8Array(['a'.charCodeAt(0)]));
        controller.enqueue(new Uint8Array(['b'.charCodeAt(0)]));
        controller.enqueue(new Uint8Array(['c'.charCodeAt(0)]));
        controller.close();
      }

      const requestStream = new ReadableStream<Uint8Array>({ start: startRequestStream });
      const restrictedRequestStream = new ReadableStream<Uint8Array>({ start: startRequestStream });

      function startResponseStream(controller: ReadableStreamDefaultController<Uint8Array>) {
        controller.enqueue(new Uint8Array(['d'.charCodeAt(0)]));
        controller.enqueue(new Uint8Array(['e'.charCodeAt(0)]));
        controller.enqueue(new Uint8Array(['f'.charCodeAt(0)]));
        controller.close();
      }

      const responseStream = new ReadableStream<Uint8Array>({ start: startResponseStream });

      await interceptor
        .post('/users')
        .with({
          body: restrictedRequestStream,
        })
        .respond({
          status: 201,
          body: responseStream,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: requestStream,
        duplex: 'half',
      });

      expectResponseStatus(response, 201);
      expect(await response.text()).toBe('def');

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/octet-stream' }>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<never>>();
      expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.blob).toEqualTypeOf<() => Promise<Blob>>();
      expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/octet-stream' }>
      >();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<never>>();
      expectTypeOf(response.request.blob).toEqualTypeOf<() => Promise<Blob>>();
      expectTypeOf(response.request.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expectTypeOf(response.request.blob).toEqualTypeOf<() => Promise<Blob>>();
      expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
      expect(await response.request.text()).toBe('abc');
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });

  it('should consider requests and responses with empty stream bodies', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/octet-stream' };
            body?: ReadableStream;
          };
          response: {
            201: {
              headers: { 'content-type': 'application/octet-stream' };
              body?: ReadableStream;
            };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      function startRequestStream(controller: ReadableStreamDefaultController<Uint8Array>) {
        controller.close();
      }

      const requestStream = new ReadableStream<Uint8Array>({ start: startRequestStream });
      const restrictedRequestStream = new ReadableStream<Uint8Array>({ start: startRequestStream });

      function startResponseStream(controller: ReadableStreamDefaultController<Uint8Array>) {
        controller.close();
      }

      const responseStream = new ReadableStream<Uint8Array>({ start: startResponseStream });

      await interceptor
        .post('/users')
        .with({
          body: restrictedRequestStream,
        })
        .respond({
          status: 201,
          headers: { 'content-type': 'application/octet-stream' },
          body: responseStream,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: requestStream,
        duplex: 'half',
      });

      expectResponseStatus(response, 201);
      expect(await response.text()).toBe('');

      expect(response.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/octet-stream' }>>();

      expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.blob).toEqualTypeOf<() => Promise<Blob>>();
      expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<
        StrictHeaders<{ 'content-type': 'application/octet-stream' }>
      >();
      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.request.blob).toEqualTypeOf<() => Promise<Blob>>();
      expectTypeOf(response.request.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
      expectTypeOf(response.request.blob).toEqualTypeOf<() => Promise<Blob>>();
      expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
      expect(await response.request.text()).toBe('');
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });
});
