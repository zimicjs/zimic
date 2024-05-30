import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema } from '@/http/types/schema';
import { http } from '@/interceptor';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { joinURL } from '@/utils/urls';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectFetchError } from '@tests/utils/fetch';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions, UnhandledRequestStrategy } from '../../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from '../types';
import { verifyUnhandledRequestMessage } from '../utils';

export function declareHeadHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Handler = options.type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;
  });

  describe('Restrictions', () => {
    it('should support intercepting HEAD requests having headers restrictions', async () => {
      type UserHeadHeaders = HttpSchema.Headers<{
        'content-language'?: string;
        accept?: string;
      }>;

      await usingHttpInterceptor<{
        '/users': {
          HEAD: {
            request: {
              headers: UserHeadHeaders;
            };
            response: {
              200: {};
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const headHandler = interceptor
          .head('/users')
          .with({
            headers: { 'content-language': 'en' },
          })
          .with((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserHeadHeaders>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            return request.headers.get('accept')?.includes('application/json') ?? false;
          })
          .respond((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<UserHeadHeaders>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            return {
              status: 200,
            };
          });
        expect(headHandler).toBeInstanceOf(Handler);

        let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(0);

        const headers = new HttpHeaders<UserHeadHeaders>({
          'content-language': 'en',
          accept: 'application/json',
        });

        let headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD', headers });
        expect(headResponse.status).toBe(200);
        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(1);

        headers.append('accept', 'application/xml');

        headResponse = await fetch(joinURL(baseURL, '/users'), { method: 'HEAD', headers });
        expect(headResponse.status).toBe(200);

        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(2);

        headers.delete('accept');

        let headPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD', headers });
        await expectFetchError(headPromise);

        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(2);

        headers.set('accept', 'application/json');
        headers.set('content-language', 'pt');

        headPromise = fetch(joinURL(baseURL, '/users'), { method: 'HEAD', headers });
        await expectFetchError(headPromise);

        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(2);
      });
    });

    it('should support intercepting HEAD requests having search params restrictions', async () => {
      type UserHeadSearchParams = HttpSchema.SearchParams<{
        tag?: string;
      }>;

      await usingHttpInterceptor<{
        '/users': {
          HEAD: {
            request: {
              searchParams: UserHeadSearchParams;
            };
            response: {
              200: {};
            };
          };
        };
      }>(interceptorOptions, async (interceptor) => {
        const headHandler = interceptor
          .head('/users')
          .with({
            searchParams: { tag: 'admin' },
          })
          .respond((request) => {
            expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<UserHeadSearchParams>>();
            expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

            return {
              status: 200,
            };
          });
        expect(headHandler).toBeInstanceOf(Handler);

        let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(0);

        const searchParams = new HttpSearchParams<UserHeadSearchParams>({
          tag: 'admin',
        });

        const headResponse = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'HEAD' });
        expect(headResponse.status).toBe(200);
        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(1);

        searchParams.delete('tag');

        const headPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'HEAD' });
        await expectFetchError(headPromise);
        headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(1);
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
        it('should show a warning when logging is enabled and a HEAD request is unhandled and bypassed', async () => {
          await usingHttpInterceptor<{
            '/users': {
              HEAD: {
                request: { headers: { 'x-value': string } };
                response: {
                  200: {};
                };
              };
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const headHandler = await promiseIfRemote(
                interceptor
                  .head('/users')
                  .with({ headers: { 'x-value': '1' } })
                  .respond({
                    status: 200,
                  }),
                interceptor,
              );

              let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
              expect(headRequests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const headResponse = await fetch(joinURL(baseURL, '/users'), {
                  method: 'HEAD',
                  headers: { 'x-value': '1' },
                });
                expect(headResponse.status).toBe(200);

                headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
                expect(headRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const headRequest = new Request(joinURL(baseURL, '/users'), { method: 'HEAD' });
                const headPromise = fetch(headRequest);
                await expectFetchError(headPromise);

                headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
                expect(headRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(1);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const warnMessage = spies.warn.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(warnMessage, {
                  type: 'warn',
                  platform,
                  request: headRequest,
                });
              });
            },
          );
        });
      }

      if (type === 'remote') {
        it('should show an error when logging is enabled and a HEAD request is unhandled and rejected', async () => {
          await usingHttpInterceptor<{
            '/users': {
              HEAD: {
                request: { headers: { 'x-value': string } };
                response: {
                  200: {};
                };
              };
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const headHandler = await promiseIfRemote(
                interceptor
                  .head('/users')
                  .with({ headers: { 'x-value': '1' } })
                  .respond({
                    status: 200,
                  }),
                interceptor,
              );

              let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
              expect(headRequests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const headResponse = await fetch(joinURL(baseURL, '/users'), {
                  method: 'HEAD',
                  headers: { 'x-value': '1' },
                });
                expect(headResponse.status).toBe(200);

                headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
                expect(headRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const headRequest = new Request(joinURL(baseURL, '/users'), {
                  method: 'HEAD',
                  headers: { 'x-value': '2' },
                });
                const headPromise = fetch(headRequest);
                await expectFetchError(headPromise);

                headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
                expect(headRequests).toHaveLength(1);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(1);

                const errorMessage = spies.error.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(errorMessage, {
                  type: 'error',
                  platform,
                  request: headRequest,
                });
              });
            },
          );
        });
      }
    });

    it.each([{ overrideDefault: false }, { overrideDefault: 'static' }, { overrideDefault: 'function' }])(
      'should not show a warning or error when logging is disabled and a HEAD request is unhandled: override default $overrideDefault',
      async ({ overrideDefault }) => {
        if (overrideDefault === 'static') {
          http.default.onUnhandledRequest({ log: false });
        } else if (overrideDefault === 'function') {
          http.default.onUnhandledRequest(vi.fn());
        }

        await usingHttpInterceptor<{
          '/users': {
            HEAD: {
              request: { headers: { 'x-value': string } };
              response: {
                200: {};
              };
            };
          };
        }>(
          {
            ...interceptorOptions,
            onUnhandledRequest: overrideDefault === false ? { log: false } : {},
          },
          async (interceptor) => {
            const headHandler = await promiseIfRemote(
              interceptor
                .head('/users')
                .with({ headers: { 'x-value': '1' } })
                .respond({
                  status: 200,
                }),
              interceptor,
            );

            let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
            expect(headRequests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (spies) => {
              const headResponse = await fetch(joinURL(baseURL, '/users'), {
                method: 'HEAD',
                headers: { 'x-value': '1' },
              });
              expect(headResponse.status).toBe(200);

              headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
              expect(headRequests).toHaveLength(1);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);

              const headRequest = new Request(joinURL(baseURL, '/users'), {
                method: 'HEAD',
                headers: { 'x-value': '2' },
              });
              const headPromise = fetch(headRequest);
              await expectFetchError(headPromise);

              headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
              expect(headRequests).toHaveLength(1);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);
            });
          },
        );
      },
    );

    it('should support a custom unhandled HEAD request handler', async () => {
      const onUnhandledRequest = vi.fn(async (request: Request, context: UnhandledRequestStrategy.HandlerContext) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          await context.log();
        }
      });

      await usingHttpInterceptor<{
        '/users': {
          HEAD: {
            request: {
              headers: { 'x-value': string };
              searchParams: { name?: string };
            };
            response: {
              200: {};
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const headHandler = await promiseIfRemote(
          interceptor
            .head('/users')
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 200,
            }),
          interceptor,
        );

        let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const headResponse = await fetch(joinURL(baseURL, '/users'), {
            method: 'HEAD',
            headers: { 'x-value': '1' },
          });
          expect(headResponse.status).toBe(200);

          headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
          expect(headRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const searchParams = new HttpSearchParams({ name: 'User 1' });

          let headPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method: 'HEAD',
            headers: { 'x-value': '2' },
          });
          await expectFetchError(headPromise);

          headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
          expect(headRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const headRequest = new Request(joinURL(baseURL, '/users'), {
            method: 'HEAD',
            headers: { 'x-value': '2' },
          });
          headPromise = fetch(headRequest);
          await expectFetchError(headPromise);

          headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
          expect(headRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

          const messageType = type === 'local' ? 'warn' : 'error';
          expect(spies.warn).toHaveBeenCalledTimes(messageType === 'warn' ? 1 : 0);
          expect(spies.error).toHaveBeenCalledTimes(messageType === 'error' ? 1 : 0);

          const errorMessage = spies[messageType].mock.calls[0].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, {
            type: messageType,
            platform,
            request: headRequest,
          });
        });
      });
    });

    it('should log an error if a custom unhandled HEAD request handler throws', async () => {
      const error = new Error('Unhandled request.');

      const onUnhandledRequest = vi.fn((request: Request) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          throw error;
        }
      });

      await usingHttpInterceptor<{
        '/users': {
          HEAD: {
            request: {
              headers: { 'x-value': string };
              searchParams: { name?: string };
            };
            response: {
              200: {};
            };
          };
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const headHandler = await promiseIfRemote(
          interceptor
            .head('/users')
            .with({ headers: { 'x-value': '1' } })
            .respond({
              status: 200,
            }),
          interceptor,
        );

        let headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
        expect(headRequests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const headResponse = await fetch(joinURL(baseURL, '/users'), {
            method: 'HEAD',
            headers: { 'x-value': '1' },
          });
          expect(headResponse.status).toBe(200);

          headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
          expect(headRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const searchParams = new HttpSearchParams({ name: 'User 1' });

          let headPromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method: 'HEAD',
            headers: { 'x-value': '2' },
          });
          await expectFetchError(headPromise);

          headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
          expect(headRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const headRequest = new Request(joinURL(baseURL, '/users'), {
            method: 'HEAD',
            headers: { 'x-value': '2' },
          });
          headPromise = fetch(headRequest);
          await expectFetchError(headPromise);

          headRequests = await promiseIfRemote(headHandler.requests(), interceptor);
          expect(headRequests).toHaveLength(1);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(1);

          expect(spies.error).toHaveBeenCalledWith(error);
        });
      });
    });
  });
}
