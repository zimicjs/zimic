import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import InvalidFormDataError from '@/http/errors/InvalidFormDataError';
import HttpFormData from '@/http/formData/HttpFormData';
import { HttpRequest, HttpResponse } from '@/http/types/requests';
import { HTTP_METHODS_WITH_REQUEST_BODY, HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { importCrypto } from '@/utils/crypto';
import { importFile } from '@/utils/files';
import { joinURL } from '@/utils/urls';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../utils';

export async function declareFormDataBodyHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
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

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Handler = options.type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;
  });

  describe.each(HTTP_METHODS_WITH_REQUEST_BODY)('Method (%s)', (method) => {
    const lowerMethod = method.toLowerCase<'POST'>(); // Only consider POST to reduce type unions

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

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

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

        const fetchedTagFile = fetchedFormData.get('tag')!;
        expect(fetchedTagFile).toEqual(responseTagFile);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

        expect(request).toBeInstanceOf(Request);
        expect(request.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=.+$/);
        expectTypeOf(request.body).toEqualTypeOf<HttpFormData<UserFormDataSchema>>();
        expect(request.body).toBeInstanceOf(HttpFormData);
        expect(request.body).toEqual(formData);

        const interceptedRequestTagFile = request.body.get('tag');
        expect(interceptedRequestTagFile).toEqual(requestTagFile);
        expect(interceptedRequestTagFile.name).toBe(requestTagFile.name);
        expect(interceptedRequestTagFile.size).toBe(requestTagFile.size);
        expect(interceptedRequestTagFile.type).toBe(requestTagFile.type);
        expect(await interceptedRequestTagFile.text()).toEqual(await requestTagFile.text());

        expect(request.response).toBeInstanceOf(Response);
        expect(request.response.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=.+$/);
        expectTypeOf(request.response.body).toEqualTypeOf<HttpFormData<UserFormDataSchema>>();
        expect(request.response.body).toBeInstanceOf(HttpFormData);
        expect(request.response.body).toEqual(responseFormData);

        const interceptedResponseTagFile = request.response.body.get('tag');
        expect(interceptedResponseTagFile).toEqual(responseTagFile);
        expect(interceptedResponseTagFile.name).toBe(responseTagFile.name);
        expect(interceptedResponseTagFile.size).toBe(responseTagFile.size);
        expect(interceptedResponseTagFile.type).toBe(responseTagFile.type);
        expect(await interceptedResponseTagFile.text()).toEqual(await responseTagFile.text());

        expectTypeOf(request.raw).toEqualTypeOf<HttpRequest<HttpFormData<UserFormDataSchema>>>();
        expect(request.raw).toBeInstanceOf(Request);
        expect(request.raw.url).toBe(request.url);
        expect(request.raw.method).toBe(method);
        expect(Object.fromEntries(request.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.raw.headers)),
        );
        expectTypeOf(request.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.raw.formData).toEqualTypeOf<() => Promise<HttpFormData<UserFormDataSchema>>>();
        expect(Object.fromEntries(await request.raw.formData())).toEqual(Object.fromEntries(formData));

        expectTypeOf(request.response.raw).toEqualTypeOf<HttpResponse<HttpFormData<UserFormDataSchema>, 200>>();
        expect(request.response.raw).toBeInstanceOf(Response);
        expectTypeOf(request.response.raw.status).toEqualTypeOf<200>();
        expect(request.response.raw.status).toBe(200);
        expect(Object.fromEntries(response.headers)).toEqual(
          expect.objectContaining(Object.fromEntries(request.response.raw.headers)),
        );
        expectTypeOf(request.response.raw.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(request.response.raw.formData).toEqualTypeOf<() => Promise<HttpFormData<UserFormDataSchema>>>();
        expect(Object.fromEntries(await request.response.raw.formData())).toEqual(Object.fromEntries(responseFormData));
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

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        await usingIgnoredConsole(['error'], async (spies) => {
          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            headers: { 'content-type': 'multipart/form-data' },
            body: invalidRequestFormDataString,
          });
          expect(response.status).toBe(200);

          expect(spies.error).toHaveBeenCalledTimes(2);
          expect(spies.error.mock.calls).toEqual([
            [new InvalidFormDataError(invalidRequestFormDataString)],
            [new InvalidFormDataError(invalidResponseFormDataString)],
          ]);
        });

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

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

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method,
          headers: { 'content-type': 'multipart/form-data' },
        });
        expect(response.status).toBe(200);

        const fetchedFormData = await response.text();
        expect(fetchedFormData).toBe('');

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);
        const [request] = requests;

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
