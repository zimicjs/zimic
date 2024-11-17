import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { HttpHeaders, HttpRequest } from '@/http';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HTTP_METHODS, HttpSchema } from '@/http/types/schema';
import { httpInterceptor } from '@/interceptor/http';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import { DEFAULT_UNHANDLED_REQUEST_STRATEGY } from '@/interceptor/http/interceptorWorker/constants';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import {
  HttpRequestBodySchema,
  UnhandledHttpInterceptorRequest,
  UnhandledHttpInterceptorRequestSchema,
} from '@/interceptor/http/requestHandler/types/requests';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/interceptor/server/constants';
import { methodCanHaveRequestBody } from '@/utils/http';
import { waitForDelay } from '@/utils/time';
import { joinURL } from '@/utils/urls';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectBypassedResponse, expectPreflightResponse, expectFetchError } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions, UnhandledRequestStrategy } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions, verifyUnhandledRequestMessage } from './utils';

const verifyUnhandledRequest = vi.fn((request: UnhandledHttpInterceptorRequest, method: string) => {
  expect(request).toBeInstanceOf(Request);
  expect(request).not.toHaveProperty('response');

  expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<Record<string, string>>>();
  expect(request.headers).toBeInstanceOf(HttpHeaders);

  expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<Record<string, string | string[]>>>();
  expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

  expectTypeOf(request.pathParams).toEqualTypeOf<{}>();
  expect(request.pathParams).toEqual({});

  type BodySchema = HttpRequestBodySchema<UnhandledHttpInterceptorRequestSchema>;

  expectTypeOf(request.body).toEqualTypeOf<BodySchema>();
  expect(request).toHaveProperty('body');

  expectTypeOf(request.raw).toEqualTypeOf<HttpRequest<BodySchema>>();
  expect(request.raw).toBeInstanceOf(Request);
  expect(request.raw.url).toBe(request.url);
  expect(request.raw.method).toBe(method);
  expect(Object.fromEntries(request.headers)).toEqual(expect.objectContaining(Object.fromEntries(request.raw.headers)));
});

