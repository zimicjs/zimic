import { HttpSchema } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';
import joinURL from '@zimic/utils/url/joinURL';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { isClientSide } from '@/utils/environment';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import FetchResponseError, {
  BodyUsedWarning,
  FetchResponseErrorObject,
  FetchResponseErrorObjectOptions,
} from '../errors/FetchResponseError';
import createFetch from '../factory';
import { FetchResponse, FetchResponsePerStatusCode } from '../types/requests';

describe('FetchClient > Errors', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
  ];

  it('should correctly type successful responses', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
            401: { body: { code: 401; message: string } };
            403: { body: { code: 403; message: string } };
            500: { body: { code: 500; message: string } };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .respond({
          status: 200,
          body: users,
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200 | 401 | 403 | 500>();
      expect(response.status).toBe(200);

      expect(await response.json()).toEqual(users);

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.json).toEqualTypeOf<
        | (() => Promise<User[]>)
        | (() => Promise<{ code: 401; message: string }>)
        | (() => Promise<{ code: 403; message: string }>)
        | (() => Promise<{ code: 500; message: string }>)
      >();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 200>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 401>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 403>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 500>)
      >();

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'> | null>();

      expect(response.ok).toBe(true);

      /* istanbul ignore if -- @preserve
       * response.ok is true. This if is necessary to narrow the response to a successful type. */
      if (!response.ok) {
        expectTypeOf(response.status).toEqualTypeOf<401 | 403 | 500>();
        expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'>>();

        throw response.error;
      }

      expectTypeOf(response.status).toEqualTypeOf<200>();

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        FetchResponsePerStatusCode<Schema, 'GET', '/users', 200>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.clone).toEqualTypeOf<() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 200>>();

      expectTypeOf(response.error).toEqualTypeOf<null>();
      expect(response.error).toBe(null);
    });
  });

  it('should correctly type failure responses', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
            401: { body: { code: 401; message: string } };
            403: { body: { code: 403; message: string } };
            500: { body: { code: 500; message: string } };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .respond({
          status: 403,
          body: { code: 403, message: 'Forbidden' },
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200 | 401 | 403 | 500>();
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: 403, message: 'Forbidden' });

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.json).toEqualTypeOf<
        | (() => Promise<User[]>)
        | (() => Promise<{ code: 401; message: string }>)
        | (() => Promise<{ code: 403; message: string }>)
        | (() => Promise<{ code: 500; message: string }>)
      >();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 200>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 401>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 403>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 500>)
      >();

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'> | null>();

      expect(response.ok).toBe(false);

      /* istanbul ignore if -- @preserve
       * response.ok is false. This if is necessary to narrow the response to a failed type. */
      if (response.ok) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        throw new Error('Expected a failed response.');
      }

      expectTypeOf(response.status).toEqualTypeOf<401 | 403 | 500>();

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<
        | FetchResponsePerStatusCode<Schema, 'GET', '/users', 401>
        | FetchResponsePerStatusCode<Schema, 'GET', '/users', 403>
        | FetchResponsePerStatusCode<Schema, 'GET', '/users', 500>
      >();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.json).toEqualTypeOf<
        | (() => Promise<{ code: 401; message: string }>)
        | (() => Promise<{ code: 403; message: string }>)
        | (() => Promise<{ code: 500; message: string }>)
      >();
      expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
      expectTypeOf(response.clone).toEqualTypeOf<
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 401>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 403>)
        | (() => FetchResponsePerStatusCode<Schema, 'GET', '/users', 500>)
      >();

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'>>();
      expect(response.error).toEqual(new FetchResponseError<Schema, 'GET', '/users'>(response.request, response));
    });
  });

  it('should correctly check response errors', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: {
            201: { body: User };
          };
        };

        GET: {
          response: {
            200: { body: User[] };
            401: { body: { code: 401; message: string } };
            403: { body: { code: 403; message: string } };
            500: { body: { code: 500; message: string } };
          };
        };
      };

      '/users/:id': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .get('/users')
        .respond({
          status: 403,
          body: { code: 403, message: 'Forbidden' },
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/users', { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200 | 401 | 403 | 500>();
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: 403, message: 'Forbidden' });

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

      expect(response.url).toBe(joinURL(baseURL, '/users'));

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'> | null>();

      expect(response.ok).toBe(false);

      /* istanbul ignore if -- @preserve
       * response.ok is false. This if is necessary to narrow the response to a failed type. */
      if (response.ok) {
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        throw new Error('Expected a failed response.');
      }

      const error = response.error as unknown;

      expect(fetch.isResponseError(error, 'GET', '/users')).toBe(true);
      expect(fetch.isResponseError(error, 'POST', '/users')).toBe(false);
      expect(fetch.isResponseError(error, 'GET', '/users/:id')).toBe(false);

      /* istanbul ignore if -- @preserve
       * This if is necessary to narrow the error type to a specific error. */
      if (!fetch.isResponseError(error, 'GET', '/users')) {
        expectTypeOf(error).toEqualTypeOf<unknown>();
        throw error;
      }

      expectTypeOf(error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'>>();

      expect(error.request).toBe(response.request);
      expect(error.response).toBe(response);
      expect(error.cause).toBe(undefined);
    });
  });

  it('should correctly check response errors considering path params', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: {
            201: { body: User };
          };
        };

        GET: {
          response: {
            200: { body: User[] };
            401: { body: { code: 401; message: string } };
            403: { body: { code: 403; message: string } };
            500: { body: { code: 500; message: string } };
          };
        };
      };

      '/users/:id': {
        GET: {
          response: {
            200: { body: User };
            404: { body: { code: 404; message: string } };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      await interceptor
        .get(`/users/${users[0].id}`)
        .respond({
          status: 404,
          body: { code: 404, message: 'Not Found' },
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch(`/users/${users[0].id}`, { method: 'GET' });

      expectTypeOf(response.status).toEqualTypeOf<200 | 404>();
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ code: 404, message: 'Not Found' });

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users/:id'>>();

      expect(response.url).toBe(joinURL(baseURL, `/users/${users[0].id}`));
      expect(response.request.path).toBe(`/users/${users[0].id}`);

      expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users/:id'> | null>();

      expect(response.ok).toBe(false);

      const error = response.error as unknown;

      expect(fetch.isResponseError(error, 'GET', '/users')).toBe(false);
      expect(fetch.isResponseError(error, 'POST', '/users')).toBe(false);
      expect(fetch.isResponseError(error, 'GET', '/users/:id')).toBe(true);

      /* istanbul ignore if -- @preserve
       * This if is necessary to narrow the error type to a specific error. */
      if (!fetch.isResponseError(error, 'GET', '/users/:id')) {
        expectTypeOf(error).toEqualTypeOf<unknown>();
        throw error;
      }

      expectTypeOf(error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users/:id'>>();

      expect(error.request).toBe(response.request);
      expect(error.response).toBe(response);
      expect(error.cause).toBe(undefined);
    });
  });

  describe('Plain object', () => {
    it.each([
      { includeRequestBody: undefined, includeResponseBody: undefined },
      { includeRequestBody: false as const, includeResponseBody: undefined },
      { includeRequestBody: undefined, includeResponseBody: false as const },
      { includeRequestBody: false as const, includeResponseBody: false as const },
    ] satisfies FetchResponseErrorObjectOptions[])(
      'should correctly convert response errors to plain objects (%s)',
      async ({ includeRequestBody, includeResponseBody }) => {
        type Schema = HttpSchema<{
          '/users': {
            POST: {
              request: {
                headers: { 'content-type': 'application/json' };
                body: User;
              };
              response: {
                201: { body: User };
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

          expectTypeOf(response.status).toEqualTypeOf<201 | 409>();
          expect(response.status).toBe(409);
          expect(await response.json()).toEqual({ code: 409, message: 'Conflict' });

          expect(response).toBeInstanceOf(Response);
          expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

          expect(response.url).toBe(joinURL(baseURL, '/users'));

          expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'POST', '/users'> | null>();

          expect(response.ok).toBe(false);

          /* istanbul ignore if -- @preserve
           * response.ok is false. This if is necessary to narrow the response to a failed type. */
          if (response.ok) {
            expectTypeOf(response.status).toEqualTypeOf<201>();
            expectTypeOf(response.error).toEqualTypeOf<null>();

            throw new Error('Expected a failed response.');
          }

          const error = response.error as unknown;

          /* istanbul ignore if -- @preserve
           * This if is necessary to narrow the error type to a specific error. */
          if (!fetch.isResponseError(error, 'POST', '/users')) {
            expectTypeOf(error).toEqualTypeOf<unknown>();
            throw error;
          }

          expectTypeOf(error).toEqualTypeOf<FetchResponseError<Schema, 'POST', '/users'>>();

          const toObjectResult = error.toObject({ includeRequestBody, includeResponseBody });
          expectTypeOf(toObjectResult).toEqualTypeOf<FetchResponseErrorObject>();

          const errorObject = toObjectResult;
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
      'should correctly convert response errors to plain objects (%s)',
      async ({ includeRequestBody, includeResponseBody }) => {
        type Schema = HttpSchema<{
          '/users': {
            POST: {
              request: {
                headers: { 'content-type': 'application/json' };
                body: User;
              };
              response: {
                201: { body: User };
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

          expectTypeOf(response.status).toEqualTypeOf<201 | 409>();
          expect(response.status).toBe(409);
          expect(await response.clone().json()).toEqual({ code: 409, message: 'Conflict' });

          expect(response).toBeInstanceOf(Response);
          expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

          expect(response.url).toBe(joinURL(baseURL, '/users'));

          expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'POST', '/users'> | null>();

          expect(response.ok).toBe(false);

          /* istanbul ignore if -- @preserve
           * response.ok is false. This if is necessary to narrow the response to a failed type. */
          if (response.ok) {
            expectTypeOf(response.status).toEqualTypeOf<201>();
            expectTypeOf(response.error).toEqualTypeOf<null>();

            throw new Error('Expected a failed response.');
          }

          const error = response.error as unknown;

          /* istanbul ignore if -- @preserve
           * This if is necessary to narrow the error type to a specific error. */
          if (!fetch.isResponseError(error, 'POST', '/users')) {
            expectTypeOf(error).toEqualTypeOf<unknown>();
            throw error;
          }

          expectTypeOf(error).toEqualTypeOf<FetchResponseError<Schema, 'POST', '/users'>>();

          const toObjectResult = error.toObject({ includeRequestBody, includeResponseBody });
          expectTypeOf(toObjectResult).toEqualTypeOf<PossiblePromise<FetchResponseErrorObject>>();

          const errorObject = await toObjectResult;
          expect(errorObject).toEqual<FetchResponseErrorObject>({
            message: `POST ${joinURL(baseURL, '/users')} failed with status 409: `,
            name: 'FetchResponseError',
            request: {
              url: joinURL(baseURL, '/users'),
              path: '/users',
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: includeRequestBody ? JSON.stringify(users[0]) : undefined,
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
              body: includeResponseBody ? JSON.stringify({ code: 409, message: 'Conflict' }) : undefined,
              redirected: false,
            },
          });
        });
      },
    );

    it('should correctly convert response errors to plain objects, considering empty bodies', async () => {
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

        expectTypeOf(response.status).toEqualTypeOf<201 | 409>();
        expect(response.status).toBe(409);
        expect(await response.clone().text()).toBe('');

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'POST', '/users'> | null>();

        expect(response.ok).toBe(false);

        /* istanbul ignore if -- @preserve
         * response.ok is false. This if is necessary to narrow the response to a failed type. */
        if (response.ok) {
          expectTypeOf(response.status).toEqualTypeOf<201>();
          expectTypeOf(response.error).toEqualTypeOf<null>();

          throw new Error('Expected a failed response.');
        }

        const error = response.error as unknown;

        /* istanbul ignore if -- @preserve
         * This if is necessary to narrow the error type to a specific error. */
        if (!fetch.isResponseError(error, 'POST', '/users')) {
          expectTypeOf(error).toEqualTypeOf<unknown>();
          throw error;
        }

        expectTypeOf(error).toEqualTypeOf<FetchResponseError<Schema, 'POST', '/users'>>();

        const toObjectResult = error.toObject({ includeRequestBody: true, includeResponseBody: true });
        expectTypeOf(toObjectResult).toEqualTypeOf<Promise<FetchResponseErrorObject>>();

        const errorObject = await toObjectResult;
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
              201: { body: User };
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

        expectTypeOf(response.status).toEqualTypeOf<201 | 409>();
        expect(response.status).toBe(409);

        expect(response.request.bodyUsed).toBe(false);
        expect(await response.request.json()).toEqual(users[0]);
        expect(response.request.bodyUsed).toBe(true);

        expect(response.bodyUsed).toBe(false);
        expect(await response.json()).toEqual({ code: 409, message: 'Conflict' });
        expect(response.bodyUsed).toBe(true);

        expect(response.ok).toBe(false);

        /* istanbul ignore if -- @preserve
         * response.ok is false. This if is necessary to narrow the response to a failed type. */
        if (response.ok) {
          throw new Error('Expected a failed response.');
        }

        const errorObject = await usingIgnoredConsole(['warn'], async (console) => {
          const errorObject = await response.error.toObject({
            includeRequestBody: true,
            includeResponseBody: true,
          });

          expect(console.warn).toHaveBeenCalledTimes(2);
          expect(console.warn).toHaveBeenCalledWith(new BodyUsedWarning('request'));
          expect(console.warn).toHaveBeenCalledWith(new BodyUsedWarning('response'));

          return errorObject;
        });

        expect(errorObject).toEqual<FetchResponseErrorObject>({
          message: `POST ${joinURL(baseURL, '/users')} failed with status 409: `,
          name: 'FetchResponseError',
          request: {
            url: joinURL(baseURL, '/users'),
            path: '/users',
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: undefined,
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
            body: undefined,
            redirected: false,
          },
        });
      });
    });

    it('should correctly convert response errors to plain objects including search params', async () => {
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

        expectTypeOf(response.status).toEqualTypeOf<200 | 401 | 403>();
        expect(response.status).toBe(401);
        expect(await response.clone().json()).toEqual({ code: 401, message: 'Unauthorized' });

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();

        expect(response.url).toBe(joinURL(baseURL, '/users?page=1&limit=10'));

        expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'> | null>();

        expect(response.ok).toBe(false);

        /* istanbul ignore if -- @preserve
         * response.ok is false. This if is necessary to narrow the response to a failed type. */
        if (response.ok) {
          expectTypeOf(response.status).toEqualTypeOf<200>();
          expectTypeOf(response.error).toEqualTypeOf<null>();

          throw new Error('Expected a failed response.');
        }

        const error = response.error as unknown;

        /* istanbul ignore if -- @preserve
         * This if is necessary to narrow the error type to a specific error. */
        if (!fetch.isResponseError(error, 'GET', '/users')) {
          expectTypeOf(error).toEqualTypeOf<unknown>();
          throw error;
        }

        expectTypeOf(error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'>>();

        const errorObject = error.toObject();
        expectTypeOf(errorObject).toEqualTypeOf<FetchResponseErrorObject>();

        expect(errorObject).toEqual<FetchResponseErrorObject>({
          message: `GET ${joinURL(baseURL, '/users?page=1&limit=10')} failed with status 401: `,
          name: 'FetchResponseError',
          request: {
            url: joinURL(baseURL, '/users?page=1&limit=10'),
            path: '/users',
            method: 'GET',
            headers: {},
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
            url: joinURL(baseURL, '/users?page=1&limit=10'),
            type: isClientSide() ? 'basic' : 'default',
            status: 401,
            statusText: '',
            ok: false,
            headers: { 'content-type': 'application/json' },
            redirected: false,
          },
        });
      });
    });
  });
});
