import { HttpSchema } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/http/requestHandler/RemoteHttpRequestHandler';
import { importCrypto } from '@/utils/crypto';
import { importFile } from '@/utils/files';
import { HTTP_METHODS_WITH_REQUEST_BODY } from '@/utils/http';
import { randomInt } from '@/utils/numbers';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../utils';

async function createRandomFile(
  contentType:
    | 'image/png'
    | 'audio/mp3'
    | 'font/ttf'
    | 'video/mp4'
    | 'application/pdf'
    | 'application/octet-stream'
    | 'multipart/mixed',
): Promise<File> {
  const File = await importFile();

  const randomContent = Uint8Array.from({ length: 1024 }, () => randomInt(0, 256));

  if (contentType === 'image/png') {
    return new File([randomContent], 'image.png', { type: contentType });
  } else if (contentType === 'audio/mp3') {
    return new File([randomContent], 'audio.mp3', { type: contentType });
  } else if (contentType === 'font/ttf') {
    return new File([randomContent], 'font.ttf', { type: contentType });
  } else if (contentType === 'video/mp4') {
    return new File([randomContent], 'video.mp4', { type: contentType });
  } else if (contentType === 'application/pdf') {
    return new File([randomContent], 'file.pdf', { type: contentType });
  } else {
    return new File([randomContent], 'file.bin', { type: contentType });
  }
}