export function declareUnhandledRequestHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;

    verifyUnhandledRequest.mockClear();
  });

  describe.each(HTTP_METHODS)('Method (%s)', (method) => {
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
      { overrideDefault: undefined },
      { overrideDefault: 'static' as const },
      { overrideDefault: 'static-undefined-log' as const },
      { overrideDefault: 'factory' as const },
      { overrideDefault: 'factory-undefined-log' as const },
    ])('Logging enabled: override default $overrideDefault', ({ overrideDefault }) => {
      const log = overrideDefault?.endsWith('undefined-log') ? undefined : true;

      const localOnUnhandledRequest: UnhandledRequestStrategy.LocalDeclaration = {
        action: 'bypass',
        log,
      };
      const remoteOnUnhandledRequest: UnhandledRequestStrategy.RemoteDeclaration = {
        action: 'reject',
        log,
      };

      beforeEach(() => {
        if (overrideDefault?.startsWith('static')) {
          if (type === 'local') {
            httpInterceptor.default.local.onUnhandledRequest = localOnUnhandledRequest;
            expect(httpInterceptor.default.local.onUnhandledRequest).toBe(localOnUnhandledRequest);
          } else {
            httpInterceptor.default.remote.onUnhandledRequest = remoteOnUnhandledRequest;
            expect(httpInterceptor.default.remote.onUnhandledRequest).toBe(remoteOnUnhandledRequest);
          }
        } else if (overrideDefault?.startsWith('factory')) {
          if (type === 'local') {
            function onUnhandledRequest(request: UnhandledHttpInterceptorRequest) {
              verifyUnhandledRequest(request, method);
              return localOnUnhandledRequest;
            }

            httpInterceptor.default.local.onUnhandledRequest = onUnhandledRequest;
            expect(httpInterceptor.default.local.onUnhandledRequest).toBe(onUnhandledRequest);
          } else {
            function onUnhandledRequest(request: UnhandledHttpInterceptorRequest) {
              verifyUnhandledRequest(request, method);
              return remoteOnUnhandledRequest;
            }

            httpInterceptor.default.remote.onUnhandledRequest = onUnhandledRequest;
            expect(httpInterceptor.default.remote.onUnhandledRequest).toBe(onUnhandledRequest);
          }
        }
      });

      afterEach(() => {
        localOnUnhandledRequest.action = 'bypass';
        remoteOnUnhandledRequest.action = 'reject';

        if (overrideDefault?.startsWith('factory')) {
          expect(verifyUnhandledRequest).toHaveBeenCalled();
        } else {
          expect(verifyUnhandledRequest).not.toHaveBeenCalled();
        }
      });

      if (type === 'local') {
        it(`should show a warning when logging is enabled and ${method} requests with no body are unhandled and bypassed`, async () => {
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
              type,
              onUnhandledRequest: overrideDefault ? undefined : { action: 'bypass', log: true },
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
                const responsePromise = fetch(request);
                await expectBypassedResponse(responsePromise);

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
        it(`should show a warning when logging is enabled and ${method} requests with body are unhandled and bypassed`, async () => {
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
              type,
              onUnhandledRequest: overrideDefault ? undefined : { action: 'bypass', log: true },
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

                const responsePromise = fetch(request);
                await expectBypassedResponse(responsePromise);

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

      it(`should show an error when logging is enabled and ${method} requests with no body are unhandled and rejected`, async () => {
        if (overrideDefault) {
          localOnUnhandledRequest.action = 'reject';
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
            type,
            onUnhandledRequest: overrideDefault ? undefined : { action: 'reject', log: true },
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
              const responsePromise = fetch(request);

              if (overridesPreflightResponse) {
                await expectPreflightResponse(responsePromise);
              } else {
                await expectFetchError(responsePromise);
              }

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

      if (methodCanHaveRequestBody(method)) {
        it(`should show an error when logging is enabled and ${method} requests with body are unhandled and rejected`, async () => {
          if (overrideDefault) {
            localOnUnhandledRequest.action = 'reject';
          }

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
              type,
              onUnhandledRequest: overrideDefault ? undefined : { action: 'reject', log: true },
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

                const responsePromise = fetch(request);
                await expectFetchError(responsePromise);

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

    describe.each([
      { overrideDefault: undefined },
      { overrideDefault: 'static' as const },
      { overrideDefault: 'factory' as const },
    ])('Logging disabled: override default $overrideDefault', ({ overrideDefault }) => {
      const logWarning = false;

      const localOnUnhandledRequest: UnhandledRequestStrategy.LocalDeclaration = {
        action: 'bypass',
        log: logWarning,
      };
      const remoteOnUnhandledRequest: UnhandledRequestStrategy.RemoteDeclaration = {
        action: 'reject',
        log: logWarning,
      };

      beforeEach(() => {
        if (overrideDefault === 'static') {
          if (type === 'local') {
            httpInterceptor.default.local.onUnhandledRequest = localOnUnhandledRequest;
            expect(httpInterceptor.default.local.onUnhandledRequest).toBe(localOnUnhandledRequest);
          } else {
            httpInterceptor.default.remote.onUnhandledRequest = remoteOnUnhandledRequest;
            expect(httpInterceptor.default.remote.onUnhandledRequest).toBe(remoteOnUnhandledRequest);
          }
        } else if (overrideDefault === 'factory') {
          if (type === 'local') {
            function onUnhandledRequest(request: UnhandledHttpInterceptorRequest) {
              verifyUnhandledRequest(request, method);
              return localOnUnhandledRequest;
            }

            httpInterceptor.default.local.onUnhandledRequest = onUnhandledRequest;
            expect(httpInterceptor.default.local.onUnhandledRequest).toBe(onUnhandledRequest);
          } else {
            function onUnhandledRequest(request: UnhandledHttpInterceptorRequest) {
              verifyUnhandledRequest(request, method);
              return remoteOnUnhandledRequest;
            }

            httpInterceptor.default.remote.onUnhandledRequest = onUnhandledRequest;
            expect(httpInterceptor.default.remote.onUnhandledRequest).toBe(onUnhandledRequest);
          }
        }
      });

      afterEach(() => {
        localOnUnhandledRequest.action = 'bypass';
        remoteOnUnhandledRequest.action = 'reject';

        if (overrideDefault?.startsWith('factory')) {
          expect(verifyUnhandledRequest).toHaveBeenCalled();
        } else {
          expect(verifyUnhandledRequest).not.toHaveBeenCalled();
        }
      });

      if (type === 'local') {
        it(`should not show a warning when logging is disabled and ${method} requests are unhandled and bypassed`, async () => {
          const extendedInterceptorOptions: HttpInterceptorOptions = {
            ...interceptorOptions,
            type,
            onUnhandledRequest: overrideDefault ? undefined : { action: 'bypass', log: false },
          };

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
          }>(extendedInterceptorOptions, async (interceptor) => {
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
              const responsePromise = fetch(request);
              await expectBypassedResponse(responsePromise);

              requests = await promiseIfRemote(handler.requests(), interceptor);
              expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);
            });
          });
        });
      }

      it(`should not show an error when logging is disabled and ${method} requests are unhandled and rejected`, async () => {
        if (overrideDefault) {
          localOnUnhandledRequest.action = 'reject';
        }

        const extendedInterceptorOptions: HttpInterceptorOptions = {
          ...interceptorOptions,
          type,
          onUnhandledRequest: overrideDefault ? undefined : { action: 'reject', log: false },
        };

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
        }>(extendedInterceptorOptions, async (interceptor) => {
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
            const responsePromise = fetch(request);

            if (overridesPreflightResponse) {
              await expectPreflightResponse(responsePromise);
            } else {
              await expectFetchError(responsePromise);
            }

            requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(0);
          });
        });
      });
    });

    it(`should support a synchronous unhandled ${method} request factory`, async () => {
      const localOnUnhandledRequest = vi.fn<UnhandledRequestStrategy.LocalDeclarationFactory>((request) => {
        const url = new URL(request.url);
        return {
          action: 'reject',
          log: !url.searchParams.has('name'),
        };
      });

      const remoteOnUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>((request) => {
        const url = new URL(request.url);
        return {
          action: 'reject',
          log: !url.searchParams.has('name'),
        };
      });

      const extendedInterceptorOptions = (
        type === 'local'
          ? { ...interceptorOptions, type, onUnhandledRequest: localOnUnhandledRequest }
          : { ...interceptorOptions, type, onUnhandledRequest: remoteOnUnhandledRequest }
      ) satisfies HttpInterceptorOptions;

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
      }>(extendedInterceptorOptions, async (interceptor) => {
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

          expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          searchParams.set('x-value', '2');
          searchParams.set('name', 'User 1');

          let responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method,
            headers: { 'x-value': '1' },
          });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(
            numberOfRequestsIncludingPreflight,
          );
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const request = new Request(joinURL(baseURL, '/users'), { method });
          responsePromise = fetch(request);

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(
            numberOfRequestsIncludingPreflight * 2,
          );
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

          const errorMessage = spies.error.mock.calls[0].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, {
            type: 'error',
            platform,
            request,
          });
        });
      });
    });

    it(`should support an asynchronous unhandled ${method} request factory`, async () => {
      const localOnUnhandledRequest = vi.fn<UnhandledRequestStrategy.LocalDeclarationFactory>(async (request) => {
        const url = new URL(request.url);

        await waitForDelay(10);

        return {
          action: 'reject',
          log: !url.searchParams.has('name'),
        };
      });

      const remoteOnUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(async (request) => {
        const url = new URL(request.url);

        await waitForDelay(10);

        return {
          action: 'reject',
          log: !url.searchParams.has('name'),
        };
      });

      const extendedInterceptorOptions = (
        type === 'local'
          ? { ...interceptorOptions, type, onUnhandledRequest: localOnUnhandledRequest }
          : { ...interceptorOptions, type, onUnhandledRequest: remoteOnUnhandledRequest }
      ) satisfies HttpInterceptorOptions;

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
      }>(extendedInterceptorOptions, async (interceptor) => {
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

          expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          searchParams.set('x-value', '2');
          searchParams.set('name', 'User 1');

          let responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method,
            headers: { 'x-value': '1' },
          });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(
            numberOfRequestsIncludingPreflight,
          );
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const request = new Request(joinURL(baseURL, '/users'), { method });
          responsePromise = fetch(request);

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(
            numberOfRequestsIncludingPreflight * 2,
          );
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

          const errorMessage = spies.error.mock.calls[0].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, {
            type: 'error',
            platform,
            request,
          });
        });
      });
    });

    it(`should log an error if a synchronous unhandled ${method} request factory throws`, async () => {
      const error = new Error('Unhandled request.');

      const localOnUnhandledRequest = vi.fn<UnhandledRequestStrategy.LocalDeclarationFactory>((request) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          throw error;
        }

        return { action: 'reject', log: false };
      });

      const remoteOnUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>((request) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          throw error;
        }

        return { action: 'reject', log: false };
      });

      const extendedInterceptorOptions = (
        type === 'local'
          ? { ...interceptorOptions, type, onUnhandledRequest: localOnUnhandledRequest }
          : { ...interceptorOptions, type, onUnhandledRequest: remoteOnUnhandledRequest }
      ) satisfies HttpInterceptorOptions;

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
      }>(extendedInterceptorOptions, async (interceptor) => {
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

          expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          searchParams.set('x-value', '2');
          searchParams.set('name', 'User 1');

          let responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method,
            headers: { 'x-value': '1' },
          });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(
            numberOfRequestsIncludingPreflight,
          );
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const request = new Request(joinURL(baseURL, '/users'), { method });
          responsePromise = fetch(request);

          const defaultStrategy = DEFAULT_UNHANDLED_REQUEST_STRATEGY[type];

          if (defaultStrategy.action === 'bypass') {
            await expectBypassedResponse(responsePromise);
          } else if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(
            numberOfRequestsIncludingPreflight * 2,
          );

          if (defaultStrategy.action === 'bypass') {
            expect(spies.warn).toHaveBeenCalledTimes(1);
            expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

            expect(spies.error).toHaveBeenCalledWith(error);

            await verifyUnhandledRequestMessage(spies.warn.mock.calls[0].join(' '), {
              type: 'warn',
              platform,
              request,
            });
          } else {
            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight * 2);

            expect(spies.error).toHaveBeenNthCalledWith(1, error);

            await verifyUnhandledRequestMessage(spies.error.mock.calls[1].join(' '), {
              type: 'error',
              platform,
              request,
            });
          }
        });
      });
    });

    it(`should log an error if an asynchronous unhandled ${method} request factory throws`, async () => {
      const error = new Error('Unhandled request.');

      const localOnUnhandledRequest = vi.fn<UnhandledRequestStrategy.LocalDeclarationFactory>(async (request) => {
        const url = new URL(request.url);

        await waitForDelay(10);

        if (!url.searchParams.has('name')) {
          throw error;
        }

        return { action: 'reject', log: false };
      });

      const remoteOnUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(async (request) => {
        const url = new URL(request.url);

        await waitForDelay(10);

        if (!url.searchParams.has('name')) {
          throw error;
        }

        return { action: 'reject', log: false };
      });

      const extendedInterceptorOptions = (
        type === 'local'
          ? { ...interceptorOptions, type, onUnhandledRequest: localOnUnhandledRequest }
          : { ...interceptorOptions, type, onUnhandledRequest: remoteOnUnhandledRequest }
      ) satisfies HttpInterceptorOptions;

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
      }>(extendedInterceptorOptions, async (interceptor) => {
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

          expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(0);
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          searchParams.set('x-value', '2');
          searchParams.set('name', 'User 1');

          let responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
            method,
            headers: { 'x-value': '1' },
          });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(
            numberOfRequestsIncludingPreflight,
          );
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const request = new Request(joinURL(baseURL, '/users'), { method });
          responsePromise = fetch(request);

          const defaultStrategy = DEFAULT_UNHANDLED_REQUEST_STRATEGY[type];

          if (defaultStrategy.action === 'bypass') {
            await expectBypassedResponse(responsePromise);
          } else if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

          expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(
            numberOfRequestsIncludingPreflight * 2,
          );

          if (defaultStrategy.action === 'bypass') {
            expect(spies.warn).toHaveBeenCalledTimes(1);
            expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

            expect(spies.error).toHaveBeenCalledWith(error);

            await verifyUnhandledRequestMessage(spies.warn.mock.calls[0].join(' '), {
              type: 'warn',
              platform,
              request,
            });
          } else {
            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight * 2);

            expect(spies.error).toHaveBeenNthCalledWith(1, error);

            await verifyUnhandledRequestMessage(spies.error.mock.calls[1].join(' '), {
              type: 'error',
              platform,
              request,
            });
          }
        });
      });
    });
  });
}
