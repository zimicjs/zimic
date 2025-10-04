import { HttpSchema, HttpFormData, HttpRequest, HttpResponse, StrictFormData, InvalidFormDataError } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import color from 'picocolors';
import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/http/requestHandler/RemoteHttpRequestHandler';
import { importCrypto } from '@/utils/crypto';
import { importFile } from '@/utils/files';
import { HTTP_METHODS_WITH_REQUEST_BODY } from '@/utils/http';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../utils';

export async function declareFormDataBodyHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

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

  const Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  describe.each(Array.from(HTTP_METHODS_WITH_REQUEST_BODY))('Method (%s)', (method) => {
    const lowerMethod = method.toLowerCase<'POST'>();

    const invalidRequestFormDataString = '<invalid-request-form-data>';
    const invalidResponseFormDataString = '<invalid-response-form-data>';

    type UserFormDataSchema = HttpSchema.FormData<{
      tag: File;
    }>;

    it(`should support intercepting ${method} requests having a form data body`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: HttpFormData<UserFormDataSchema>;
        };
        response: {
          200: {
            headers?: { 'content-type'?: string };
            body: HttpFormData<UserFormDataSchema>;
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
        const File = await importFile();

        const responseFormData = new HttpFormData<UserFormDataSchema>();
        const responseTagFile = new File(['response'], 'tag.txt', { type: 'text/plain' });
        responseFormData.append('tag', responseTagFile);

        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users/:id').respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<HttpFormData<UserFormDataSchema>>();
            expect(request.body).toBeInstanceOf(HttpFormData);

            return { status: 200, body: responseFormData };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        expect(handler.requests).toHaveLength(0);

        const formData = new HttpFormData<UserFormDataSchema>();
        const requestTagFile = new File(['request'], 'tag.txt', { type: 'text/plain' });
        formData.append('tag', requestTagFile);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          body: formData,
        });
        expect(response.status).toBe(200);

        const fetchedFormData = await response.formData();
        expect(fetchedFormData).toBeInstanceOf(FormData);
        expect(Array.from(fetchedFormData.keys())).toEqual(Array.from(responseFormData.keys()));

        const fetchedTagFile = fetchedFormData.get('tag')! as File;
        expect(await fetchedTagFile.arrayBuffer()).toEqual(await responseTagFile.arrayBuffer());
        expect(fetchedTagFile.name).toBe(responseTagFile.name);
        expect(fetchedTagFile.size).toBe(responseTagFile.size);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=.+$/);
        expectTypeOf(request.body).toEqualTypeOf<HttpFormData<UserFormDataSchema>>();
        expect(request.body).toBeInstanceOf(HttpFormData);
        expect(Array.from(request.body.keys())).toEqual(expect.arrayContaining(Array.from(formData.keys())));

        const interceptedRequestTagFile = request.body.get('tag');
        expect(interceptedRequestTagFile.name).toBe(requestTagFile.name);
        expect(interceptedRequestTagFile.size).toBe(requestTagFile.size);
        expect(interceptedRequestTagFile.type).toBe(requestTagFile.type);
        expect(await interceptedRequestTagFile.arrayBuffer()).toEqual(await requestTagFile.arrayBuffer());

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=.+$/);
        expectTypeOf(request.response.body).toEqualTypeOf<HttpFormData<UserFormDataSchema>>();
        expect(request.response.body).toBeInstanceOf(HttpFormData);
        expect(Array.from(request.response.body.keys())).toEqual(
          expect.arrayContaining(Array.from(responseFormData.keys())),
        );

        const interceptedResponseTagFile = request.response.body.get('tag');
        expect(interceptedResponseTagFile.name).toBe(responseTagFile.name);
        expect(interceptedResponseTagFile.size).toBe(responseTagFile.size);
        expect(interceptedResponseTagFile.type).toBe(responseTagFile.type);
        expect(await interceptedResponseTagFile.arrayBuffer()).toEqual(await responseTagFile.arrayBuffer());

        expectTypeOf(request.raw).toEqualTypeOf<
          HttpRequest<HttpFormData<UserFormDataSchema>, { 'content-type': string }>
        >();
        expect(request.raw).toBeInstanceOf(Request);
        expect(request.raw.url).toBe(request.url);
        expect(request.raw.method).toBe(method);
        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<StrictFormData<UserFormDataSchema>>>();
        expect(Array.from((await request.raw.formData()).keys())).toEqual(Array.from(formData.keys()));

        expectTypeOf(request.response.raw).toEqualTypeOf<
          HttpResponse<HttpFormData<UserFormDataSchema>, { 'content-type'?: string }, 200>
        >();
        expect(request.response.raw).toBeInstanceOf(Response);
        expectTypeOf(request.response.raw.status).toEqualTypeOf<200>();
        expect(request.response.raw.status).toBe(200);
        expect(Object.fromEntries(response.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.response.raw.headers)),
        );
        expectTypeOf(request.response.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.response.raw.formData).toEqualTypeOf<() => Promise<StrictFormData<UserFormDataSchema>>>();
        expect(Array.from((await request.response.raw.formData()).keys())).toEqual(Array.from(responseFormData.keys()));
      });
    });

    it(`should show an error and skip parsing if the body of a ${method} request or response is defined as form data, but it is not valid`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body: string;
        };
        response: {
          200: {
            headers: { 'content-type': string };
            body: string;
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
            expectTypeOf(request.body).toEqualTypeOf<string>();
            expect(request.body).toBe(null);

            return {
              status: 200,
              headers: { 'content-type': 'multipart/form-data' },
              body: invalidResponseFormDataString,
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['error'], async (console) => {
          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            headers: { 'content-type': 'multipart/form-data' },
            body: invalidRequestFormDataString,
          });
          expect(response.status).toBe(200);

          expect(console.error).toHaveBeenCalledTimes(2);
          expect(console.error.mock.calls).toEqual([
            [
              color.cyan('[@zimic/interceptor]'),
              'Failed to parse request body:',
              new InvalidFormDataError(invalidRequestFormDataString),
            ],
            [
              color.cyan('[@zimic/interceptor]'),
              'Failed to parse response body:',
              new InvalidFormDataError(invalidResponseFormDataString),
            ],
          ]);
        });

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('multipart/form-data');
        expectTypeOf(request.body).toEqualTypeOf<string>();
        expect(request.body).toBe(null);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('multipart/form-data');
        expectTypeOf(request.response.body).toEqualTypeOf<string>();
        expect(request.response.body).toBe(null);
      });
    });

    it(`should consider empty ${method} request or response form data bodies as form data`, async () => {
      type MethodSchema = HttpSchema.Method<{
        request: {
          headers: { 'content-type': string };
          body?: HttpFormData<UserFormDataSchema>;
        };
        response: {
          200: {
            headers: { 'content-type': string };
            body?: HttpFormData<UserFormDataSchema>;
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
            expectTypeOf(request.body).toEqualTypeOf<HttpFormData<UserFormDataSchema> | null>();
            expect(request.body).toBe(null);

            return {
              status: 200,
              headers: { 'content-type': 'multipart/form-data' },
            };
          }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        expect(handler.requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'multipart/form-data' },
        });
        expect(response.status).toBe(200);

        const fetchedFormData = await response.text();
        expect(fetchedFormData).toBe('');

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toBe('multipart/form-data');
        expectTypeOf(request.body).toEqualTypeOf<HttpFormData<UserFormDataSchema> | null>();
        expect(request.body).toBe(null);

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toBe('multipart/form-data');
        expectTypeOf(request.response.body).toEqualTypeOf<HttpFormData<UserFormDataSchema> | null>();
        expect(request.response.body).toBe(null);
      });
    });
  });
}
