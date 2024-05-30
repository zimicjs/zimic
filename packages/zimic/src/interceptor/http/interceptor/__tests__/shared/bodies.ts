import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import HttpFormData from '@/http/formData/HttpFormData';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HTTP_METHODS_WITH_REQUEST_BODY, HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import InvalidFormDataError from '@/interceptor/http/interceptorWorker/errors/InvalidFormDataError';
import InvalidJSONError from '@/interceptor/http/interceptorWorker/errors/InvalidJSONError';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { JSONValue } from '@/types/json';
import { getCrypto } from '@/utils/crypto';
import { joinURL } from '@/utils/urls';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './types';

function createSampleFile(format: string, content: string[]) {
  if (format === 'image') {
    return new File(content, 'image.png', { type: 'image/png' });
  } else if (format === 'audio') {
    return new File(content, 'audio.mp3', { type: 'audio/mpeg' });
  } else if (format === 'font') {
    return new File(content, 'font.ttf', { type: 'font/ttf' });
  } else if (format === 'video') {
    return new File(content, 'video.mp4', { type: 'video/mp4' });
  } else {
    return new File(content, 'file.bin', { type: 'application/octet-stream' });
  }
}

export async function declareBodyHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  const crypto = await getCrypto();

  type User = JSONValue<{
    id: string;
    name: string;
  }>;

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

  describe.each(HTTP_METHODS_WITH_REQUEST_BODY)('Method: %s', (method) => {
    const lowerMethod = method.toLowerCase<typeof method>();

    const invalidRequestJSONString = '<invalid-request-json>';
    const invalidResponseJSONString = '<invalid-response-json>';
    const invalidRequestFormDataString = '<invalid-request-form-data>';
    const invalidResponseFormDataString = '<invalid-response-form-data>';
    const invalidRequestURLSearchParamsString = '<invalid-request-url-search-params>';
    const invalidResponseURLSearchParamsString = '<invalid-response-url-search-params>';

    type UserJSONSchema = User;

    type UserFormDataSchema = HttpSchema.FormData<{
      tag: File;
    }>;

    type UserSearchParamsSchema = HttpSchema.SearchParams<{
      tag?: string;
    }>;

    describe('JSON', () => {
      it(`should support intercepting ${method} requests having a JSON body`, async () => {
        type MethodSchema = HttpSchema.Method<{
          request: { body: UserJSONSchema };
          response: { 200: { body: UserJSONSchema } };
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
              expectTypeOf(request.body).toEqualTypeOf<User>();
              expect(request.body).toEqual(users[0]);

              return { status: 200, body: users[0] };
            }),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(users[0]),
          });
          expect(response.status).toBe(200);

          const fetchedUser = (await response.json()) as UserJSONSchema;
          expect(fetchedUser).toEqual(users[0]);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;

          expect(request).toBeInstanceOf(Request);
          expect(request.headers.get('content-type')).toBe('application/json');
          expectTypeOf(request.body).toEqualTypeOf<User>();
          expect(request.body).toEqual(users[0]);

          expect(request.response).toBeInstanceOf(Response);
          expect(request.response.headers.get('content-type')).toBe('application/json');
          expectTypeOf(request.response.body).toEqualTypeOf<UserJSONSchema>();
          expect(request.response.body).toEqual(users[0]);
        });
      });

      it(`should try to parse the body of a ${method} request or response as JSON if no content type exists`, async () => {
        type MethodSchema = HttpSchema.Method<{
          request: {
            headers: { 'content-type': string };
            body: UserJSONSchema;
          };
          response: {
            200: {
              headers: { 'content-type': string };
              body: UserJSONSchema;
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
              expectTypeOf(request.body).toEqualTypeOf<User>();
              expect(request.body).toEqual(users[0]);

              return {
                status: 200,
                headers: { 'content-type': '' },
                body: users[0],
              };
            }),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            headers: { 'content-type': '' },
            body: JSON.stringify(users[0]),
          });
          expect(response.status).toBe(200);

          const fetchedUser = (await response.json()) as UserJSONSchema;
          expect(fetchedUser).toEqual(users[0]);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;

          expect(request).toBeInstanceOf(Request);
          expect(request.headers.get('content-type')).toBe('');
          expectTypeOf(request.body).toEqualTypeOf<User>();
          expect(request.body).toEqual(users[0]);

          expect(request.response).toBeInstanceOf(Response);
          expect(request.response.headers.get('content-type')).toBe('');
          expectTypeOf(request.response.body).toEqualTypeOf<UserJSONSchema>();
          expect(request.response.body).toEqual(users[0]);
        });
      });

      it(`should fallback the body of a ${method} request or response to text if could not be parsed as JSON and no content type exists`, async () => {
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
              expect(request.body).toBe(invalidRequestJSONString);

              return {
                status: 200,
                headers: { 'content-type': '' },
                body: invalidResponseJSONString,
              };
            }),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            headers: { 'content-type': '' },
            body: invalidRequestJSONString,
          });
          expect(response.status).toBe(200);

          const fetchedBody = await response.text();
          expect(fetchedBody).toBe(invalidResponseJSONString);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;

          expect(request).toBeInstanceOf(Request);
          expect(request.headers.get('content-type')).toBe('');
          expectTypeOf(request.body).toEqualTypeOf<string>();
          expect(request.body).toBe(invalidRequestJSONString);

          expect(request.response).toBeInstanceOf(Response);
          expect(request.response.headers.get('content-type')).toBe('');
          expectTypeOf(request.response.body).toEqualTypeOf<string>();
          expect(request.response.body).toBe(invalidResponseJSONString);
        });
      });

      it(`should try to parse the body of a ${method} request or response as JSON if the body contains an unknown content type`, async () => {
        type MethodSchema = HttpSchema.Method<{
          request: {
            headers: { 'content-type': string };
            body: UserJSONSchema;
          };
          response: {
            200: {
              headers: { 'content-type': string };
              body: UserJSONSchema;
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
              expectTypeOf(request.body).toEqualTypeOf<User>();
              expect(request.body).toEqual(users[0]);

              return {
                status: 200,
                headers: { 'content-type': 'unknown' },
                body: users[0],
              };
            }),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            headers: { 'content-type': 'unknown' },
            body: JSON.stringify(users[0]),
          });
          expect(response.status).toBe(200);

          const fetchedUser = (await response.json()) as UserJSONSchema;
          expect(fetchedUser).toEqual(users[0]);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;

          expect(request).toBeInstanceOf(Request);
          expect(request.headers.get('content-type')).toBe('unknown');
          expectTypeOf(request.body).toEqualTypeOf<User>();
          expect(request.body).toEqual(users[0]);

          expect(request.response).toBeInstanceOf(Response);
          expect(request.response.headers.get('content-type')).toBe('unknown');
          expectTypeOf(request.response.body).toEqualTypeOf<UserJSONSchema>();
          expect(request.response.body).toEqual(users[0]);
        });
      });

      it(`should fallback the body of a ${method} request or response to text if could not be parsed as JSON and the content type is unknown`, async () => {
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
              expect(request.body).toBe(invalidRequestJSONString);

              return {
                status: 200,
                headers: { 'content-type': 'unknown' },
                body: invalidResponseJSONString,
              };
            }),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            headers: { 'content-type': 'unknown' },
            body: invalidRequestJSONString,
          });
          expect(response.status).toBe(200);

          const fetchedBody = await response.text();
          expect(fetchedBody).toBe(invalidResponseJSONString);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;

          expect(request).toBeInstanceOf(Request);
          expect(request.headers.get('content-type')).toBe('unknown');
          expectTypeOf(request.body).toEqualTypeOf<string>();
          expect(request.body).toBe(invalidRequestJSONString);

          expect(request.response).toBeInstanceOf(Response);
          expect(request.response.headers.get('content-type')).toBe('unknown');
          expectTypeOf(request.response.body).toEqualTypeOf<string>();
          expect(request.response.body).toBe(invalidResponseJSONString);
        });
      });

      it(`should show an error and skip parsing if the body of a ${method} request or response is defined as JSON, but it is not valid`, async () => {
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
                headers: { 'content-type': 'application/json' },
                body: invalidResponseJSONString,
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
              headers: { 'content-type': 'application/json' },
              body: invalidRequestJSONString,
            });
            expect(response.status).toBe(200);

            const fetchedBody = await response.text();
            expect(fetchedBody).toBe(invalidResponseJSONString);

            expect(spies.error).toHaveBeenCalledTimes(2);
            expect(spies.error.mock.calls).toEqual([
              [new InvalidJSONError(invalidRequestJSONString)],
              [new InvalidJSONError(invalidResponseJSONString)],
            ]);
          });

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;

          expect(request).toBeInstanceOf(Request);
          expect(request.headers.get('content-type')).toBe('application/json');
          expectTypeOf(request.body).toEqualTypeOf<string>();
          expect(request.body).toBe(null);

          expect(request.response).toBeInstanceOf(Response);
          expect(request.response.headers.get('content-type')).toBe('application/json');
          expectTypeOf(request.response.body).toEqualTypeOf<string>();
          expect(request.response.body).toBe(null);
        });
      });
    });

    describe('Form data', () => {
      it(`should support intercepting ${method} requests having a form data body`, async () => {
        type MethodSchema = HttpSchema.Method<{
          request: { body: HttpFormData<UserFormDataSchema> };
          response: { 200: { body: HttpFormData<UserFormDataSchema> } };
        }>;

        await usingHttpInterceptor<{
          '/users/:id': {
            POST: MethodSchema;
            PUT: MethodSchema;
            PATCH: MethodSchema;
            DELETE: MethodSchema;
          };
        }>(interceptorOptions, async (interceptor) => {
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
    });

    describe('URL search params', () => {
      it(`should support intercepting ${method} requests having a URL search params body`, async () => {
        type MethodSchema = HttpSchema.Method<{
          request: { body: HttpSearchParams<UserSearchParamsSchema> };
          response: { 200: { body: HttpSearchParams<UserSearchParamsSchema> } };
        }>;

        await usingHttpInterceptor<{
          '/users/:id': {
            POST: MethodSchema;
            PUT: MethodSchema;
            PATCH: MethodSchema;
            DELETE: MethodSchema;
          };
        }>(interceptorOptions, async (interceptor) => {
          const responseSearchParams = new HttpSearchParams<UserSearchParamsSchema>({ tag: 'admin-response' });

          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users/:id').respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<HttpSearchParams<UserSearchParamsSchema>>();
              expect(request.body).toBeInstanceOf(HttpSearchParams);

              return { status: 200, body: responseSearchParams };
            }),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          const requestSearchParams = new HttpSearchParams<UserSearchParamsSchema>({ tag: 'admin' });

          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            body: requestSearchParams,
          });
          expect(response.status).toBe(200);

          const fetchedSearchParams = await response.formData();
          expect(fetchedSearchParams).toBeInstanceOf(FormData);
          expect(Array.from(fetchedSearchParams.keys())).toEqual(Array.from(responseSearchParams.keys()));

          const fetchedTag = fetchedSearchParams.get('tag')!;
          expect(fetchedTag).toBe(responseSearchParams.get('tag'));

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;

          expect(request).toBeInstanceOf(Request);
          expect(request.headers.get('content-type')).toBe('application/x-www-form-urlencoded;charset=UTF-8');
          expectTypeOf(request.body).toEqualTypeOf<HttpSearchParams<UserSearchParamsSchema>>();
          expect(request.body).toBeInstanceOf(HttpSearchParams);
          expect(request.body).toEqual(requestSearchParams);
          expect(request.body.get('tag')).toEqual('admin');

          expect(request.response).toBeInstanceOf(Response);
          expect(request.response.headers.get('content-type')).toBe('application/x-www-form-urlencoded;charset=UTF-8');
          expectTypeOf(request.response.body).toEqualTypeOf<HttpSearchParams<UserSearchParamsSchema>>();
          expect(request.response.body).toBeInstanceOf(HttpSearchParams);
          expect(request.response.body).toEqual(responseSearchParams);
        });
      });

      it(`should not show an error and skip parsing if the body of a ${method} request or response is defined as URL search params, but it is not valid`, async () => {
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
              expect(request.body).toBeInstanceOf(HttpSearchParams);
              expect(request.body).toEqual(new HttpSearchParams({ [invalidRequestURLSearchParamsString]: '' }));

              return {
                status: 200,
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: invalidResponseURLSearchParamsString,
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
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              body: invalidRequestURLSearchParamsString,
            });
            expect(response.status).toBe(200);

            expect(spies.error).not.toHaveBeenCalled();
          });

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;

          expect(request).toBeInstanceOf(Request);
          expect(request.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
          expectTypeOf(request.body).toEqualTypeOf<string>();
          expect(request.body).toBeInstanceOf(HttpSearchParams);
          expect(request.body).toEqual(new HttpSearchParams({ [invalidRequestURLSearchParamsString]: '' }));

          expect(request.response).toBeInstanceOf(Response);
          expect(request.response.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
          expectTypeOf(request.response.body).toEqualTypeOf<string>();
          expect(request.response.body).toBeInstanceOf(HttpSearchParams);
          expect(request.response.body).toEqual(new HttpSearchParams({ [invalidResponseURLSearchParamsString]: '' }));
        });
      });
    });

    describe('Plain text', () => {
      it(`should support intercepting ${method} requests having a plain text body`, async () => {
        type MethodSchema = HttpSchema.Method<{
          request: { body: string };
          response: { 200: { body: string } };
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
              expect(request.body).toBe('content');

              return { status: 200, body: 'content-response' };
            }),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            body: 'content',
          });
          expect(response.status).toBe(200);

          const fetchedBody = await response.text();
          expect(fetchedBody).toBe('content-response');

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;

          expect(request).toBeInstanceOf(Request);
          expect(request.headers.get('content-type')).toBe('text/plain;charset=UTF-8');
          expectTypeOf(request.body).toEqualTypeOf<string>();
          expect(request.body).toBe('content');

          expect(request.response).toBeInstanceOf(Response);
          expect(request.response.headers.get('content-type')).toBe('text/plain;charset=UTF-8');
          expectTypeOf(request.response.body).toEqualTypeOf<string>();
          expect(request.response.body).toBe('content-response');
        });
      });
    });

    describe('Blob', () => {
      it.each(['binary', 'image', 'audio', 'font', 'video'])(
        `should support intercepting ${method} requests having a binary body: %s`,
        async (format) => {
          type MethodSchema = HttpSchema.Method<{
            request: { body: Blob };
            response: { 200: { body: Blob } };
          }>;

          await usingHttpInterceptor<{
            '/users/:id': {
              POST: MethodSchema;
              PUT: MethodSchema;
              PATCH: MethodSchema;
              DELETE: MethodSchema;
            };
          }>(interceptorOptions, async (interceptor) => {
            const responseFile = createSampleFile(format, ['response']);

            const handler = await promiseIfRemote(
              interceptor[lowerMethod]('/users/:id').respond((request) => {
                expectTypeOf(request.body).toEqualTypeOf<Blob>();
                expect(request.body).toBeInstanceOf(Blob);

                return { status: 200, body: responseFile };
              }),
              interceptor,
            );
            expect(handler).toBeInstanceOf(Handler);

            let requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(0);

            const requestFile = createSampleFile(format, ['request']);

            const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
              method,
              headers: { 'content-type': requestFile.type },
              body: requestFile,
            });
            expect(response.status).toBe(200);

            const fetchedFile = await response.blob();
            expect(fetchedFile).toBeInstanceOf(Blob);
            expect(fetchedFile.type).toBe(responseFile.type);
            expect(fetchedFile.size).toBe(responseFile.size);
            expect(await fetchedFile.text()).toEqual(await responseFile.text());

            requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(1);
            const [request] = requests;

            expect(request).toBeInstanceOf(Request);
            expect(request.headers.get('content-type')).toBe(requestFile.type);
            expectTypeOf(request.body).toEqualTypeOf<Blob>();
            expect(request.body).toBeInstanceOf(Blob);
            expect(request.body.type).toBe(requestFile.type);
            expect(request.body.size).toBe(requestFile.size);
            expect(await request.body.text()).toEqual(await requestFile.text());

            expect(request.response).toBeInstanceOf(Response);
            expect(request.response.headers.get('content-type')).toBe(responseFile.type);
            expectTypeOf(request.response.body).toEqualTypeOf<Blob>();
            expect(request.response.body).toBeInstanceOf(Blob);
            expect(request.response.body.type).toBe(responseFile.type);
            expect(request.response.body.size).toBe(responseFile.size);
            expect(await request.response.body.text()).toEqual(await responseFile.text());
          });
        },
      );
    });
  });
}
