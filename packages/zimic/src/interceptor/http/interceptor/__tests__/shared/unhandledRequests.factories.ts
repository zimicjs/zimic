import { beforeEach, describe, expect, it, vi } from 'vitest';

import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HTTP_METHODS, HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import { DEFAULT_UNHANDLED_REQUEST_STRATEGY } from '@/interceptor/http/interceptorWorker/constants';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/interceptor/server/constants';
import { importCrypto } from '@/utils/crypto';
import { waitForDelay } from '@/utils/time';
import { joinURL } from '@/utils/urls';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectBypassedResponse, expectPreflightResponse, expectFetchError } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions, UnhandledRequestStrategy } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions, verifyUnhandledRequestMessage } from './utils';

export async function declareUnhandledRequestFactoriesHttpInterceptorTests(
  options: RuntimeSharedHttpInterceptorTestsOptions,
) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const crypto = await importCrypto();

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  type MethodSchemaWithoutRequestBody = HttpSchema.Method<{
    request: {
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

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;
  });

  describe.each(HTTP_METHODS)('Method (%s)', (method) => {
    const { overridesPreflightResponse, numberOfRequestsIncludingPreflight } = assessPreflightInterference({
      method,
      platform,
      type,
    });

    const lowerMethod = method.toLowerCase<'POST'>();

    it(`should support a synchronous unhandled ${method} request factory`, async () => {
      const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>((request) => {
        const url = new URL(request.url);

        return {
          action: 'reject',
          log: !url.searchParams.has('name'),
        };
      });

      await usingHttpInterceptor<SchemaWithoutRequestBody>(
        { ...interceptorOptions, onUnhandledRequest },
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
            const searchParams = new HttpSearchParams<{ value: string; name?: string }>({ value: '1' });

            const response = await fetch(joinURL(baseURL, `/users?${searchParams}`), { method });
            expect(response.status).toBe(200);

            requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

            expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
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

            expect(onUnhandledRequest).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
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

            expect(onUnhandledRequest).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight * 2);
            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

            const errorMessage = spies.error.mock.calls[0].join(' ');
            await verifyUnhandledRequestMessage(errorMessage, { type: 'error', platform, request });
          });
        },
      );
    });

    it(`should support an asynchronous unhandled ${method} request factory`, async () => {
      const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(async (request) => {
        const url = new URL(request.url);

        await waitForDelay(10);

        return {
          action: 'reject',
          log: !url.searchParams.has('name'),
        };
      });

      await usingHttpInterceptor<SchemaWithoutRequestBody>(
        { ...interceptorOptions, type, onUnhandledRequest },
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
            const searchParams = new HttpSearchParams<{ value: string; name?: string }>({ value: '1' });

            const response = await fetch(joinURL(baseURL, `/users?${searchParams}`), { method });
            expect(response.status).toBe(200);

            requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

            expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
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

            expect(onUnhandledRequest).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
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

            expect(onUnhandledRequest).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight * 2);
            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

            const errorMessage = spies.error.mock.calls[0].join(' ');
            await verifyUnhandledRequestMessage(errorMessage, { type: 'error', platform, request });
          });
        },
      );
    });

    it(`should log an error if a synchronous unhandled ${method} request factory throws`, async () => {
      const error = new Error('Unhandled request.');

      const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>((request) => {
        const url = new URL(request.url);

        if (!url.searchParams.has('name')) {
          throw error;
        }

        return { action: 'reject', log: false };
      });

      await usingHttpInterceptor<SchemaWithoutRequestBody>(
        { ...interceptorOptions, type, onUnhandledRequest },
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
            const searchParams = new HttpSearchParams<{ value: string; name?: string }>({ value: '1' });

            const response = await fetch(joinURL(baseURL, `/users?${searchParams}`), { method });
            expect(response.status).toBe(200);

            requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

            expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
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

            expect(onUnhandledRequest).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
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

            expect(onUnhandledRequest).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight * 2);

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
        },
      );
    });

    it(`should log an error if an asynchronous unhandled ${method} request factory throws`, async () => {
      const error = new Error('Unhandled request.');

      const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(async (request) => {
        const url = new URL(request.url);

        await waitForDelay(10);

        if (!url.searchParams.has('name')) {
          throw error;
        }

        return { action: 'reject', log: false };
      });

      await usingHttpInterceptor<SchemaWithoutRequestBody>(
        { ...interceptorOptions, type, onUnhandledRequest },
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
            const searchParams = new HttpSearchParams<{
              value: string;
              name?: string;
            }>({ value: '1' });

            const response = await fetch(joinURL(baseURL, `/users?${searchParams}`), { method });
            expect(response.status).toBe(200);

            requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

            expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
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

            expect(onUnhandledRequest).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
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

            expect(onUnhandledRequest).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight * 2);

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
        },
      );
    });
  });
}
