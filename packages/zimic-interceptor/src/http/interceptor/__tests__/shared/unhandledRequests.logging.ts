import { HttpSearchParams, HTTP_METHODS, HttpSchema } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import joinURL from '@zimic/utils/url/joinURL';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { httpInterceptor, UnhandledHttpInterceptorRequest } from '@/http';
import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/server/constants';
import { importCrypto } from '@/utils/crypto';
import { methodCanHaveRequestBody } from '@/utils/http';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectBypassedResponse, expectPreflightResponse } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions, UnhandledRequestStrategy } from '../../types/options';
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

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  const Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;

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

    httpInterceptor.default.local.onUnhandledRequest = { action: 'reject', log: true };
    httpInterceptor.default.remote.onUnhandledRequest = { action: 'reject', log: true };
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

      const localOnUnhandledRequest: UnhandledRequestStrategy.LocalDeclaration = { action: 'reject', log };
      const remoteOnUnhandledRequest: UnhandledRequestStrategy.RemoteDeclaration = { action: 'reject', log };

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
        localOnUnhandledRequest.action = 'reject';
        remoteOnUnhandledRequest.action = 'reject';
      });

      if (type === 'local') {
        it(`should show a warning when logging is enabled and ${method} requests with no body are unhandled and bypassed`, async () => {
          if (overrideDefault) {
            localOnUnhandledRequest.action = 'bypass';
          }

          await usingHttpInterceptor<SchemaWithoutRequestBody>(
            {
              ...interceptorOptions,
              type,
              onUnhandledRequest: overrideDefault ? undefined : { action: 'bypass', log: true },
            },
            async (interceptor) => {
              const handler = await promiseIfRemote(
                interceptor[lowerMethod]('/users').respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
                interceptor,
              );
              expect(handler).toBeInstanceOf(Handler);

              expect(handler.requests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const response = await fetch(joinURL(baseURL, '/users'), { method });
                expect(response.status).toBe(200);

                expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
                const interceptedRequest = handler.requests[numberOfRequestsIncludingPreflight - 1];
                expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
                expect(interceptedRequest.body).toBe(null);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                await promiseIfRemote(handler.clear(), interceptor);

                const request = new Request(joinURL(baseURL, '/users'), { method });
                const responsePromise = fetch(request);
                await expectBypassedResponse(responsePromise);

                expect(handler.requests).toHaveLength(0);

                expect(spies.warn).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const warnMessage = spies.warn.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(warnMessage, { request, platform, type: 'bypass' });
              });
            },
          );
        });
      }

      if (type === 'local' && methodCanHaveRequestBody(method)) {
        it(`should show a warning when logging is enabled and ${method} requests with body are unhandled and bypassed`, async () => {
          if (overrideDefault) {
            localOnUnhandledRequest.action = 'bypass';
          }

          await usingHttpInterceptor<SchemaWithRequestBody>(
            {
              ...interceptorOptions,
              type,
              onUnhandledRequest: overrideDefault ? undefined : { action: 'bypass', log: true },
            },
            async (interceptor) => {
              const handler = await promiseIfRemote(
                interceptor[lowerMethod]('/users').respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
                interceptor,
              );
              expect(handler).toBeInstanceOf(Handler);

              expect(handler.requests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const response = await fetch(joinURL(baseURL, '/users'), {
                  method,
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ message: 'ok' }),
                });
                expect(response.status).toBe(200);

                expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
                const interceptedRequest = handler.requests[numberOfRequestsIncludingPreflight - 1];
                expectTypeOf(interceptedRequest.body).toEqualTypeOf<{ message: string }>();
                expect(interceptedRequest.body).toEqual({ message: 'ok' });

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                await promiseIfRemote(handler.clear(), interceptor);

                const request = new Request(joinURL(baseURL, '/users'), {
                  method,
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ message: 'ok' }),
                });
                const requestClone = request.clone();

                const responsePromise = fetch(request);
                await expectBypassedResponse(responsePromise);

                expect(handler.requests).toHaveLength(0);

                expect(spies.warn).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const warnMessage = spies.warn.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(warnMessage, { request: requestClone, platform, type: 'bypass' });
              });
            },
          );
        });

        it(`should show a warning when logging is enabled and ${method} requests are unhandled due to restrictions and bypassed`, async () => {
          if (overrideDefault) {
            localOnUnhandledRequest.action = 'bypass';
          }

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
                  .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
                interceptor,
              );
              expect(handler).toBeInstanceOf(Handler);

              expect(handler.requests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const response = await fetch(joinURL(baseURL, '/users'), {
                  method,
                  headers: { 'x-value': '1' },
                });
                expect(response.status).toBe(200);

                expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
                const interceptedRequest = handler.requests[numberOfRequestsIncludingPreflight - 1];
                expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
                expect(interceptedRequest.body).toBe(null);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const request = new Request(joinURL(baseURL, '/users'), { method });
                const responsePromise = fetch(request);
                await expectBypassedResponse(responsePromise);

                expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);

                expect(spies.warn).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const warnMessage = spies.warn.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(warnMessage, { request, platform, type: 'bypass' });
              });
            },
          );
        });

        it(`should show a warning when logging is enabled and ${method} requests are unhandled due to unmocked path and bypassed`, async () => {
          if (overrideDefault) {
            localOnUnhandledRequest.action = 'bypass';
          }

          await usingHttpInterceptor<SchemaWithoutRequestBody>(
            {
              ...interceptorOptions,
              type,
              onUnhandledRequest: overrideDefault ? undefined : { action: 'bypass', log: true },
            },
            async (interceptor) => {
              const handler = await promiseIfRemote(
                interceptor[lowerMethod]('/users').respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
                interceptor,
              );
              expect(handler).toBeInstanceOf(Handler);

              expect(handler.requests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const response = await fetch(joinURL(baseURL, '/users'), { method });
                expect(response.status).toBe(200);

                expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
                const interceptedRequest = handler.requests[numberOfRequestsIncludingPreflight - 1];
                expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
                expect(interceptedRequest.body).toBe(null);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const request = new Request(joinURL(baseURL, '/users/other'), { method });
                const responsePromise = fetch(request);
                await expectBypassedResponse(responsePromise);

                expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);

                expect(spies.warn).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const warnMessage = spies.warn.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(warnMessage, { request, platform, type: 'bypass' });
              });
            },
          );
        });

        it(`should show a warning when logging is enabled and ${method} requests with array search params are unhandled and bypassed`, async () => {
          if (overrideDefault) {
            localOnUnhandledRequest.action = 'bypass';
          }

          await usingHttpInterceptor<SchemaWithoutRequestBody>(
            {
              ...interceptorOptions,
              type,
              onUnhandledRequest: overrideDefault ? undefined : { action: 'bypass', log: true },
            },
            async (interceptor) => {
              const handler = await promiseIfRemote(
                interceptor[lowerMethod]('/users').respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
                interceptor,
              );
              expect(handler).toBeInstanceOf(Handler);

              expect(handler.requests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const response = await fetch(joinURL(baseURL, '/users'), { method });
                expect(response.status).toBe(200);

                expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
                const interceptedRequest = handler.requests[numberOfRequestsIncludingPreflight - 1];
                expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
                expect(interceptedRequest.body).toBe(null);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const searchParams = new HttpSearchParams({
                  singleValue: 'value',
                  arrayWithOneValue: ['value-1'],
                  arrayWithMultipleValues: ['value-1', 'value-2'],
                });

                const request = new Request(joinURL(baseURL, `/users/other?${searchParams.toString()}`), { method });
                const responsePromise = fetch(request);
                await expectBypassedResponse(responsePromise);

                expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);

                expect(spies.warn).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
                expect(spies.error).toHaveBeenCalledTimes(0);

                const warnMessage = spies.warn.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(warnMessage, { request, platform, type: 'bypass' });
              });
            },
          );
        });
      }

      it(`should show an error when logging is enabled and ${method} requests with no body are unhandled and rejected`, async () => {
        await usingHttpInterceptor<SchemaWithoutRequestBody>(
          {
            ...interceptorOptions,
            type,
            onUnhandledRequest: overrideDefault ? undefined : { action: 'reject', log: true },
          },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor[lowerMethod]('/users').respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
              interceptor,
            );
            expect(handler).toBeInstanceOf(Handler);

            expect(handler.requests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (spies) => {
              const response = await fetch(joinURL(baseURL, '/users'), { method });
              expect(response.status).toBe(200);

              expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
              const interceptedRequest = handler.requests[numberOfRequestsIncludingPreflight - 1];
              expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
              expect(interceptedRequest.body).toBe(null);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);

              await promiseIfRemote(handler.clear(), interceptor);

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

              expect(handler.requests).toHaveLength(0);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

              const errorMessage = spies.error.mock.calls[0].join(' ');
              await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });
            });
          },
        );
      });

      if (methodCanHaveRequestBody(method)) {
        it(`should show an error when logging is enabled and ${method} requests with body are unhandled and rejected`, async () => {
          await usingHttpInterceptor<SchemaWithRequestBody>(
            {
              ...interceptorOptions,
              type,
              onUnhandledRequest: overrideDefault ? undefined : { action: 'reject', log: true },
            },
            async (interceptor) => {
              const handler = await promiseIfRemote(
                interceptor[lowerMethod]('/users').respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
                interceptor,
              );
              expect(handler).toBeInstanceOf(Handler);

              expect(handler.requests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (spies) => {
                const response = await fetch(joinURL(baseURL, '/users'), {
                  method,
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ message: 'ok' }),
                });
                expect(response.status).toBe(200);

                expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
                const interceptedRequest = handler.requests[numberOfRequestsIncludingPreflight - 1];
                expectTypeOf(interceptedRequest.body).toEqualTypeOf<{ message: string }>();
                expect(interceptedRequest.body).toEqual({ message: 'ok' });

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);

                await promiseIfRemote(handler.clear(), interceptor);

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

                expect(handler.requests).toHaveLength(0);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

                const errorMessage = spies.error.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(errorMessage, { request: requestClone, platform, type: 'reject' });
              });
            },
          );
        });
      }

      it(`should show an error when logging is enabled and ${method} requests are unhandled due to restrictions and rejected`, async () => {
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
                .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
              interceptor,
            );
            expect(handler).toBeInstanceOf(Handler);

            expect(handler.requests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (spies) => {
              const searchParams = new HttpSearchParams({ value: '1' });

              const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method });
              expect(response.status).toBe(200);

              expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
              const interceptedRequest = handler.requests[numberOfRequestsIncludingPreflight - 1];
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

              expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

              const errorMessage = spies.error.mock.calls[0].join(' ');
              await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });
            });
          },
        );
      });

      it(`should show an error when logging is enabled and ${method} requests are unhandled due to unmocked path and rejected`, async () => {
        await usingHttpInterceptor<SchemaWithoutRequestBody>(
          {
            ...interceptorOptions,
            type,
            onUnhandledRequest: overrideDefault ? undefined : { action: 'reject', log: true },
          },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor[lowerMethod]('/users').respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
              interceptor,
            );
            expect(handler).toBeInstanceOf(Handler);

            expect(handler.requests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (spies) => {
              const response = await fetch(joinURL(baseURL, '/users'), { method });
              expect(response.status).toBe(200);

              expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
              const interceptedRequest = handler.requests[numberOfRequestsIncludingPreflight - 1];
              expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
              expect(interceptedRequest.body).toBe(null);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);

              const request = new Request(joinURL(baseURL, '/users/other'), {
                method,
                headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
              });
              const responsePromise = fetch(request);

              if (overridesPreflightResponse) {
                await expectPreflightResponse(responsePromise);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);
              } else {
                await expectFetchError(responsePromise);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

                const errorMessage = spies.error.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });
              }

              expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
            });
          },
        );
      });

      it(`should show an error when logging is enabled and ${method} requests with array search params are unhandled and rejected`, async () => {
        await usingHttpInterceptor<SchemaWithoutRequestBody>(
          {
            ...interceptorOptions,
            type,
            onUnhandledRequest: overrideDefault ? undefined : { action: 'reject', log: true },
          },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor[lowerMethod]('/users').respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
              interceptor,
            );
            expect(handler).toBeInstanceOf(Handler);

            expect(handler.requests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (spies) => {
              const response = await fetch(joinURL(baseURL, '/users'), { method });
              expect(response.status).toBe(200);

              expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
              const interceptedRequest = handler.requests[numberOfRequestsIncludingPreflight - 1];
              expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
              expect(interceptedRequest.body).toBe(null);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);

              const searchParams = new HttpSearchParams({
                singleValue: 'value',
                arrayWithOneValue: ['value-1'],
                arrayWithMultipleValues: ['value-1', 'value-2'],
              });

              const request = new Request(joinURL(baseURL, `/users/other?${searchParams.toString()}`), {
                method,
                headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
              });
              const responsePromise = fetch(request);

              if (overridesPreflightResponse) {
                await expectPreflightResponse(responsePromise);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(0);
              } else {
                await expectFetchError(responsePromise);

                expect(spies.warn).toHaveBeenCalledTimes(0);
                expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

                const errorMessage = spies.error.mock.calls[0].join(' ');
                await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });
              }

              expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);
            });
          },
        );
      });
    });

    describe.each([
      { overrideDefault: undefined },
      { overrideDefault: 'static' as const },
      { overrideDefault: 'factory' as const },
    ])('Logging disabled: override default $overrideDefault', ({ overrideDefault }) => {
      const localOnUnhandledRequest: UnhandledRequestStrategy.LocalDeclaration = { action: 'reject', log: false };
      const remoteOnUnhandledRequest: UnhandledRequestStrategy.RemoteDeclaration = { action: 'reject', log: false };

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
        localOnUnhandledRequest.action = 'reject';
        remoteOnUnhandledRequest.action = 'reject';
      });

      if (type === 'local') {
        it(`should not show a warning when logging is disabled and ${method} requests are unhandled and bypassed`, async () => {
          if (overrideDefault) {
            localOnUnhandledRequest.action = 'bypass';
          }

          const extendedInterceptorOptions: HttpInterceptorOptions = {
            ...interceptorOptions,
            type,
            onUnhandledRequest: overrideDefault ? undefined : { action: 'bypass', log: false },
          };

          await usingHttpInterceptor<SchemaWithoutRequestBody>(extendedInterceptorOptions, async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor[lowerMethod]('/users')
                .with({ searchParams: { value: '1' } })
                .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
              interceptor,
            );
            expect(handler).toBeInstanceOf(Handler);

            expect(handler.requests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (spies) => {
              const searchParams = new HttpSearchParams({ value: '1' });

              const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method });
              expect(response.status).toBe(200);

              expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);

              const request = new Request(joinURL(baseURL, '/users'), { method });
              const responsePromise = fetch(request);
              await expectBypassedResponse(responsePromise);

              expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);

              expect(spies.warn).toHaveBeenCalledTimes(0);
              expect(spies.error).toHaveBeenCalledTimes(0);
            });
          });
        });
      }

      it(`should not show an error when logging is disabled and ${method} requests are unhandled and rejected`, async () => {
        const extendedInterceptorOptions: HttpInterceptorOptions = {
          ...interceptorOptions,
          type,
          onUnhandledRequest: overrideDefault ? undefined : { action: 'reject', log: false },
        };

        await usingHttpInterceptor<SchemaWithoutRequestBody>(extendedInterceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users')
              .with({ searchParams: { value: '1' } })
              .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          expect(handler.requests).toHaveLength(0);

          await usingIgnoredConsole(['warn', 'error'], async (spies) => {
            const searchParams = new HttpSearchParams({ value: '1' });

            const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method });
            expect(response.status).toBe(200);

            expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);

            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(0);

            const request = new Request(joinURL(baseURL, '/users'), { method });
            const responsePromise = fetch(request);

            if (overridesPreflightResponse) {
              await expectPreflightResponse(responsePromise);
            } else {
              await expectFetchError(responsePromise);
            }

            expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);

            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(0);
          });
        });
      });
    });

    it(`should not log unhandled ${method} requests when no interceptors exist`, async () => {
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

    it(`should not log unhandled ${method} requests when no interceptor matching the base URL of the request was found`, async () => {
      const otherBaseURL = joinURL(baseURL, 'other');

      await usingHttpInterceptor<SchemaWithoutRequestBody>(
        { ...interceptorOptions, baseURL: otherBaseURL },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor[lowerMethod]('/users').respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
            interceptor,
          );
          expect(handler).toBeInstanceOf(Handler);

          expect(handler.requests).toHaveLength(0);

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

            expect(handler.requests).toHaveLength(0);

            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(0);
          });
        },
      );
    });

    it(`should not log unhandled ${method} requests when the matched interceptor is not running`, async () => {
      await usingHttpInterceptor<SchemaWithoutRequestBody>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
            .with({ searchParams: { value: '1' } })
            .respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const searchParams = new HttpSearchParams({ value: '1' });

          const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method });
          expect(response.status).toBe(200);

          expect(handler.requests).toHaveLength(numberOfRequestsIncludingPreflight);

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
          }

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

          const errorMessage = spies.error.mock.calls[0].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });

          spies.warn.mockClear();
          spies.error.mockClear();

          await interceptor.stop();

          responsePromise = fetch(request, {
            signal: overridesPreflightResponse ? undefined : AbortSignal.timeout(500),
          });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else if (type === 'local') {
            await expectBypassedResponse(responsePromise, { canBeAborted: true });
          } else {
            await expectFetchError(responsePromise, { canBeAborted: true });
          }

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);
        });
      });
    });
  });

  it('should support changing the unhandled request strategy after created', async () => {
    const initialOnUnhandledRequest: UnhandledRequestStrategy.Remote = { action: 'reject', log: false };

    await usingHttpInterceptor<SchemaWithoutRequestBody>(
      {
        ...interceptorOptions,
        type,
        onUnhandledRequest: initialOnUnhandledRequest,
      },
      async (interceptor) => {
        expect(interceptor.onUnhandledRequest).toEqual(initialOnUnhandledRequest);

        const handler = await promiseIfRemote(
          interceptor.get('/users').respond({ status: 200, headers: DEFAULT_ACCESS_CONTROL_HEADERS }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(response.status).toBe(200);

          expect(handler.requests).toHaveLength(1);
          const interceptedRequest = handler.requests[0];
          expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
          expect(interceptedRequest.body).toBe(null);

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const request = new Request(joinURL(baseURL, '/users/unknown'), {
            method: 'GET',
            headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
          });
          const responsePromise = fetch(request);

          await expectFetchError(responsePromise);

          expect(handler.requests).toHaveLength(1);

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);
        });

        const newOnUnhandledRequest: UnhandledRequestStrategy.Remote = { action: 'reject', log: true };
        expect(initialOnUnhandledRequest).not.toEqual(newOnUnhandledRequest);

        interceptor.onUnhandledRequest = newOnUnhandledRequest;
        expect(interceptor.onUnhandledRequest).toEqual(newOnUnhandledRequest);

        await usingIgnoredConsole(['warn', 'error'], async (spies) => {
          const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(response.status).toBe(200);

          expect(handler.requests).toHaveLength(2);
          const interceptedRequest = handler.requests[1];
          expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
          expect(interceptedRequest.body).toBe(null);

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(0);

          const request = new Request(joinURL(baseURL, '/users/unknown'), {
            method: 'GET',
            headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
          });
          const responsePromise = fetch(request);

          await expectFetchError(responsePromise);

          expect(handler.requests).toHaveLength(2);

          expect(spies.warn).toHaveBeenCalledTimes(0);
          expect(spies.error).toHaveBeenCalledTimes(1);

          const errorMessage = spies.error.mock.calls[0].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });
        });
      },
    );
  });
}
