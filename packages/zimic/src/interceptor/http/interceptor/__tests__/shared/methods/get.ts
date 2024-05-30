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

export async function declareGetHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
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
    it('should support intercepting GET requests having headers restrictions', async () => {
      type UserListHeaders = HttpSchema.Headers<{
        'content-language'?: string;
        accept?: string;
      }>;

      await usingHttpInterceptor<{
        '/users': {
          GET: {
            request: {
              headers: UserListHeaders;
            };
            response: {
              200: { body: User[] };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const listHandler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with({
              headers: { 'content-language': 'en' },
            })
            .with((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserListHeaders>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

              return request.headers.get('accept')?.includes('application/json') ?? false;
            })
            .respond((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserListHeaders>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

              return {
                status: 200,
                body: users,
              };
            }),
          interceptor,
        );
        expect(listHandler).toBeInstanceOf(Handler);

        let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(0);

        const headers = new HttpHeaders<UserListHeaders>({
          'content-language': 'en',
          accept: 'application/json',
        });

        let listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
        expect(listResponse.status).toBe(200);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);

        headers.append('accept', 'application/xml');

        listResponse = await fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
        expect(listResponse.status).toBe(200);
        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(2);

        headers.delete('accept');

        let listPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
        await expectFetchError(listPromise);
        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(2);

        headers.set('accept', 'application/json');
        headers.set('content-language', 'pt');

        listPromise = fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
        await expectFetchError(listPromise);
        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(2);
      });
    });

    it('should support intercepting GET requests having search params restrictions', async () => {
      type UserListSearchParams = HttpSchema.SearchParams<{
        name?: string;
        orderBy?: ('name' | 'createdAt')[];
        page?: `${number}`;
      }>;

      await usingHttpInterceptor<{
        '/users': {
          GET: {
            request: {
              searchParams: UserListSearchParams;
            };
            response: {
              200: { body: User[] };
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const listHandler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with({
              searchParams: {
                name: 'User 1',
              },
            })
            .with((request) => {
              expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
              expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

              return request.searchParams.getAll('orderBy').length > 0;
            })
            .respond((request) => {
              expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
              expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

              return {
                status: 200,
                body: users,
              };
            }),
          interceptor,
        );
        expect(listHandler).toBeInstanceOf(Handler);

        let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(0);

        const searchParams = new HttpSearchParams<UserListSearchParams>({
          name: 'User 1',
          orderBy: ['createdAt', 'name'],
        });

        const listResponse = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        expect(listResponse.status).toBe(200);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);

        searchParams.delete('orderBy');

        let listPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        await expectFetchError(listPromise);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);

        searchParams.append('orderBy', 'name');
        searchParams.set('name', 'User 2');

        listPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        await expectFetchError(listPromise);

        listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(1);
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
        it('should show a warning when logging is enabled and a GET request is unhandled and bypassed', async () => {
          await usingHttpInterceptor<{
            '/users': {
              GET: {
                request: { headers: { 'x-value': string } };
                response: {
                  200: { body: User[] };
                };
              };
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const listHandler = await promiseIfRemote(
                interceptor
                  .get('/users')
                  .with({ headers: { 'x-value': '1' } })
                  .respond({
                    status: 200,
                    body: users,
                  }),
                interceptor,
              );

              let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
              expect(listRequests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const listResponse = await fetch(joinURL(baseURL, '/users'), {
                  method: 'GET',
                  headers: { 'x-value': '1' },
                });
                expect(listResponse.status).toBe(200);

                listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
                expect(listRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const listRequest = new Request(joinURL(baseURL, '/users'), { method: 'GET' });
                const listPromise = fetch(listRequest);
                await expectFetchError(listPromise);

                listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
                expect(listRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(1);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const warnMessage = spies.warn.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(warnMessage, {
                  type: 'warn',
                  platform,
                  request: listRequest,
                });
              });
            },
          );
        });
      }

      if (type === 'remote') {
        it('should show an error when logging is enabled and a GET request is unhandled and rejected', async () => {
          await usingHttpInterceptor<{
            '/users': {
              GET: {
                request: { headers: { 'x-value': string } };
                response: {
                  200: { body: User[] };
                };
              };
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const listHandler = await promiseIfRemote(
                interceptor
                  .get('/users')
                  .with({ headers: { 'x-value': '1' } })
                  .respond({
                    status: 200,
                    body: users,
                  }),
                interceptor,
              );

              let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
              expect(listRequests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const listResponse = await fetch(joinURL(baseURL, '/users'), {
                  method: 'GET',
                  headers: { 'x-value': '1' },
                });
                expect(listResponse.status).toBe(200);

                listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
                expect(listRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const listRequest = new Request(joinURL(baseURL, '/users'), {
                  method: 'GET',
                  headers: { 'x-value': '2' },
                });
                const listPromise = fetch(listRequest);
                await expectFetchError(listPromise);

                listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
                expect(listRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(1);

                const errorMessage = spies.error.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(errorMessage, {
                  type: 'error',
                  platform,
                  request: listRequest,
                });
              });
            },
          );
        });
      }
    });

    it.each([{ overrideDefault: false }, { overrideDefault: 'static' }, { overrideDefault: 'function' }])(
      'should not show a warning or error when logging is disabled and a GET request is unhandled: override default $overrideDefault',
      async ({ overrideDefault }) => {
        if (overrideDefault === 'static') {
          http.default.onUnhandledRequest({ log: false });
        } else if (overrideDefault === 'function') {
          http.default.onUnhandledRequest(vi.fn());
        }

        await usingHttpInterceptor<{
          '/users': {
            GET: {
              request: { headers: { 'x-value': string } };
              response: {
                200: { body: User[] };
              };
            };
          };
        }>(
          {
            ...interceptorOptions,
            onUnhandledRequest: overrideDefault === false ? { log: false } : {},
          },
          async (interceptor) => {
            const listHandler = await promiseIfRemote(
              interceptor
                .get('/users')
                .with({ headers: { 'x-value': '1' } })
                .respond({
                  status: 200,
                  body: users,
                }),
              interceptor,
            );

            let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
            expect(listRequests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (spies) => {
              const listResponse = await fetch(joinURL(baseURL, '/users'), {
                method: 'GET',
                headers: { 'x-value': '1' },
              });
              expect(listResponse.status).toBe(200);

              listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
              expect(listRequests).toHaveLength(1);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);

              const listRequest = new Request(joinURL(baseURL, '/users'), {
                method: 'GET',
                headers: { 'x-value': '2' },
              });
              const listPromise = fetch(listRequest);
              await expectFetchError(listPromise);

              listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
              expect(listRequests).toHaveLength(1);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);
            });
          },
        );
      },
    );

    it('should support a custom unhandled GET request handler', async () => {
      const onUnhandledRequest = vi.fn(async (request: Request, context: UnhandledRequestStrategy.HandlerContext) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          await context.log();
        }
      });

      await usingHttpInterceptor<{
        '/users': {
          GET: {
            request: {
              headers: { 'x-value': string };
              searchParams: { name?: string };
            };
            response: {
              200: { body: User[] };
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const listHandler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 200,
              body: users,
            }),
          interceptor,
        );

        let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const listResponse = await fetch(joinURL(baseURL, '/users'), {
            method: 'GET',
            headers: { 'x-value': '1' },
          });
          expect(listResponse.status).toBe(200);

          listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
          expect(listRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const searchParams = new HttpSearchParams({ name: 'User 1' });

          let listPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method: 'GET',
            headers: { 'x-value': '2' },
          });
          await expectFetchError(listPromise);

          listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
          expect(listRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const listRequest = new Request(joinURL(baseURL, '/users'), {
            method: 'GET',
            headers: { 'x-value': '2' },
          });
          listPromise = fetch(listRequest);
          await expectFetchError(listPromise);

          listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
          expect(listRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

          const messageType = type === 'local' ? 'warn' : 'error';
          expect(spies.warn).toHaveBeenCalledTimes(messageType === 'warn' ? 1 : 0);
          expect(spies.error).toHaveBeenCalledTimes(messageType === 'error' ? 1 : 0);

          const errorMessage = spies[messageType].mock.calls[0].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, {
            type: messageType,
            platform,
            request: listRequest,
          });
        });
      });
    });

    it('should log an error if a custom unhandled GET request handler throws', async () => {
      const error = new Error('Unhandled request.');

      const onUnhandledRequest = vi.fn((request: Request) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          throw error;
        }
      });

      await usingHttpInterceptor<{
        '/users': {
          GET: {
            request: {
              headers: { 'x-value': string };
              searchParams: { name?: string };
            };
            response: {
              200: { body: User[] };
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const listHandler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 200,
              body: users,
            }),
          interceptor,
        );

        let listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
        expect(listRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const listResponse = await fetch(joinURL(baseURL, '/users'), {
            method: 'GET',
            headers: { 'x-value': '1' },
          });
          expect(listResponse.status).toBe(200);

          listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
          expect(listRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const searchParams = new HttpSearchParams({ name: 'User 1' });

          let listPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method: 'GET',
            headers: { 'x-value': '2' },
          });
          await expectFetchError(listPromise);

          listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
          expect(listRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const listRequest = new Request(joinURL(baseURL, '/users'), {
            method: 'GET',
            headers: { 'x-value': '2' },
          });
          listPromise = fetch(listRequest);
          await expectFetchError(listPromise);

          listRequests = await promiseIfRemote(listHandler.requests(), interceptor);
          expect(listRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(1);

          expect(spies.error).toHaveBeenCalledWith(error);
        });
      });
    });
  });
}
