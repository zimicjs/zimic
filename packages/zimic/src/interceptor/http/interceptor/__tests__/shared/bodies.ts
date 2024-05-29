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

    const invalidJSONString = '<invalid-json>';
    const invalidFormDataString = '<invalid-form-data>';
    const invalidURLSearchParamsString = '<invalid-url-search-params>';

    type UserJSONSchema = User;

    type UserFormDataSchema = HttpSchema.FormData<{
      tag: File;
    }>;

    type UserSearchParamsSchema = HttpSchema.SearchParams<{
      tag?: string;
    }>;

    describe('JSON', () => {
      it(`should try to parse the body of a ${method} request as JSON if no content type exists`, async () => {
        type UserMethodSchema = HttpSchema.Method<{
          request: { body: UserJSONSchema };
          response: { 200: { body: User } };
        }>;

        await usingHttpInterceptor<{
          '/users/:id': {
            POST: UserMethodSchema;
            PUT: UserMethodSchema;
            PATCH: UserMethodSchema;
            DELETE: UserMethodSchema;
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
            headers: { 'content-type': '' },
            body: JSON.stringify(users[0]),
          });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;
          expect(request).toBeInstanceOf(Request);

          expect(request.headers.get('content-type')).toBe('');
          expectTypeOf(request.body).toEqualTypeOf<User>();
          expect(request.body).toEqual(users[0]);
        });
      });

      it(`should fallback the body of a ${method} request to text if could not be parsed as JSON and no content type exists`, async () => {
        type UserMethodSchema = HttpSchema.Method<{
          request: { body: string };
          response: { 200: { body: User } };
        }>;

        await usingHttpInterceptor<{
          '/users/:id': {
            POST: UserMethodSchema;
            PUT: UserMethodSchema;
            PATCH: UserMethodSchema;
            DELETE: UserMethodSchema;
          };
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users/:id').respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<string>();
              expect(request.body).toBe(invalidJSONString);

              return { status: 200, body: users[0] };
            }),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            headers: { 'content-type': '' },
            body: invalidJSONString,
          });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;
          expect(request).toBeInstanceOf(Request);

          expect(request.headers.get('content-type')).toBe('');
          expectTypeOf(request.body).toEqualTypeOf<string>();
          expect(request.body).toBe(invalidJSONString);
        });
      });

      it(`should try to parse the body of a ${method} request as JSON if the body contains an unknown content type`, async () => {
        type UserMethodSchema = HttpSchema.Method<{
          request: { body: UserJSONSchema };
          response: { 200: { body: User } };
        }>;

        await usingHttpInterceptor<{
          '/users/:id': {
            POST: UserMethodSchema;
            PUT: UserMethodSchema;
            PATCH: UserMethodSchema;
            DELETE: UserMethodSchema;
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
            headers: { 'content-type': 'unknown' },
            body: JSON.stringify(users[0]),
          });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;
          expect(request).toBeInstanceOf(Request);

          expect(request.headers.get('content-type')).toBe('unknown');
          expectTypeOf(request.body).toEqualTypeOf<User>();
          expect(request.body).toEqual(users[0]);
        });
      });

      it(`should fallback the body of a ${method} request to text if could not be parsed as JSON and the content type is unknown`, async () => {
        type UserMethodSchema = HttpSchema.Method<{
          request: { body: string };
          response: { 200: { body: User } };
        }>;

        await usingHttpInterceptor<{
          '/users/:id': {
            POST: UserMethodSchema;
            PUT: UserMethodSchema;
            PATCH: UserMethodSchema;
            DELETE: UserMethodSchema;
          };
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users/:id').respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<string>();
              expect(request.body).toBe(invalidJSONString);

              return { status: 200, body: users[0] };
            }),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            headers: { 'content-type': 'unknown' },
            body: invalidJSONString,
          });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;
          expect(request).toBeInstanceOf(Request);

          expect(request.headers.get('content-type')).toBe('unknown');
          expectTypeOf(request.body).toEqualTypeOf<string>();
          expect(request.body).toBe(invalidJSONString);
        });
      });

      it(`should show an error and skip parsing if the body of a ${method} request is defined as JSON, but it is not valid`, async () => {
        type UserMethodSchema = HttpSchema.Method<{
          request: { body: UserJSONSchema };
          response: { 200: { body: User } };
        }>;

        await usingHttpInterceptor<{
          '/users/:id': {
            POST: UserMethodSchema;
            PUT: UserMethodSchema;
            PATCH: UserMethodSchema;
            DELETE: UserMethodSchema;
          };
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users/:id').respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<User>();
              expect(request.body).toBe(null);

              return { status: 200, body: users[0] };
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
              body: invalidJSONString,
            });
            expect(response.status).toBe(200);

            expect(spies.error).toHaveBeenCalledTimes(1);
            expect(spies.error).toHaveBeenCalledWith(new InvalidJSONError(invalidJSONString));
          });

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;
          expect(request).toBeInstanceOf(Request);

          expect(request.headers.get('content-type')).toBe('application/json');
          expectTypeOf(request.body).toEqualTypeOf<User>();
          expect(request.body).toBe(null);
        });
      });
    });

    describe('Form data', () => {
      it(`should support intercepting ${method} requests having a form data body`, async () => {
        type UserMethodSchema = HttpSchema.Method<{
          request: { body: HttpFormData<UserFormDataSchema> };
          response: { 200: { body: User } };
        }>;

        await usingHttpInterceptor<{
          '/users/:id': {
            POST: UserMethodSchema;
            PUT: UserMethodSchema;
            PATCH: UserMethodSchema;
            DELETE: UserMethodSchema;
          };
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users/:id').respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<HttpFormData<UserFormDataSchema>>();
              expect(request.body).toBeInstanceOf(HttpFormData);

              return { status: 200, body: users[0] };
            }),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          const formData = new HttpFormData<UserFormDataSchema>();
          const tagFile = new File(['content'], 'tag.txt', { type: 'text/plain' });
          formData.append('tag', tagFile);

          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            body: formData,
          });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;
          expect(request).toBeInstanceOf(Request);

          expect(request.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=.+$/);
          expectTypeOf(request.body).toEqualTypeOf<HttpFormData<UserFormDataSchema>>();
          expect(request.body).toBeInstanceOf(HttpFormData);
          expect(request.body).toEqual(formData);

          const requestTagFile = request.body.get('tag');
          expect(requestTagFile).toEqual(tagFile);
          expect(requestTagFile.name).toBe(tagFile.name);
          expect(requestTagFile.size).toBe(tagFile.size);
          expect(requestTagFile.type).toBe(tagFile.type);
          expect(await requestTagFile.text()).toEqual(await tagFile.text());
        });
      });

      it(`should show an error and skip parsing if the body of a ${method} request is defined as form data, but it is not valid`, async () => {
        type UserMethodSchema = HttpSchema.Method<{
          request: { body: HttpFormData<UserFormDataSchema> };
          response: { 200: { body: User } };
        }>;

        await usingHttpInterceptor<{
          '/users/:id': {
            POST: UserMethodSchema;
            PUT: UserMethodSchema;
            PATCH: UserMethodSchema;
            DELETE: UserMethodSchema;
          };
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users/:id').respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<HttpFormData<UserFormDataSchema>>();
              expect(request.body).toBe(null);

              return { status: 200, body: users[0] };
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
              body: invalidFormDataString,
            });
            expect(response.status).toBe(200);

            expect(spies.error).toHaveBeenCalledTimes(1);
            expect(spies.error).toHaveBeenCalledWith(new InvalidFormDataError(invalidFormDataString));
          });

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;
          expect(request).toBeInstanceOf(Request);

          expect(request.headers.get('content-type')).toBe('multipart/form-data');
          expectTypeOf(request.body).toEqualTypeOf<HttpFormData<UserFormDataSchema>>();
          expect(request.body).toBe(null);
        });
      });
    });

    describe('URL search params', () => {
      it(`should support intercepting ${method} requests having a URL search params body`, async () => {
        type UserMethodSchema = HttpSchema.Method<{
          request: { body: HttpSearchParams<UserSearchParamsSchema> };
          response: { 200: { body: User } };
        }>;

        await usingHttpInterceptor<{
          '/users/:id': {
            POST: UserMethodSchema;
            PUT: UserMethodSchema;
            PATCH: UserMethodSchema;
            DELETE: UserMethodSchema;
          };
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users/:id').respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<HttpSearchParams<UserSearchParamsSchema>>();
              expect(request.body).toBeInstanceOf(HttpSearchParams);

              return { status: 200, body: users[0] };
            }),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          const searchParams = new HttpSearchParams<UserSearchParamsSchema>({
            tag: 'admin',
          });

          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            body: searchParams,
          });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;
          expect(request).toBeInstanceOf(Request);

          expect(request.headers.get('content-type')).toBe('application/x-www-form-urlencoded;charset=UTF-8');
          expectTypeOf(request.body).toEqualTypeOf<HttpSearchParams<UserSearchParamsSchema>>();
          expect(request.body).toBeInstanceOf(HttpSearchParams);
          expect(request.body).toEqual(searchParams);
          expect(request.body.get('tag')).toEqual('admin');
        });
      });

      it(`should not show an error and not skip parsing if the body of a ${method} request is defined as URL search params, but it is not valid`, async () => {
        type UserMethodSchema = HttpSchema.Method<{
          request: { body: HttpSearchParams<UserSearchParamsSchema> };
          response: { 200: { body: User } };
        }>;

        await usingHttpInterceptor<{
          '/users/:id': {
            POST: UserMethodSchema;
            PUT: UserMethodSchema;
            PATCH: UserMethodSchema;
            DELETE: UserMethodSchema;
          };
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users/:id').respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<HttpSearchParams<UserSearchParamsSchema>>();
              expect(request.body).toBeInstanceOf(HttpSearchParams);
              expect(Object.fromEntries(request.body)).toEqual({ [invalidURLSearchParamsString]: '' });

              return { status: 200, body: users[0] };
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
              body: invalidURLSearchParamsString,
            });
            expect(response.status).toBe(200);

            expect(spies.error).not.toHaveBeenCalled();
          });

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;
          expect(request).toBeInstanceOf(Request);

          expect(request.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
          expectTypeOf(request.body).toEqualTypeOf<HttpSearchParams<UserSearchParamsSchema>>();
          expect(request.body).toBeInstanceOf(HttpSearchParams);
          expect(Object.fromEntries(request.body)).toEqual({ [invalidURLSearchParamsString]: '' });
        });
      });
    });

    describe('Plain text', () => {
      it(`should support intercepting ${method} requests having a plain text body`, async () => {
        type UserMethodSchema = HttpSchema.Method<{
          request: { body: string };
          response: { 200: { body: User } };
        }>;

        await usingHttpInterceptor<{
          '/users/:id': {
            POST: UserMethodSchema;
            PUT: UserMethodSchema;
            PATCH: UserMethodSchema;
            DELETE: UserMethodSchema;
          };
        }>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users/:id').respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<string>();
              expect(request.body).toBe('content');

              return { status: 200, body: users[0] };
            }),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          let requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(0);

          const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method,
            headers: { 'content-type': 'text/plain' },
            body: 'content',
          });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
          const [request] = requests;
          expect(request).toBeInstanceOf(Request);

          expect(request.headers.get('content-type')).toBe('text/plain');
          expectTypeOf(request.body).toEqualTypeOf<string>();
          expect(request.body).toBe('content');
        });
      });
    });

    describe('Blob', () => {
      it.each(['binary', 'image', 'audio', 'font', 'video'])(
        `should support intercepting ${method} requests having a binary body: %s`,
        async (format) => {
          type UserMethodSchema = HttpSchema.Method<{
            request: { body: Blob };
            response: { 200: { body: User } };
          }>;

          await usingHttpInterceptor<{
            '/users/:id': {
              POST: UserMethodSchema;
              PUT: UserMethodSchema;
              PATCH: UserMethodSchema;
              DELETE: UserMethodSchema;
            };
          }>(interceptorOptions, async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor[lowerMethod]('/users/:id').respond((request) => {
                expectTypeOf(request.body).toEqualTypeOf<Blob>();
                expect(request.body).toBeInstanceOf(Blob);

                return { status: 200, body: users[0] };
              }),
              interceptor,
            );
            expect(handler).toBeInstanceOf(Handler);

            let requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(0);

            let file: File;
            if (format === 'image') {
              file = new File(['content'], 'image.png', { type: 'image/png' });
            } else if (format === 'audio') {
              file = new File(['content'], 'audio.mp3', { type: 'audio/mpeg' });
            } else if (format === 'font') {
              file = new File(['content'], 'font.ttf', { type: 'font/ttf' });
            } else if (format === 'video') {
              file = new File(['content'], 'video.mp4', { type: 'video/mp4' });
            } else {
              file = new File(['content'], 'file.bin', { type: 'application/octet-stream' });
            }

            const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
              method,
              headers: { 'content-type': file.type },
              body: file,
            });
            expect(response.status).toBe(200);

            requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(1);
            const [request] = requests;
            expect(request).toBeInstanceOf(Request);

            expect(request.headers.get('content-type')).toBe(file.type);
            expectTypeOf(request.body).toEqualTypeOf<Blob>();
            expect(request.body).toBeInstanceOf(Blob);
            expect(request.body.type).toBe(file.type);
            expect(request.body.size).toBe(file.size);
            expect(await request.body.text()).toEqual(await file.text());
          });
        },
      );
    });
  });
}
