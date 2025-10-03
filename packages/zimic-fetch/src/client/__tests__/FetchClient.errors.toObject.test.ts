import {
  HttpFormData,
  HttpSchema,
  HttpSearchParams,
  InvalidFormDataError,
  InvalidJSONError,
  JSONValue,
} from '@zimic/http';
import { DeepPartial, PossiblePromise } from '@zimic/utils/types';
import joinURL from '@zimic/utils/url/joinURL';
import color from 'picocolors';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { isClientSide } from '@/utils/environment';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { expectResponseStatus } from '@tests/utils/requests';

import FetchResponseError, {
  FetchResponseErrorObject,
  FetchResponseErrorObjectOptions,
} from '../errors/FetchResponseError';
import createFetch from '../factory';

describe('FetchClient > Errors > toObject', () => {
  const baseURL = 'http://localhost:3000';

  type User = JSONValue<{
    id: string;
    name: string;
  }>;

  const users: User[] = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
  ];

  it.each([
    { includeRequestBody: undefined, includeResponseBody: undefined },
    { includeRequestBody: false as const, includeResponseBody: undefined },
    { includeRequestBody: undefined, includeResponseBody: false as const },
    { includeRequestBody: false as const, includeResponseBody: false as const },
  ] satisfies FetchResponseErrorObjectOptions[])(
    'should convert a response error to a plain object (%o)',
    async ({ includeRequestBody, includeResponseBody }) => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'application/json' };
              body: User;
            };
            response: {
              409: { body: { code: 409; message: string } };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
        await interceptor
          .post('/users')
          .respond({
            status: 409,
            body: { code: 409, message: 'Conflict' },
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(users[0]),
        });

        expectResponseStatus(response, 409);
        expect(response.ok).toBe(false);

        expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'POST', '/users'>>();

        const errorObject = response.error.toObject({ includeRequestBody, includeResponseBody });
        expectTypeOf(errorObject).toEqualTypeOf<FetchResponseErrorObject>();

        expect(errorObject).toEqual<FetchResponseErrorObject>({
          message: `POST ${joinURL(baseURL, '/users')} failed with status 409: `,
          name: 'FetchResponseError',
          request: {
            url: joinURL(baseURL, '/users'),
            path: '/users',
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            cache: 'default',
            destination: '',
            credentials: 'same-origin',
            integrity: '',
            keepalive: false,
            mode: 'cors',
            redirect: 'follow',
            referrer: 'about:client',
            referrerPolicy: '',
          },
          response: {
            url: joinURL(baseURL, '/users'),
            type: isClientSide() ? 'basic' : 'default',
            status: 409,
            statusText: '',
            ok: false,
            headers: { 'content-type': 'application/json' },
            redirected: false,
          },
        });
      });
    },
  );

  it.each([
    { includeRequestBody: true as const, includeResponseBody: undefined },
    { includeRequestBody: undefined, includeResponseBody: true as const },
    { includeRequestBody: true as const, includeResponseBody: true as const },
  ] satisfies FetchResponseErrorObjectOptions[])(
    'should convert a response error to a plain object (%o)',
    async ({ includeRequestBody, includeResponseBody }) => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'application/json' };
              body: User;
            };
            response: {
              409: { body: { code: 409; message: string } };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
        await interceptor
          .post('/users')
          .respond({
            status: 409,
            body: { code: 409, message: 'Conflict' },
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(users[0]),
        });

        expectResponseStatus(response, 409);
        expect(response.ok).toBe(false);

        expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'POST', '/users'>>();

        const errorObjectPromise = response.error.toObject({ includeRequestBody, includeResponseBody });
        expectTypeOf(errorObjectPromise).toEqualTypeOf<PossiblePromise<FetchResponseErrorObject>>();

        const errorObject = await errorObjectPromise;

        expect(errorObject).toEqual<FetchResponseErrorObject>({
          message: `POST ${joinURL(baseURL, '/users')} failed with status 409: `,
          name: 'FetchResponseError',
          request: {
            url: joinURL(baseURL, '/users'),
            path: '/users',
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: includeRequestBody ? users[0] : undefined,
            cache: 'default',
            destination: '',
            credentials: 'same-origin',
            integrity: '',
            keepalive: false,
            mode: 'cors',
            redirect: 'follow',
            referrer: 'about:client',
            referrerPolicy: '',
          },
          response: {
            url: joinURL(baseURL, '/users'),
            type: isClientSide() ? 'basic' : 'default',
            status: 409,
            statusText: '',
            ok: false,
            headers: { 'content-type': 'application/json' },
            body: includeResponseBody ? { code: 409, message: 'Conflict' } : undefined,
            redirected: false,
          },
        });
      });
    },
  );

  describe('JSON', () => {
    it('should parse JSON bodies when converting a response error to a plain object', async () => {
      type RequestBodySchema = User;

      type ResponseBodySchema = JSONValue<{
        code: 409;
        message: string;
      }>;

      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'application/json' };
              body: RequestBodySchema;
            };
            response: {
              409: {
                headers: { 'content-type': 'application/json' };
                body: ResponseBodySchema;
              };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
        const requestBody: RequestBodySchema = users[0];
        const responseBody: ResponseBodySchema = { code: 409, message: 'Conflict' };

        await interceptor

          .post('/users')
          .respond({
            status: 409,
            body: responseBody,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        expectResponseStatus(response, 409);

        const errorObject = await response.error.toObject({
          includeRequestBody: true,
          includeResponseBody: true,
        });

        expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
          request: {
            headers: { 'content-type': 'application/json' },
            body: requestBody,
          },
          response: {
            headers: { 'content-type': 'application/json' },
            body: responseBody,
          },
        });
      });
    });

    it.each(['', undefined, null])(
      'should parse empty JSON bodies as null when converting a response error to a plain object (body: %o)',
      async (body) => {
        type Schema = HttpSchema<{
          '/users': {
            POST: {
              request: {
                headers: { 'content-type': 'application/json' };
                body?: string | null;
              };
              response: {
                409: {
                  headers: { 'content-type': 'application/json' };
                  body?: string | null;
                };
              };
            };
          };
        }>;

        await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
          await interceptor
            .post('/users')
            .respond({
              status: 409,
              headers: { 'content-type': 'application/json' },
              body,
            })
            .times(1);

          const fetch = createFetch<Schema>({ baseURL });

          const response = await fetch('/users', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
          });

          expectResponseStatus(response, 409);

          const errorObject = await response.error.toObject({
            includeRequestBody: true,
            includeResponseBody: true,
          });

          expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
            request: {
              headers: { 'content-type': 'application/json' },
              body: null,
            },
            response: {
              headers: { 'content-type': 'application/json' },
              body: null,
            },
          });
        });
      },
    );

    it('should log an error when parsing invalid JSON bodies when converting a response error to a plain object', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'application/json' };
              body: string;
            };
            response: {
              409: {
                headers: { 'content-type': 'application/json' };
                body: string;
              };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
        const requestBody = 'invalid request json body';
        const responseBody = 'invalid response json body';

        await interceptor
          .post('/users')
          .respond({
            status: 409,
            headers: { 'content-type': 'application/json' },
            body: responseBody,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await usingIgnoredConsole(['error'], async (console) => {
          const response = await fetch('/users', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: requestBody,
          });

          expect(console.error).toHaveBeenCalledTimes(isClientSide() ? 1 : 2);

          expect(console.error).toHaveBeenCalledWith(
            color.cyan('[@zimic/interceptor]'),
            'Failed to parse request body:',
            new InvalidJSONError(requestBody),
          );

          if (!isClientSide()) {
            expect(console.error).toHaveBeenCalledWith(
              color.cyan('[@zimic/interceptor]'),
              'Failed to parse response body:',
              new InvalidJSONError(responseBody),
            );
          }

          return response;
        });

        expectResponseStatus(response, 409);

        const errorObject = await usingIgnoredConsole(['error'], async (console) => {
          const errorObject = await response.error.toObject({
            includeRequestBody: true,
            includeResponseBody: true,
          });

          expect(console.error).toHaveBeenCalledTimes(2);

          expect(console.error).toHaveBeenCalledWith(
            '[@zimic/fetch]',
            'Failed to parse request body:',
            new InvalidJSONError(requestBody),
          );

          expect(console.error).toHaveBeenCalledWith(
            '[@zimic/fetch]',
            'Failed to parse response body:',
            new InvalidJSONError(responseBody),
          );

          return errorObject;
        });

        expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
          request: {
            headers: { 'content-type': 'application/json' },
          },
          response: {
            headers: { 'content-type': 'application/json' },
          },
        });
        expect(errorObject.request.body).toBeUndefined();
        expect(errorObject.response.body).toBeUndefined();
      });
    });
  });

  describe('Form data', () => {
    it('should parse form data bodies when converting a response error to a plain object', async () => {
      interface RequestBodySchema {
        value: string;
        values: string[];
        file: File;
      }

      type ResponseBodySchema = JSONValue<{
        code: string;
        message: string;
      }>;

      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              body: HttpFormData<RequestBodySchema>;
            };
            response: {
              409: { body: HttpFormData<ResponseBodySchema> };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
        const requestBody = new HttpFormData<RequestBodySchema>();

        requestBody.append('value', '1');
        requestBody.append('values', '2');
        requestBody.append('values', '3');

        const file = new File(['file content'], 'file.txt', { type: 'text/plain' });
        requestBody.append('file', file);

        const responseBody = new HttpFormData<ResponseBodySchema>();
        responseBody.append('code', '409');
        responseBody.append('message', 'Conflict');

        await interceptor
          .post('/users')
          .respond({
            status: 409,
            body: responseBody,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          body: requestBody,
        });

        expectResponseStatus(response, 409);

        const errorObject = await response.error.toObject({
          includeRequestBody: true,
          includeResponseBody: true,
        });

        expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
          request: {
            headers: { 'content-type': expect.stringMatching(/^multipart\/form-data; boundary=.+$/) as string },
            body: requestBody,
          },
          response: {
            headers: { 'content-type': expect.stringMatching(/^multipart\/form-data; boundary=.+$/) as string },
            body: responseBody,
          },
        });
      });
    });

    it.each(['', undefined, null])(
      'should parse empty form data bodies as null when converting a response error to a plain object (body: %o)',
      async (body) => {
        type Schema = HttpSchema<{
          '/users': {
            POST: {
              request: {
                headers: { 'content-type': 'multipart/form-data' };
                body?: string | null;
              };
              response: {
                409: {
                  headers: { 'content-type': 'multipart/form-data' };
                  body?: string | null;
                };
              };
            };
          };
        }>;

        await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
          await interceptor
            .post('/users')
            .respond({
              status: 409,
              headers: { 'content-type': 'multipart/form-data' },
              body,
            })
            .times(1);

          const fetch = createFetch<Schema>({ baseURL });

          const response = await fetch('/users', {
            method: 'POST',
            headers: { 'content-type': 'multipart/form-data' },
            body,
          });

          expectResponseStatus(response, 409);

          const errorObject = await response.error.toObject({
            includeRequestBody: true,
            includeResponseBody: true,
          });

          expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
            request: {
              headers: { 'content-type': 'multipart/form-data' },
              body: null,
            },
            response: {
              headers: { 'content-type': 'multipart/form-data' },
              body: null,
            },
          });
        });
      },
    );

    it('should log an error when parsing invalid form data bodies when converting a response error to a plain object', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'multipart/form-data' };
              body: string;
            };
            response: {
              409: {
                headers: { 'content-type': 'multipart/form-data' };
                body: string;
              };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
        const requestBody = 'invalid request form data body';
        const responseBody = 'invalid response form data body';

        await interceptor
          .post('/users')
          .respond({
            status: 409,
            headers: { 'content-type': 'multipart/form-data' },
            body: responseBody,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await usingIgnoredConsole(['error'], async (console) => {
          const response = await fetch('/users', {
            method: 'POST',
            headers: { 'content-type': 'multipart/form-data' },
            body: requestBody,
          });

          expect(console.error).toHaveBeenCalledTimes(isClientSide() ? 1 : 2);

          expect(console.error).toHaveBeenCalledWith(
            color.cyan('[@zimic/interceptor]'),
            'Failed to parse request body:',
            new InvalidFormDataError(requestBody),
          );

          if (!isClientSide()) {
            expect(console.error).toHaveBeenCalledWith(
              color.cyan('[@zimic/interceptor]'),
              'Failed to parse response body:',
              new InvalidFormDataError(responseBody),
            );
          }

          return response;
        });

        expectResponseStatus(response, 409);

        const errorObject = await usingIgnoredConsole(['error'], async (console) => {
          const errorObject = await response.error.toObject({
            includeRequestBody: true,
            includeResponseBody: true,
          });

          expect(console.error).toHaveBeenCalledTimes(2);

          expect(console.error).toHaveBeenCalledWith(
            '[@zimic/fetch]',
            'Failed to parse request body:',
            new InvalidFormDataError(requestBody),
          );

          expect(console.error).toHaveBeenCalledWith(
            '[@zimic/fetch]',
            'Failed to parse response body:',
            new InvalidFormDataError(responseBody),
          );

          return errorObject;
        });

        expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
          request: {
            headers: { 'content-type': 'multipart/form-data' },
          },
          response: {
            headers: { 'content-type': 'multipart/form-data' },
          },
        });
        expect(errorObject.request.body).toBeUndefined();
        expect(errorObject.response.body).toBeUndefined();
      });
    });
  });

  describe('URL search params', () => {
    it('should parse URL search params bodies when converting a response error to a plain object', async () => {
      interface RequestBodySchema {
        value: string;
        values: string[];
      }

      type ResponseBodySchema = JSONValue<{
        code: string;
        message: string;
      }>;

      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              body: HttpSearchParams<RequestBodySchema>;
            };
            response: {
              409: { body: HttpSearchParams<ResponseBodySchema> };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
        const requestBody = new HttpSearchParams<RequestBodySchema>({
          value: '1',
          values: ['2', '3'],
        });

        const responseBody = new HttpSearchParams<ResponseBodySchema>({
          code: '409',
          message: 'Conflict',
        });

        await interceptor
          .post('/users')
          .respond({
            status: 409,
            body: responseBody,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          body: requestBody,
        });

        expectResponseStatus(response, 409);

        const errorObject = await response.error.toObject({
          includeRequestBody: true,
          includeResponseBody: true,
        });

        expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
          request: {
            headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: requestBody,
          },
          response: {
            headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: responseBody,
          },
        });
      });
    });

    it.each(['', undefined, null])(
      'should parse empty URL search params bodies as null when converting a response error to a plain object (body: %o)',
      async (body) => {
        type Schema = HttpSchema<{
          '/users': {
            POST: {
              request: {
                headers: { 'content-type': 'application/x-www-form-urlencoded' };
                body?: string | null;
              };
              response: {
                409: {
                  headers: { 'content-type': 'application/x-www-form-urlencoded' };
                  body?: string | null;
                };
              };
            };
          };
        }>;

        await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
          await interceptor
            .post('/users')
            .respond({
              status: 409,
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              body,
            })
            .times(1);

          const fetch = createFetch<Schema>({ baseURL });

          const response = await fetch('/users', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body,
          });

          expectResponseStatus(response, 409);

          const errorObject = await response.error.toObject({
            includeRequestBody: true,
            includeResponseBody: true,
          });

          expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
            request: {
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              body: null,
            },
            response: {
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              body: null,
            },
          });
        });
      },
    );
  });

  describe('Plain text', () => {
    it.each(['text/plain', 'text/html', 'application/xml'] as const)(
      'should parse plain text bodies when converting a response error to a plain object (%s)',
      async (contentType) => {
        type Schema = HttpSchema<{
          '/users': {
            POST: {
              request: {
                headers: { 'content-type': typeof contentType };
                body: string;
              };
              response: {
                409: {
                  headers: { 'content-type': typeof contentType };
                  body: string;
                };
              };
            };
          };
        }>;

        await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
          const requestBody = 'request text content';
          const responseBody = 'response text content';

          await interceptor
            .post('/users')
            .respond({
              status: 409,
              headers: { 'content-type': contentType },
              body: responseBody,
            })
            .times(1);

          const fetch = createFetch<Schema>({ baseURL });

          const response = await fetch('/users', {
            method: 'POST',
            headers: { 'content-type': contentType },
            body: requestBody,
          });

          expectResponseStatus(response, 409);

          const errorObject = await response.error.toObject({
            includeRequestBody: true,
            includeResponseBody: true,
          });

          expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
            request: {
              headers: { 'content-type': contentType },
              body: requestBody,
            },
            response: {
              headers: { 'content-type': contentType },
              body: responseBody,
            },
          });
        });
      },
    );

    it.each(['', undefined, null])(
      'should parse empty plain text bodies as null when converting a response error to a plain object (body: %o)',
      async (body) => {
        type Schema = HttpSchema<{
          '/users': {
            POST: {
              request: {
                headers: { 'content-type': 'text/plain' };
                body?: string | null;
              };
              response: {
                409: {
                  headers: { 'content-type': 'text/plain' };
                  body?: string | null;
                };
              };
            };
          };
        }>;

        await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
          await interceptor
            .post('/users')
            .respond({
              status: 409,
              headers: { 'content-type': 'text/plain' },
              body,
            })
            .times(1);

          const fetch = createFetch<Schema>({ baseURL });

          const response = await fetch('/users', {
            method: 'POST',
            headers: { 'content-type': 'text/plain' },
            body,
          });

          expectResponseStatus(response, 409);

          const errorObject = await response.error.toObject({
            includeRequestBody: true,
            includeResponseBody: true,
          });

          expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
            request: {
              headers: { 'content-type': 'text/plain' },
              body: null,
            },
            response: {
              headers: { 'content-type': 'text/plain' },
              body: null,
            },
          });
        });
      },
    );
  });

  describe('Blob', () => {
    it.each(['application/pdf', 'image/png', 'audio/mp3', 'video/mp4', 'font/woff2', 'multipart/mixed'])(
      'should parse blob bodies when converting a response error to a plain object (%s)',
      async (contentType) => {
        type Schema = HttpSchema<{
          '/users': {
            POST: {
              request: {
                headers: { 'content-type': typeof contentType };
                body: Blob;
              };
              response: {
                409: {
                  headers: { 'content-type': typeof contentType };
                  body: Blob;
                };
              };
            };
          };
        }>;

        await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
          const requestBody = new Blob(['request blob content'], { type: contentType });
          const responseBody = new Blob(['response blob content'], { type: contentType });

          await interceptor
            .post('/users')
            .respond({
              status: 409,
              headers: { 'content-type': contentType },
              body: responseBody,
            })
            .times(1);

          const fetch = createFetch<Schema>({ baseURL });

          const response = await fetch('/users', {
            method: 'POST',
            headers: { 'content-type': contentType },
            body: requestBody,
          });

          expectResponseStatus(response, 409);

          const errorObject = await response.error.toObject({
            includeRequestBody: true,
            includeResponseBody: true,
          });

          expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
            request: {
              headers: { 'content-type': contentType },
              body: requestBody,
            },
            response: {
              headers: { 'content-type': contentType },
              body: responseBody,
            },
          });
        });
      },
    );

    it.each(['', undefined, null])(
      'should parse empty blob bodies when converting a response error to a plain object (body: %o)',
      async (body) => {
        type Schema = HttpSchema<{
          '/users': {
            POST: {
              request: {
                headers: { 'content-type': 'application/pdf' };
                body?: string | null;
              };
              response: {
                409: {
                  headers: { 'content-type': 'application/pdf' };
                  body?: string | null;
                };
              };
            };
          };
        }>;

        await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
          await interceptor
            .post('/users')
            .respond({
              status: 409,
              headers: { 'content-type': 'application/pdf' },
              body,
            })
            .times(1);

          const fetch = createFetch<Schema>({ baseURL });

          const response = await fetch('/users', {
            method: 'POST',
            headers: { 'content-type': 'application/pdf' },
            body,
          });

          expectResponseStatus(response, 409);

          const errorObject = await response.error.toObject({
            includeRequestBody: true,
            includeResponseBody: true,
          });

          expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
            request: {
              headers: { 'content-type': 'application/pdf' },
              body: new Blob([], { type: 'application/pdf' }),
            },
            response: {
              headers: { 'content-type': 'application/pdf' },
              body: new Blob([], { type: 'application/pdf' }),
            },
          });
        });
      },
    );
  });

  describe('Fallbacks', () => {
    it('should convert a response error to a plain object, parsing bodies as JSON if the content type is unknown', async () => {
      type RequestBodySchema = User;

      type ResponseBodySchema = JSONValue<{
        code: 409;
        message: string;
      }>;

      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'unknown' };
              body: RequestBodySchema;
            };
            response: {
              409: {
                headers: { 'content-type': 'unknown' };
                body: ResponseBodySchema;
              };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
        const requestBody: RequestBodySchema = users[0];
        const responseBody: ResponseBodySchema = { code: 409, message: 'Conflict' };

        await interceptor
          .post('/users')
          .respond({
            status: 409,
            headers: { 'content-type': 'unknown' },
            body: responseBody,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'unknown' },
          body: JSON.stringify(requestBody),
        });

        expectResponseStatus(response, 409);

        const errorObject = await response.error.toObject({
          includeRequestBody: true,
          includeResponseBody: true,
        });

        expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
          request: {
            headers: { 'content-type': 'unknown' },
            body: requestBody,
          },
          response: {
            headers: { 'content-type': 'unknown' },
            body: responseBody,
          },
        });
      });
    });

    it('should convert a response error to a plain object, parsing bodies as blob if the content type is unknown and not JSON', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'unknown' };
              body: string;
            };
            response: {
              409: {
                headers: { 'content-type': 'unknown' };
                body: string;
              };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
        const requestBodyAsString = 'request blob content';
        const responseBodyAsString = 'response blob content';

        await interceptor
          .post('/users')
          .respond({
            status: 409,
            headers: { 'content-type': 'unknown' },
            body: responseBodyAsString,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'unknown' },
          body: requestBodyAsString,
        });

        expectResponseStatus(response, 409);

        const errorObject = await response.error.toObject({
          includeRequestBody: true,
          includeResponseBody: true,
        });

        expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
          request: {
            headers: { 'content-type': 'unknown' },
            body: new Blob([requestBodyAsString], { type: 'unknown' }),
          },
          response: {
            headers: { 'content-type': 'unknown' },
            body: new Blob([responseBodyAsString], { type: 'unknown' }),
          },
        });
      });
    });
  });

  it('should parse empty bodies when converting a response error to a plain object', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          response: {
            201: {};
            409: {};
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .respond({
          status: 409,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
      });

      expectResponseStatus(response, 409);
      expect(response.ok).toBe(false);

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'POST', '/users'>>();

      const errorObjectPromise = response.error.toObject({ includeRequestBody: true, includeResponseBody: true });
      expectTypeOf(errorObjectPromise).toEqualTypeOf<Promise<FetchResponseErrorObject>>();

      const errorObject = await errorObjectPromise;

      expect(errorObject).toEqual<FetchResponseErrorObject>({
        message: `POST ${joinURL(baseURL, '/users')} failed with status 409: `,
        name: 'FetchResponseError',
        request: {
          url: joinURL(baseURL, '/users'),
          path: '/users',
          method: 'POST',
          headers: {},
          body: null,
          cache: 'default',
          destination: '',
          credentials: 'same-origin',
          integrity: '',
          keepalive: false,
          mode: 'cors',
          redirect: 'follow',
          referrer: 'about:client',
          referrerPolicy: '',
        },
        response: {
          url: joinURL(baseURL, '/users'),
          type: isClientSide() ? 'basic' : 'default',
          status: 409,
          statusText: '',
          ok: false,
          headers: {},
          body: null,
          redirected: false,
        },
      });
    });
  });

  it('should show a warning if trying to include bodies already used in plain objects', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: {
            409: { body: { code: 409; message: string } };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .post('/users')
        .with({ body: users[0] })
        .respond({
          status: 409,
          body: { code: 409, message: 'Conflict' },
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(users[0]),
      });

      expectResponseStatus(response, 409);
      expect(response.ok).toBe(false);

      expect(response.request.bodyUsed).toBe(false);
      expect(await response.request.json()).toEqual(users[0]);
      expect(response.request.bodyUsed).toBe(true);

      expect(response.bodyUsed).toBe(false);
      expect(await response.json()).toEqual({ code: 409, message: 'Conflict' });
      expect(response.bodyUsed).toBe(true);

      const errorObject = await usingIgnoredConsole(['warn'], async (console) => {
        const errorObject = await response.error.toObject({
          includeRequestBody: true,
          includeResponseBody: true,
        });

        expect(console.warn).toHaveBeenCalledTimes(2);

        expect(console.warn).toHaveBeenCalledWith(
          '[@zimic/fetch]',
          'Could not include the request body because it is already used. If you access the body ' +
            'before calling `error.toObject()`, consider reading it from a cloned request.\n\n' +
            'Learn more: https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject',
        );

        expect(console.warn).toHaveBeenCalledWith(
          '[@zimic/fetch]',
          'Could not include the response body because it is already used. If you access the body ' +
            'before calling `error.toObject()`, consider reading it from a cloned response.\n\n' +
            'Learn more: https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject',
        );

        return errorObject;
      });

      expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
        request: {
          headers: { 'content-type': 'application/json' },
        },
        response: {
          headers: { 'content-type': 'application/json' },
        },
      });
      expect(errorObject.request.body).toBeUndefined();
      expect(errorObject.response.body).toBeUndefined();
    });
  });

  it('should convert a response error to a plain object including search params', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: {
            searchParams: { page: number; limit: number };
          };
          response: {
            200: { body: User[] };
            401: { body: { code: 401; message: string } };
            403: { body: { code: 403; message: string } };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .respond({
          status: 401,
          body: { code: 401, message: 'Unauthorized' },
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', {
        method: 'GET',
        searchParams: { page: 1, limit: 10 },
      });

      expectResponseStatus(response, 401);
      expect(response.ok).toBe(false);

      expect(response.url).toBe(joinURL(baseURL, '/users?page=1&limit=10'));

      const errorObject = response.error.toObject();
      expectTypeOf(errorObject).toEqualTypeOf<FetchResponseErrorObject>();

      expect(errorObject).toMatchObject<DeepPartial<FetchResponseErrorObject>>({
        message: `GET ${joinURL(baseURL, '/users?page=1&limit=10')} failed with status 401: `,
        request: {
          url: joinURL(baseURL, '/users?page=1&limit=10'),
        },
        response: {
          url: joinURL(baseURL, '/users?page=1&limit=10'),
        },
      });
    });
  });
});
