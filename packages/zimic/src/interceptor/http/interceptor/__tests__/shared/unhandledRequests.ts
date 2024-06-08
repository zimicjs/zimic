import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HTTP_METHODS, HttpSchema } from '@/http/types/schema';
import { http } from '@/interceptor';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/interceptor/server/constants';
import { methodCanHaveRequestBody } from '@/utils/http';
import { joinURL } from '@/utils/urls';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectFetchErrorOrPreflightResponse } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions, UnhandledRequestStrategy } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './types';
import { verifyUnhandledRequestMessage } from './utils';

export function declareUnhandledRequestHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;
  });

  describe.each(HTTP_METHODS)('Method: %s', (method) => {
    const { overridesPreflightResponse, numberOfRequestsIncludingPreflight } = assessPreflightInterference({
      method,
      platform,
      type,
    });

    const lowerMethod = method.toLowerCase<'POST'>();

    type MethodSchemaWithoutRequestBody = HttpSchema.Method<{
      request: {
        headers: { 'x-value'?: string };
        searchParams: { 'x-value'?: string; name?: string };
      };
      response: { 200: { headers: AccessControlHeaders } };
    }>;

    type MethodSchemaWithRequestBody = HttpSchema.Method<{
      request: {
        headers: { 'x-value'?: string };
        searchParams: { 'x-value'?: string; name?: string };
        body: { message: string };
      };
      response: {
        200: { headers: AccessControlHeaders };
      };
    }>;

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
        it(`should show a warning when logging is enabled and an ${method} request with no body is unhandled and bypassed`, async () => {
          await usingHttpInterceptor<{
            '/users': {
              GET: MethodSchemaWithoutRequestBody;
              POST: MethodSchemaWithoutRequestBody;
              PUT: MethodSchemaWithoutRequestBody;
              PATCH: MethodSchemaWithoutRequestBody;
              DELETE: MethodSchemaWithoutRequestBody;
              HEAD: MethodSchemaWithoutRequestBody;
              OPTIONS: MethodSchemaWithoutRequestBody;
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const handler = await promiseIfRemote(
                interceptor[lowerMethod]('/users')
                  .with({ headers: { 'x-value': '1' } })
                  .respond({
                    status: 200,
                    headers: DEFAULT_ACCESS_CONTROL_HEADERS,
                  }),
                interceptor,
              );
              expect(handler).toBeInstanceOf(Handler);

              let requests = await promiseIfRemote(handler.requests(), interceptor);
              expect(requests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const response = await fetch(joinURL(baseURL, '/users'), {
                  method,
                  headers: { 'x-value': '1' },
                });
                expect(response.status).toBe(200);

                requests = await promiseIfRemote(handler.requests(), interceptor);
                expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
                const interceptedRequest = requests[numberOfRequestsIncludingPreflight - 1];
                expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
                expect(interceptedRequest.body).toBe(null);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const request = new Request(joinURL(baseURL, '/users'), { method });
                const promise = fetch(request);
                await expectFetchErrorOrPreflightResponse(promise, {
                  shouldBePreflight: overridesPreflightResponse,
                });

                requests = await promiseIfRemote(handler.requests(), interceptor);
                expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

                expect(spies.warn).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const warnMessage = spies.warn.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(warnMessage, {
                  type: 'warn',
                  platform,
                  request,
                });
              });
            },
          );
        });
      }

      if (type === 'local' && methodCanHaveRequestBody(method)) {
        it(`should show a warning when logging is enabled and an ${method} request with body is unhandled and bypassed`, async () => {
          await usingHttpInterceptor<{
            '/users': {
              POST: MethodSchemaWithRequestBody;
              PUT: MethodSchemaWithRequestBody;
              PATCH: MethodSchemaWithRequestBody;
              DELETE: MethodSchemaWithRequestBody;
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const handler = await promiseIfRemote(
                interceptor[lowerMethod]('/users')
                  .with({ headers: { 'x-value': '1' } })
                  .respond({
                    status: 200,
                    headers: DEFAULT_ACCESS_CONTROL_HEADERS,
                  }),
                interceptor,
              );
              expect(handler).toBeInstanceOf(Handler);

              let requests = await promiseIfRemote(handler.requests(), interceptor);
              expect(requests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const response = await fetch(joinURL(baseURL, '/users'), {
                  method,
                  headers: { 'x-value': '1', 'content-type': 'application/json' },
                  body: JSON.stringify({ message: 'ok' }),
                });
                expect(response.status).toBe(200);

                requests = await promiseIfRemote(handler.requests(), interceptor);
                expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
                const interceptedRequest = requests[numberOfRequestsIncludingPreflight - 1];
                expectTypeOf(interceptedRequest.body).toEqualTypeOf<{ message: string }>();
                expect(interceptedRequest.body).toEqual({ message: 'ok' });

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const request = new Request(joinURL(baseURL, '/users'), {
                  method,
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ message: 'ok' }),
                });
                const requestClone = request.clone();
                const promise = fetch(request);
                await expectFetchErrorOrPreflightResponse(promise, {
                  shouldBePreflight: overridesPreflightResponse,
                });

                requests = await promiseIfRemote(handler.requests(), interceptor);
                expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

                expect(spies.warn).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const warnMessage = spies.warn.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(warnMessage, {
                  type: 'warn',
                  platform,
                  request: requestClone,
                });
              });
            },
          );
        });
      }

      if (type === 'remote') {
        it(`should show an error when logging is enabled and an ${method} request with no body is unhandled and rejected`, async () => {
          await usingHttpInterceptor<{
            '/users': {
              GET: MethodSchemaWithoutRequestBody;
              POST: MethodSchemaWithoutRequestBody;
              PUT: MethodSchemaWithoutRequestBody;
              PATCH: MethodSchemaWithoutRequestBody;
              DELETE: MethodSchemaWithoutRequestBody;
              HEAD: MethodSchemaWithoutRequestBody;
              OPTIONS: MethodSchemaWithoutRequestBody;
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const handler = await promiseIfRemote(
                interceptor[lowerMethod]('/users')
                  .with({ searchParams: { 'x-value': '1' } })
                  .respond({
                    status: 200,
                    headers: DEFAULT_ACCESS_CONTROL_HEADERS,
                  }),
                interceptor,
              );
              expect(handler).toBeInstanceOf(Handler);

              let requests = await promiseIfRemote(handler.requests(), interceptor);
              expect(requests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const searchParams = new HttpSearchParams({ 'x-value': '1' });

                const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method });
                expect(response.status).toBe(200);

                requests = await promiseIfRemote(handler.requests(), interceptor);
                expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
                const interceptedRequest = requests[numberOfRequestsIncludingPreflight - 1];
                expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
                expect(interceptedRequest.body).toBe(null);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const request = new Request(joinURL(baseURL, '/users'), {
                  method,
                  headers: { 'x-value': '1' },
                });
                const promise = fetch(request);
                await expectFetchErrorOrPreflightResponse(promise, {
                  shouldBePreflight: overridesPreflightResponse,
                });

                requests = await promiseIfRemote(handler.requests(), interceptor);
                expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

                const errorMessage = spies.error.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(errorMessage, {
                  type: 'error',
                  platform,
                  request,
                });
              });
            },
          );
        });
      }

      if (type === 'remote' && methodCanHaveRequestBody(method)) {
        it(`should show an error when logging is enabled and an ${method} request with body is unhandled and rejected`, async () => {
          await usingHttpInterceptor<{
            '/users': {
              POST: MethodSchemaWithRequestBody;
              PUT: MethodSchemaWithRequestBody;
              PATCH: MethodSchemaWithRequestBody;
              DELETE: MethodSchemaWithRequestBody;
            };
          }>(
            {
              ...interceptorOptions,
              onUnhandledRequest: overrideDefault === false ? { log: true } : {},
            },
            async (interceptor) => {
              const handler = await promiseIfRemote(
                interceptor[lowerMethod]('/users')
                  .with({ searchParams: { 'x-value': '1' } })
                  .respond({
                    status: 200,
                    headers: DEFAULT_ACCESS_CONTROL_HEADERS,
                  }),
                interceptor,
              );
              expect(handler).toBeInstanceOf(Handler);

              let requests = await promiseIfRemote(handler.requests(), interceptor);
              expect(requests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const searchParams = new HttpSearchParams({ 'x-value': '1' });

                const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
                  method,
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ message: 'ok' }),
                });
                expect(response.status).toBe(200);

                requests = await promiseIfRemote(handler.requests(), interceptor);
                expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
                const interceptedRequest = requests[numberOfRequestsIncludingPreflight - 1];
                expectTypeOf(interceptedRequest.body).toEqualTypeOf<{ message: string }>();
                expect(interceptedRequest.body).toEqual({ message: 'ok' });

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const request = new Request(joinURL(baseURL, '/users'), {
                  method,
                  headers: { 'x-value': '1', 'content-type': 'application/json' },
                  body: JSON.stringify({ message: 'ok' }),
                });
                const requestClone = request.clone();
                const promise = fetch(request);
                await expectFetchErrorOrPreflightResponse(promise, {
                  shouldBePreflight: overridesPreflightResponse,
                });

                requests = await promiseIfRemote(handler.requests(), interceptor);
                expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

                const errorMessage = spies.error.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(errorMessage, {
                  type: 'error',
                  platform,
                  request: requestClone,
                });
              });
            },
          );
        });
      }
    });

    it.each([{ overrideDefault: false }, { overrideDefault: 'static' }, { overrideDefault: 'function' }])(
      `should not show a warning or error when logging is disabled and an ${method} request is unhandled: override default $overrideDefault`,
      async ({ overrideDefault }) => {
        if (overrideDefault === 'static') {
          http.default.onUnhandledRequest({ log: false });
        } else if (overrideDefault === 'function') {
          http.default.onUnhandledRequest(vi.fn());
        }

        await usingHttpInterceptor<{
          '/users': {
            GET: MethodSchemaWithoutRequestBody;
            POST: MethodSchemaWithoutRequestBody;
            PUT: MethodSchemaWithoutRequestBody;
            PATCH: MethodSchemaWithoutRequestBody;
            DELETE: MethodSchemaWithoutRequestBody;
            HEAD: MethodSchemaWithoutRequestBody;
            OPTIONS: MethodSchemaWithoutRequestBody;
          };
        }>(
          {
            ...interceptorOptions,
            onUnhandledRequest: overrideDefault === false ? { log: false } : {},
          },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor[lowerMethod]('/users')
                .with({ searchParams: { 'x-value': '1' } })
                .respond({
                  status: 200,
                  headers: DEFAULT_ACCESS_CONTROL_HEADERS,
                }),
              interceptor,
            );
            expect(handler).toBeInstanceOf(Handler);

            let requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (spies) => {
              const searchParams = new HttpSearchParams({ 'x-value': '1' });

              const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method });
              expect(response.status).toBe(200);

              requests = await promiseIfRemote(handler.requests(), interceptor);
              expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);

              const request = new Request(joinURL(baseURL, '/users'), { method });
              const promise = fetch(request);
              await expectFetchErrorOrPreflightResponse(promise, {
                shouldBePreflight: overridesPreflightResponse,
              });

              requests = await promiseIfRemote(handler.requests(), interceptor);
              expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);
            });
          },
        );
      },
    );

    it(`should support a custom unhandled ${method} request handler`, async () => {
      const onUnhandledRequest = vi.fn(async (request: Request, context: UnhandledRequestStrategy.HandlerContext) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          await context.log();
        }
      });

      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchemaWithoutRequestBody;
          POST: MethodSchemaWithoutRequestBody;
          PUT: MethodSchemaWithoutRequestBody;
          PATCH: MethodSchemaWithoutRequestBody;
          DELETE: MethodSchemaWithoutRequestBody;
          HEAD: MethodSchemaWithoutRequestBody;
          OPTIONS: MethodSchemaWithoutRequestBody;
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
            .with({ searchParams: { 'x-value': '1' } })
            .respond({
              status: 200,
              headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const searchParams = new HttpSearchParams<{
            'x-value': string;
            name?: string;
          }>({ 'x-value': '1' });

          const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          searchParams.set('x-value', '2');
          searchParams.set('name', 'User 1');

          let promise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method,
            headers: { 'x-value': '1' },
          });
          await expectFetchErrorOrPreflightResponse(promise, {
            shouldBePreflight: overridesPreflightResponse,
          });

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const request = new Request(joinURL(baseURL, '/users'), { method });
          promise = fetch(request);
          await expectFetchErrorOrPreflightResponse(promise, {
            shouldBePreflight: overridesPreflightResponse,
          });

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight * 2);
          const messageType = type === 'local' ? 'warn' : 'error';
          expect(spies.warn).toHaveBeenCalledTimes(messageType === 'warn' ? numberOfRequestsIncludingPreflight : 0);
          expect(spies.error).toHaveBeenCalledTimes(messageType === 'error' ? numberOfRequestsIncludingPreflight : 0);

          const errorMessage = spies[messageType].mock.calls[0].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, {
            type: messageType,
            platform,
            request,
          });
        });
      });
    });

    it(`should log an error if a custom unhandled ${method} request handler throws`, async () => {
      const error = new Error('Unhandled request.');

      const onUnhandledRequest = vi.fn((request: Request) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          throw error;
        }
      });

      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchemaWithoutRequestBody;
          POST: MethodSchemaWithoutRequestBody;
          PUT: MethodSchemaWithoutRequestBody;
          PATCH: MethodSchemaWithoutRequestBody;
          DELETE: MethodSchemaWithoutRequestBody;
          HEAD: MethodSchemaWithoutRequestBody;
          OPTIONS: MethodSchemaWithoutRequestBody;
        };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
            .with({ searchParams: { 'x-value': '1' } })
            .respond({
              status: 200,
              headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const searchParams = new HttpSearchParams<{
            'x-value': string;
            name?: string;
          }>({ 'x-value': '1' });

          const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method });
          expect(response.status).toBe(200);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          searchParams.set('x-value', '2');
          searchParams.set('name', 'User 1');

          let promise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method,
            headers: { 'x-value': '1' },
          });
          await expectFetchErrorOrPreflightResponse(promise, {
            shouldBePreflight: overridesPreflightResponse,
          });

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const request = new Request(joinURL(baseURL, '/users'), { method });
          promise = fetch(request);
          await expectFetchErrorOrPreflightResponse(promise, {
            shouldBePreflight: overridesPreflightResponse,
          });

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight * 2);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

          expect(spies.error).toHaveBeenCalledWith(error);
        });
      });
    });
  });
}