export async function declareBinaryBodyHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  const crypto = await importCrypto();

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: crypto.randomUUID(), name: 'User 1' },
    { id: crypto.randomUUID(), name: 'User 2' },
  ];

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  const Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler =
    options.type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  describe.each(Array.from(HTTP_METHODS_WITH_REQUEST_BODY))('Method (%s)', (method) => {
    const lowerMethod = method.toLowerCase<'POST'>();

    it.each([
      'image/png',
      'audio/mp3',
      'font/ttf',
      'video/mp4',
      'application/pdf',
      'application/octet-stream',
      'multipart/mixed',
    ] as const)(`should support binary file bodies in intercepted ${method} requests: %s`, async (contentType) => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: Blob;
        };
        response: {
          200: {
            headers?: { 'content-type'?: string };
            body: Blob;
          };
        };
      }>;

      await usingHttpInterceptor<{
        '/users/:id': {
          POST: MethodSchema;
          PUT: MethodSchema;
          PATCH: MethodSchema;
          DELETE: MethodSchema;
        };
      }>(interceptorOptions, async (interceptor) => {
        const responseFile = await createRandomFile(contentType);

        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users/:id').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<Blob>();
            expect(request.body).toBeInstanceOf(Blob);

            return { status: 200, body: responseFile };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        expect(handler.requests).toHaveLength(0);

        const requestFile = await createRandomFile(contentType);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': contentType },
          body: requestFile,
        });

        expect(response.status).toBe(200);
        const fetchedFile = await response.blob();
        expect(fetchedFile).toBeInstanceOf(Blob);
        expect(fetchedFile.type).toBe(responseFile.type);
        expect(fetchedFile.size).toBe(responseFile.size);
        expect(await fetchedFile.text()).toEqual(await responseFile.text());

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe(contentType);
        expectTypeOf(request.body).toEqualTypeOf<Blob>();
        expect(request.body).toBeInstanceOf(Blob);
        expect(request.body.type).toBe(contentType);
        expect(request.body.size).toBe(requestFile.size);
        expect(await request.body.text()).toEqual(await requestFile.text());

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe(responseFile.type);
        expectTypeOf(request.response.body).toEqualTypeOf<Blob>();
        expect(request.response.body).toBeInstanceOf(Blob);
        expect(request.response.body.type).toBe(responseFile.type);
        expect(request.response.body.size).toBe(responseFile.size);
        expect(await request.response.body.text()).toEqual(await responseFile.text());

        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(request.raw.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(request.raw.blob).toEqualTypeOf<() => Promise<Blob>>();
        expect(await request.raw.blob()).toEqual(request.body);
        expectTypeOf(request.raw.text).toEqualTypeOf<() => Promise<string>>();

        expect(Object.fromEntries(response.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.response.raw.headers)),
        );
        expectTypeOf(request.response.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.response.raw.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(request.response.raw.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(request.response.raw.blob).toEqualTypeOf<() => Promise<Blob>>();
        expect(await request.response.raw.blob()).toEqual(request.response.body);
        expectTypeOf(request.response.raw.text).toEqualTypeOf<() => Promise<string>>();
      });
    });

    it(`should support binary array buffer bodies in intercepted ${method} requests`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: ArrayBuffer;
        };
        response: {
          200: {
            headers?: { 'content-type'?: string };
            body: ArrayBuffer;
          };
        };
      }>;

      await usingHttpInterceptor<{
        '/users/:id': {
          POST: MethodSchema;
          PUT: MethodSchema;
          PATCH: MethodSchema;
          DELETE: MethodSchema;
        };
      }>(interceptorOptions, async (interceptor) => {
        const requestArrayBuffer = new ArrayBuffer(2);
        const requestView = new Uint8Array(requestArrayBuffer);
        requestView[0] = 0xff;
        requestView[1] = 0x00;

        const responseBuffer = new ArrayBuffer(2);
        const responseView = new Uint8Array(responseBuffer);
        responseView[0] = 0x00;
        responseView[1] = 0xff;

        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users/:id')
            .with({
              body: requestArrayBuffer,
            })
            .respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<Blob>();
              expect(request.body).toBeInstanceOf(Blob);

              return {
                status: 200,
                headers: { 'content-type': 'application/octet-stream' },
                body: responseBuffer,
              };
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/octet-stream' },
          body: requestArrayBuffer,
          ...{ duplex: 'half' },
        });

        expect(response.status).toBe(200);
        expect(await response.arrayBuffer()).toEqual(responseBuffer);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/octet-stream');
        expectTypeOf(request.body).toEqualTypeOf<Blob>();
        expect(request.body).toBeInstanceOf(Blob);
        expect(request.body.type).toBe('application/octet-stream');
        expect(request.body.size).toBe(requestArrayBuffer.byteLength);
        expect(await request.body.arrayBuffer()).toEqual(requestArrayBuffer);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/octet-stream');
        expectTypeOf(request.response.body).toEqualTypeOf<Blob>();
        expect(request.response.body).toBeInstanceOf(Blob);
        expect(request.response.body.type).toBe('application/octet-stream');
        expect(request.response.body.size).toBe(responseBuffer.byteLength);
        expect(await request.response.body.arrayBuffer()).toEqual(responseBuffer);

        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(request.raw.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(request.raw.blob).toEqualTypeOf<() => Promise<Blob>>();
        expect(await request.raw.blob()).toEqual(request.body);
        expectTypeOf(request.raw.text).toEqualTypeOf<() => Promise<string>>();

        expect(Object.fromEntries(response.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.response.raw.headers)),
        );
        expectTypeOf(request.response.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.response.raw.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(request.response.raw.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(request.response.raw.blob).toEqualTypeOf<() => Promise<Blob>>();
        expect(await request.response.raw.blob()).toEqual(request.response.body);
        expectTypeOf(request.response.raw.text).toEqualTypeOf<() => Promise<string>>();
      });
    });

    it(`should support binary stream bodies in intercepted ${method} requests`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: ReadableStream;
        };
        response: {
          200: {
            headers?: { 'content-type'?: string };
            body: ReadableStream;
          };
        };
      }>;

      await usingHttpInterceptor<{
        '/users/:id': {
          POST: MethodSchema;
          PUT: MethodSchema;
          PATCH: MethodSchema;
          DELETE: MethodSchema;
        };
      }>(interceptorOptions, async (interceptor) => {
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

        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users/:id')
            .with({
              body: restrictedRequestStream,
            })
            .respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<Blob>();
              expect(request.body).toBeInstanceOf(Blob);

              return {
                status: 200,
                headers: { 'content-type': 'application/octet-stream' },
                body: responseStream,
              };
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        expect(handler.requests).toHaveLength(0);

        // HTTP streaming is only supported in HTTP >=2 on browsers. Since the interceptor server uses HTTP/1.1,
        // streaming won't work in browsers with remote interceptors.
        const isStreamingSupported = options.type !== 'remote' || options.platform !== 'browser';

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/octet-stream' },
          body: isStreamingSupported ? requestStream : new Blob(['abc'], { type: 'application/octet-stream' }),
          ...{ duplex: 'half' },
        });

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('def');

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/octet-stream');
        expectTypeOf(request.body).toEqualTypeOf<Blob>();
        expect(request.body).toBeInstanceOf(Blob);
        expect(request.body.type).toBe('application/octet-stream');
        expect(request.body.size).toBe(3);
        expect(await request.body.text()).toEqual('abc');

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/octet-stream');
        expectTypeOf(request.response.body).toEqualTypeOf<Blob>();
        expect(request.response.body).toBeInstanceOf(Blob);
        expect(request.response.body.type).toBe('application/octet-stream');
        expect(request.response.body.size).toBe(3);
        expect(await request.response.body.text()).toEqual('def');

        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(request.raw.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(request.raw.blob).toEqualTypeOf<() => Promise<Blob>>();
        expect(await request.raw.blob()).toEqual(request.body);
        expectTypeOf(request.raw.text).toEqualTypeOf<() => Promise<string>>();

        expect(Object.fromEntries(response.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.response.raw.headers)),
        );
        expectTypeOf(request.response.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.response.raw.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(request.response.raw.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(request.response.raw.blob).toEqualTypeOf<() => Promise<Blob>>();
        expect(await request.response.raw.blob()).toEqual(request.response.body);
        expectTypeOf(request.response.raw.text).toEqualTypeOf<() => Promise<string>>();
      });
    });

    it(`should consider empty ${method} request or response binary bodies as blob`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body?: Blob;
        };
        response: {
          200: {
            headers: { 'content-type': string };
            body?: Blob;
          };
        };
      }>;

      await usingHttpInterceptor<{
        '/users/:id': {
          POST: MethodSchema;
          PUT: MethodSchema;
          PATCH: MethodSchema;
          DELETE: MethodSchema;
        };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users/:id').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<Blob | null>();
            expect(request.body).toBeInstanceOf(Blob);
            expect(request.body!.size).toBe(0);

            return {
              status: 200,
              headers: { 'content-type': 'application/octet-stream' },
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/octet-stream' },
        });

        expect(response.status).toBe(200);
        const fetchedFile = await response.blob();
        expect(fetchedFile).toBeInstanceOf(Blob);
        expect(fetchedFile.size).toBe(0);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/octet-stream');
        expectTypeOf(request.body).toEqualTypeOf<Blob | null>();
        expect(request.body).toBeInstanceOf(Blob);
        expect(request.body!.size).toBe(0);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/octet-stream');
        expectTypeOf(request.response.body).toEqualTypeOf<Blob | null>();
        expect(request.response.body).toBeInstanceOf(Blob);
        expect(request.response.body!.size).toBe(0);
      });
    });

    it(`should consider array buffer ${method} request bodies as blob`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: ArrayBuffer;
        };
        response: {
          200: {
            headers: { 'content-type'?: string };
            body: ArrayBuffer;
          };
        };
      }>;

      await usingHttpInterceptor<{
        '/users/:id': {
          POST: MethodSchema;
          PUT: MethodSchema;
          PATCH: MethodSchema;
          DELETE: MethodSchema;
        };
      }>(interceptorOptions, async (interceptor) => {
        const responseBuffer = new ArrayBuffer(2);
        const responseView = new Uint8Array(responseBuffer);
        responseView[0] = 0x00;
        responseView[1] = 0xff;

        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users/:id').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<Blob>();
            expect(request.body).toBeInstanceOf(Blob);

            return {
              status: 200,
              headers: { 'content-type': 'application/octet-stream' },
              body: responseBuffer,
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        expect(handler.requests).toHaveLength(0);

        const requestBuffer = new ArrayBuffer(2);
        const requestView = new Uint8Array(requestBuffer);
        requestView[0] = 0xff;
        requestView[1] = 0x00;

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'application/octet-stream' },
          body: requestBuffer,
        });

        expect(response.status).toBe(200);
        const fetchedFile = await response.blob();
        expect(fetchedFile).toBeInstanceOf(Blob);
        expect(fetchedFile.type).toBe('application/octet-stream');
        expect(fetchedFile.size).toBe(2);
        expect(await fetchedFile.arrayBuffer()).toEqual(responseBuffer);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('application/octet-stream');
        expectTypeOf(request.body).toEqualTypeOf<Blob>();
        expect(request.body).toBeInstanceOf(Blob);
        expect(request.body.type).toBe('application/octet-stream');
        expect(request.body.size).toBe(2);
        expect(await request.body.arrayBuffer()).toEqual(requestBuffer);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('application/octet-stream');
        expectTypeOf(request.response.body).toEqualTypeOf<Blob>();
        expect(request.response.body).toBeInstanceOf(Blob);
        expect(request.response.body.type).toBe('application/octet-stream');
        expect(request.response.body.size).toBe(2);
        expect(await request.response.body.arrayBuffer()).toEqual(responseBuffer);

        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<FormData>>();

        expect(Object.fromEntries(response.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.response.raw.headers)),
        );
        expectTypeOf(request.response.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.response.raw.formData).toEqualTypeOf<() => Promise<FormData>>();
      });
    });
  });
}
