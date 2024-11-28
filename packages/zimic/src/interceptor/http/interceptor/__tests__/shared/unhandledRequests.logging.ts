import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HTTP_METHODS, HttpSchema } from '@/http/types/schema';
import { httpInterceptor } from '@/interceptor/http';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import { DEFAULT_UNHANDLED_REQUEST_STRATEGY } from '@/interceptor/http/interceptorWorker/constants';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/interceptor/server/constants';
import { importCrypto } from '@/utils/crypto';
import { methodCanHaveRequestBody } from '@/utils/http';
import { waitForDelay } from '@/utils/time';
import { joinURL } from '@/utils/urls';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectBypassedResponse, expectPreflightResponse, expectFetchError } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions, UnhandledRequestStrategy } from '../../types/options';
import { UnhandledHttpInterceptorRequest } from '../../types/requests';
import {
  RuntimeSharedHttpInterceptorTestsOptions,
  verifyUnhandledRequestMessage,
  verifyUnhandledRequest,
} from './utils';

export async function declareUnhandledRequestLoggingHttpInterceptorTests(
  options: RuntimeSharedHttpInterceptorTestsOptions,
) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const crypto = await importCrypto();

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  type MethodSchemaWithoutRequestBody = HttpSchema.Method<{
    request: {
      headers: { 'x-value'?: string };
      searchParams: { value?: string; name?: string };
    };
    response: { 200: { headers: AccessControlHeaders } };
  }>;

  type SchemaWithoutRequestBody = HttpSchema<{
    '/users': {
      GET: MethodSchemaWithoutRequestBody;
      POST: MethodSchemaWithoutRequestBody;
      PUT: MethodSchemaWithoutRequestBody;
      PATCH: MethodSchemaWithoutRequestBody;
      DELETE: MethodSchemaWithoutRequestBody;
      HEAD: MethodSchemaWithoutRequestBody;
      OPTIONS: MethodSchemaWithoutRequestBody;
    };
  }>;

  type MethodSchemaWithRequestBody = HttpSchema.Method<{
    request: {
      headers: { 'x-value'?: string };
      searchParams: { value?: string; name?: string };
      body: { message: string };
    };
    response: {
      200: { headers: AccessControlHeaders };
    };
  }>;

  type SchemaWithRequestBody = HttpSchema<{
    '/users': {
      POST: MethodSchemaWithRequestBody;
      PUT: MethodSchemaWithRequestBody;
      PATCH: MethodSchemaWithRequestBody;
      DELETE: MethodSchemaWithRequestBody;
    };
  }>;

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
          await usingHttpInterceptor<SchemaWithoutRequestBody>(
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
                await verifyUnhandledRequestMessage(warnMessage, { type: 'warn', platform, request });
              });
            },
          );
        });
      }

      if (type === 'local' && methodCanHaveRequestBody(method)) {
        it(`should show a warning when logging is enabled and ${method} requests with body are unhandled and bypassed`, async () => {
          await usingHttpInterceptor<SchemaWithRequestBody>(
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
                await verifyUnhandledRequestMessage(warnMessage, { type: 'warn', platform, request: requestClone });
              });
            },
          );
        });
      }

      it(`should show an error when logging is enabled and ${method} requests with no body are unhandled and rejected`, async () => {
        if (overrideDefault) {
          localOnUnhandledRequest.action = 'reject';
        }

        await usingHttpInterceptor<SchemaWithoutRequestBody>(
          {
            ...interceptorOptions,
            type,
            onUnhandledRequest: overrideDefault ? undefined : { action: 'reject', log: true },
          },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor[lowerMethod]('/users')
                .with({ searchParams: { value: '1' } })
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
              const searchParams = new HttpSearchParams({ value: '1' });

              const response = await fetch(joinURL(baseURL, `/users?${searchParams}`), { method });
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
                headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
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
              await verifyUnhandledRequestMessage(errorMessage, { type: 'error', platform, request });
            });
          },
        );
      });

      if (methodCanHaveRequestBody(method)) {
        it(`should show an error when logging is enabled and ${method} requests with body are unhandled and rejected`, async () => {
          if (overrideDefault) {
            localOnUnhandledRequest.action = 'reject';
          }

          await usingHttpInterceptor<SchemaWithRequestBody>(
            {
              ...interceptorOptions,
              type,
              onUnhandledRequest: overrideDefault ? undefined : { action: 'reject', log: true },
            },
            async (interceptor) => {
              const handler = await promiseIfRemote(
                interceptor[lowerMethod]('/users')
                  .with({ searchParams: { value: '1' } })
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
                const searchParams = new HttpSearchParams({ value: '1' });

                const response = await fetch(joinURL(baseURL, `/users?${searchParams}`), {
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
                  headers: {
                    'x-id': crypto.randomUUID(), // Ensure the request is unique.
                    'content-type': 'application/json',
                  },
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
                await verifyUnhandledRequestMessage(errorMessage, { type: 'error', platform, request: requestClone });
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
      const localOnUnhandledRequest: UnhandledRequestStrategy.LocalDeclaration = {
        action: 'bypass',
        log: false,
      };
      const remoteOnUnhandledRequest: UnhandledRequestStrategy.RemoteDeclaration = {
        action: 'reject',
        log: false,
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

          await usingHttpInterceptor<SchemaWithoutRequestBody>(extendedInterceptorOptions, async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor[lowerMethod]('/users')
                .with({ searchParams: { value: '1' } })
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
              const searchParams = new HttpSearchParams({ value: '1' });

              const response = await fetch(joinURL(baseURL, `/users?${searchParams}`), { method });
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

        await usingHttpInterceptor<SchemaWithoutRequestBody>(extendedInterceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .with({ searchParams: { value: '1' } })
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
            const searchParams = new HttpSearchParams({ value: '1' });

            const response = await fetch(joinURL(baseURL, `/users?${searchParams}`), { method });
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

    describe('Global logging', () => {
      beforeEach(() => {
        httpInterceptor.default.local.onUnhandledRequest = { action: 'reject', log: true };
        httpInterceptor.default.remote.onUnhandledRequest = { action: 'reject', log: true };
      });

      it(`should not log global unhandled ${method} requests when no interceptors exist`, async () => {
        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const request = new Request(joinURL(baseURL, '/users'), { method });
          const responsePromise = fetch(request);

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else if (type === 'local') {
            await expectBypassedResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);
        });
      });

      it(`should not log global unhandled ${method} requests when no interceptor was matched`, async () => {
        const otherBaseURL = joinURL(baseURL, 'other');

        await usingHttpInterceptor<SchemaWithoutRequestBody>(
          { ...interceptorOptions, baseURL: otherBaseURL },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor[lowerMethod]('/users').respond({
                status: 200,
                headers: DEFAULT_ACCESS_CONTROL_HEADERS,
              }),
              interceptor,
            );
            expect(handler).toBeInstanceOf(Handler);

            let requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (spies) => {
              const request = new Request(joinURL(baseURL, '/users'), { method });
              expect(request.url.startsWith(otherBaseURL)).toBe(false);

              const responsePromise = fetch(request);

              if (overridesPreflightResponse) {
                await expectPreflightResponse(responsePromise);
              } else if (type === 'local') {
                await expectBypassedResponse(responsePromise);
              } else {
                await expectFetchError(responsePromise);
              }

              requests = await promiseIfRemote(handler.requests(), interceptor);
              expect(requests).toHaveLength(0);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);
            });
          },
        );
      });

      it(`should not log unhandled ${method} requests when the matched interceptor is not running`, async () => {
        await usingHttpInterceptor<SchemaWithoutRequestBody>(
          {
            ...interceptorOptions,
            onUnhandledRequest: { action: 'reject', log: true },
          },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor[lowerMethod]('/users')
                .with({ searchParams: { value: '1' } })
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
              const searchParams = new HttpSearchParams({ value: '1' });

              const response = await fetch(joinURL(baseURL, `/users?${searchParams}`), { method });
              expect(response.status).toBe(200);

              requests = await promiseIfRemote(handler.requests(), interceptor);
              expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);

              const request = new Request(joinURL(baseURL, '/users'), {
                method,
                headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
              });
              let responsePromise = fetch(request);

              if (overridesPreflightResponse) {
                await expectPreflightResponse(responsePromise);
              } else {
                await expectFetchError(responsePromise);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

                const errorMessage = spies.error.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(errorMessage, { type: 'error', platform, request });
              }

              spies.warn.mockClear();
              spies.error.mockClear();

              await interceptor.stop();

              responsePromise = fetch(request);

              if (overridesPreflightResponse) {
                await expectPreflightResponse(responsePromise);
              } else if (type === 'local') {
                await expectBypassedResponse(responsePromise);
              } else {
                await expectFetchError(responsePromise);
              }

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);
            });
          },
        );
      });
    });

    describe('Synchronous and asynchronous factories', () => {
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

        await usingHttpInterceptor<SchemaWithoutRequestBody>(extendedInterceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .with({ searchParams: { value: '1' } })
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
            const searchParams = new HttpSearchParams<{ value: string; name?: string }>({ value: '1' });

            const response = await fetch(joinURL(baseURL, `/users?${searchParams}`), { method });
            expect(response.status).toBe(200);

            requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

            expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(0);
            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(0);

            searchParams.set('value', '2');
            searchParams.set('name', 'User 1');

            let responsePromise = fetch(joinURL(baseURL, `/users?${searchParams}`), {
              method,
              headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
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
            await verifyUnhandledRequestMessage(errorMessage, { type: 'error', platform, request });
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

        await usingHttpInterceptor<SchemaWithoutRequestBody>(extendedInterceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .with({ searchParams: { value: '1' } })
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
            const searchParams = new HttpSearchParams<{ value: string; name?: string }>({ value: '1' });

            const response = await fetch(joinURL(baseURL, `/users?${searchParams}`), { method });
            expect(response.status).toBe(200);

            requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

            expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(0);
            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(0);

            searchParams.set('value', '2');
            searchParams.set('name', 'User 1');

            let responsePromise = fetch(joinURL(baseURL, `/users?${searchParams}`), {
              method,
              headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
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
            await verifyUnhandledRequestMessage(errorMessage, { type: 'error', platform, request });
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

        await usingHttpInterceptor<SchemaWithoutRequestBody>(extendedInterceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .with({ searchParams: { value: '1' } })
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
            const searchParams = new HttpSearchParams<{ value: string; name?: string }>({ value: '1' });

            const response = await fetch(joinURL(baseURL, `/users?${searchParams}`), { method });
            expect(response.status).toBe(200);

            requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

            expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(0);
            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(0);

            searchParams.set('value', '2');
            searchParams.set('name', 'User 1');

            let responsePromise = fetch(joinURL(baseURL, `/users?${searchParams}`), {
              method,
              headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
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

        await usingHttpInterceptor<SchemaWithoutRequestBody>(extendedInterceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .with({ searchParams: { value: '1' } })
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
              value: string;
              name?: string;
            }>({ value: '1' });

            const response = await fetch(joinURL(baseURL, `/users?${searchParams}`), { method });
            expect(response.status).toBe(200);

            requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

            expect(extendedInterceptorOptions.onUnhandledRequest).toHaveBeenCalledTimes(0);
            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(0);

            searchParams.set('value', '2');
            searchParams.set('name', 'User 1');

            let responsePromise = fetch(joinURL(baseURL, `/users?${searchParams}`), {
              method,
              headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
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
  });
}
