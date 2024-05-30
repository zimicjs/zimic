import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema } from '@/http/types/schema';
import { http } from '@/interceptor';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { JSONValue } from '@/types/json';
import { getCrypto } from '@/utils/crypto';
import { joinURL } from '@/utils/urls';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectFetchError } from '@tests/utils/fetch';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions, UnhandledRequestStrategy } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../types';
import { verifyUnhandledRequestMessage } from '../utils';

export async function declarePutHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

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

  describe('Restrictions', () => {
    it('should support intercepting PUT requests having headers restrictions', async () => {
      type UserUpdateHeaders = HttpSchema.Headers<{
        'content-language'?: string;
        accept?: string;
      }>;

      await usingHttpInterceptor<{
        '/users/:id': {
          PUT: {
            request: {
              headers: UserUpdateHeaders;
            };
            response: {
              200: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const updateHandler = await promiseIfRemote(
          interceptor
            .put(`/users/${users[0].id}`)
            .with({
              headers: { 'content-language': 'en' },
            })
            .with((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserUpdateHeaders>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

              return request.headers.get('accept')?.includes('application/json') ?? false;
            })
            .respond((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserUpdateHeaders>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

              return {
                status: 200,
                body: users[0],
              };
            }),
          interceptor,
        );
        expect(updateHandler).toBeInstanceOf(Handler);

        let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(0);

        const headers = new HttpHeaders<UserUpdateHeaders>({
          'content-language': 'en',
          accept: 'application/json',
        });

        let updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT', headers });
        expect(updateResponse.status).toBe(200);
        updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(1);

        headers.append('accept', 'application/xml');

        updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT', headers });
        expect(updateResponse.status).toBe(200);
        updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(2);

        headers.delete('accept');

        let updatePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT', headers });
        await expectFetchError(updatePromise);
        updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(2);

        headers.set('accept', 'application/json');
        headers.set('content-language', 'pt');

        updatePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT', headers });
        await expectFetchError(updatePromise);
        updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(2);
      });
    });

    it('should support intercepting PUT requests having search params restrictions', async () => {
      type UserUpdateSearchParams = HttpSchema.SearchParams<{
        tag?: string;
      }>;

      await usingHttpInterceptor<{
        '/users/:id': {
          PUT: {
            request: {
              searchParams: UserUpdateSearchParams;
            };
            response: {
              200: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const updateHandler = await promiseIfRemote(
          interceptor
            .put(`/users/${users[0].id}`)
            .with({
              searchParams: { tag: 'admin' },
            })
            .respond((request) => {
              expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserUpdateSearchParams>>();
              expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

              return {
                status: 200,
                body: users[0],
              };
            }),
          interceptor,
        );
        expect(updateHandler).toBeInstanceOf(Handler);

        let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(0);

        const searchParams = new HttpSearchParams<UserUpdateSearchParams>({
          tag: 'admin',
        });

        const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}?${searchParams.toString()}`), {
          method: 'PUT',
        });
        expect(updateResponse.status).toBe(200);
        updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(1);

        searchParams.delete('tag');

        const updatePromise = fetch(joinURL(baseURL, `/users/${users[0].id}?${searchParams.toString()}`), {
          method: 'PUT',
        });
        await expectFetchError(updatePromise);
        updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(1);
      });
    });

    it('should support intercepting PUT requests having body restrictions', async () => {
      type UserUpdateBody = JSONValue<User>;

      await usingHttpInterceptor<{
        '/users/:id': {
          PUT: {
            request: {
              body: UserUpdateBody;
            };
            response: {
              200: { body: User };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const updateHandler = await promiseIfRemote(
          interceptor
            .put(`/users/${users[0].id}`)
            .with({
              body: { ...users[0], name: users[1].name },
            })
            .respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<UserUpdateBody>();

              return {
                status: 200,
                body: users[0],
              };
            }),
          interceptor,
        );
        expect(updateHandler).toBeInstanceOf(Handler);

        let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(0);

        const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...users[0],
            name: users[1].name,
          } satisfies UserUpdateBody),
        });
        expect(updateResponse.status).toBe(200);
        updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(1);

        const updatePromise = fetch(joinURL(baseURL, `/users/${users[0].id}`), {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...users[0],
            name: users[0].name,
          } satisfies UserUpdateBody),
        });
        await expectFetchError(updatePromise);
        updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(1);
      });
    });
  });

  describe('Unhandled requests', () => {
    describe.each([
      { overrideDefault: false as const },
      { overrideDefault: 'static' as const },
      { overrideDefault: 'static-empty' as const },
      { overrideDefault: 'function' as const },
    ])('Logging enabled or disabled: override default $overrideDefault', ({ overrideDefault }) => {
      beforeEach(() => {
        if (overrideDefault === 'static') {
          http.default.onUnhandledRequest({ log: true });
        } else if (overrideDefault === 'static-empty') {
          http.default.onUnhandledRequest({});
        } else if (overrideDefault === 'function') {
          http.default.onUnhandledRequest(async (_request, context) => {
            await context.log();
          });
        }
      });

      if (type === 'local') {
        it('should show a warning when logging is enabled and a PUT request is unhandled and bypassed', async () => {
          await usingHttpInterceptor<{
            '/users/:id': {
              PUT: {
                request: { headers: { 'x-value': string } };
                response: {
                  200: { body: User };
                };
              };
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const updateHandler = await promiseIfRemote(
                interceptor
                  .put(`/users/${users[0].id}`)
                  .with({ headers: { 'x-value': '1' } })
                  .respond({
                    status: 200,
                    body: users[0],
                  }),
                interceptor,
              );

              let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
              expect(updateRequests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
                  method: 'PUT',
                  headers: { 'x-value': '1' },
                });
                expect(updateResponse.status).toBe(200);

                updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
                expect(updateRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const updateRequest = new Request(joinURL(baseURL, `/users/${users[0].id}`), { method: 'PUT' });
                const updatePromise = fetch(updateRequest);
                await expectFetchError(updatePromise);

                updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
                expect(updateRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(1);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const warnMessage = spies.warn.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(warnMessage, {
                  type: 'warn',
                  platform,
                  request: updateRequest,
                });
              });
            },
          );
        });
      }

      if (type === 'remote') {
        it('should show an error when logging is enabled and a PUT request is unhandled and rejected', async () => {
          await usingHttpInterceptor<{
            '/users/:id': {
              PUT: {
                request: { headers: { 'x-value': string } };
                response: {
                  200: { body: User };
                };
              };
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const updateHandler = await promiseIfRemote(
                interceptor
                  .put(`/users/${users[0].id}`)
                  .with({ headers: { 'x-value': '1' } })
                  .respond({
                    status: 200,
                    body: users[0],
                  }),
                interceptor,
              );

              let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
              expect(updateRequests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
                  method: 'PUT',
                  headers: { 'x-value': '1' },
                });
                expect(updateResponse.status).toBe(200);

                updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
                expect(updateRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const updateRequest = new Request(joinURL(baseURL, `/users/${users[0].id}`), {
                  method: 'PUT',
                  headers: { 'x-value': '2' },
                });
                const updatePromise = fetch(updateRequest);
                await expectFetchError(updatePromise);

                updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
                expect(updateRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(1);

                const errorMessage = spies.error.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(errorMessage, {
                  type: 'error',
                  platform,
                  request: updateRequest,
                });
              });
            },
          );
        });
      }
    });

    it.each([{ overrideDefault: false }, { overrideDefault: 'static' }, { overrideDefault: 'function' }])(
      'should not show a warning or error when logging is disabled and a PUT request is unhandled: override default $overrideDefault',
      async ({ overrideDefault }) => {
        if (overrideDefault === 'static') {
          http.default.onUnhandledRequest({ log: false });
        } else if (overrideDefault === 'function') {
          http.default.onUnhandledRequest(vi.fn());
        }

        await usingHttpInterceptor<{
          '/users/:id': {
            PUT: {
              request: { headers: { 'x-value': string } };
              response: {
                200: { body: User };
              };
            };
          };
        }>(
          {
            ...interceptorOptions,
            onUnhandledRequest: overrideDefault === false ? { log: false } : {},
          },
          async (interceptor) => {
            const updateHandler = await promiseIfRemote(
              interceptor
                .put(`/users/${users[0].id}`)
                .with({ headers: { 'x-value': '1' } })
                .respond({
                  status: 200,
                  body: users[0],
                }),
              interceptor,
            );

            let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
            expect(updateRequests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (spies) => {
              const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
                method: 'PUT',
                headers: { 'x-value': '1' },
              });
              expect(updateResponse.status).toBe(200);

              updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
              expect(updateRequests).toHaveLength(1);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);

              const updateRequest = new Request(joinURL(baseURL, `/users/${users[0].id}`), {
                method: 'PUT',
                headers: { 'x-value': '2' },
              });
              const updatePromise = fetch(updateRequest);
              await expectFetchError(updatePromise);

              updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
              expect(updateRequests).toHaveLength(1);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);
            });
          },
        );
      },
    );

    it('should support a custom unhandled PUT request handler', async () => {
      const onUnhandledRequest = vi.fn(async (request: Request, context: UnhandledRequestStrategy.HandlerContext) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          await context.log();
        }
      });

      await usingHttpInterceptor<{
        '/users/:id': {
          PUT: {
            request: {
              headers: { 'x-value': string };
              searchParams: { name?: string };
            };
            response: {
              200: { body: User };
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const updateHandler = await promiseIfRemote(
          interceptor
            .put(`/users/${users[0].id}`)
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 200,
              body: users[0],
            }),
          interceptor,
        );

        let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method: 'PUT',
            headers: { 'x-value': '1' },
          });
          expect(updateResponse.status).toBe(200);

          updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
          expect(updateRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const searchParams = new HttpSearchParams({ name: 'User 1' });

          let updatePromise = fetch(joinURL(baseURL, `/users/${users[0].id}?${searchParams.toString()}`), {
            method: 'PUT',
            headers: { 'x-value': '2' },
          });
          await expectFetchError(updatePromise);

          updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
          expect(updateRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const updateRequest = new Request(joinURL(baseURL, `/users/${users[0].id}`), {
            method: 'PUT',
            headers: { 'x-value': '2' },
          });
          updatePromise = fetch(updateRequest);
          await expectFetchError(updatePromise);

          updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
          expect(updateRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

          const messageType = type === 'local' ? 'warn' : 'error';
          expect(spies.warn).toHaveBeenCalledTimes(messageType === 'warn' ? 1 : 0);
          expect(spies.error).toHaveBeenCalledTimes(messageType === 'error' ? 1 : 0);

          const errorMessage = spies[messageType].mock.calls[0].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, {
            type: messageType,
            platform,
            request: updateRequest,
          });
        });
      });
    });

    it('should log an error if a custom unhandled PUT request handler throws', async () => {
      const error = new Error('Unhandled request.');

      const onUnhandledRequest = vi.fn((request: Request) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          throw error;
        }
      });

      await usingHttpInterceptor<{
        '/users/:id': {
          PUT: {
            request: {
              headers: { 'x-value': string };
              searchParams: { name?: string };
            };
            response: {
              200: { body: User };
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const updateHandler = await promiseIfRemote(
          interceptor
            .put(`/users/${users[0].id}`)
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 200,
              body: users[0],
            }),
          interceptor,
        );

        let updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
        expect(updateRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const updateResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), {
            method: 'PUT',
            headers: { 'x-value': '1' },
          });
          expect(updateResponse.status).toBe(200);

          updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
          expect(updateRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const searchParams = new HttpSearchParams({ name: 'User 1' });

          let updatePromise = fetch(joinURL(baseURL, `/users/${users[0].id}?${searchParams.toString()}`), {
            method: 'PUT',
            headers: { 'x-value': '2' },
          });
          await expectFetchError(updatePromise);

          updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
          expect(updateRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const updateRequest = new Request(joinURL(baseURL, `/users/${users[0].id}`), {
            method: 'PUT',
            headers: { 'x-value': '2' },
          });
          updatePromise = fetch(updateRequest);
          await expectFetchError(updatePromise);

          updateRequests = await promiseIfRemote(updateHandler.requests(), interceptor);
          expect(updateRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(1);

          expect(spies.error).toHaveBeenCalledWith(error);
        });
      });
    });
  });
}
