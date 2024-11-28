import { beforeEach, describe, expect, it } from 'vitest';

import { HttpSearchParams } from '@/http';
import { HTTP_METHODS, HttpSchema } from '@/http/types/schema';
import { httpInterceptor } from '@/interceptor/http';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/interceptor/server/constants';
import { importCrypto } from '@/utils/crypto';
import { joinURL } from '@/utils/urls';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectBypassedResponse, expectPreflightResponse, expectFetchError } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import {
  RuntimeSharedHttpInterceptorTestsOptions,
  verifyUnhandledRequestMessage,
  verifyUnhandledRequest,
} from './utils';

export async function declareUnhandledRequestGlobalLoggingHttpInterceptorTests(
  options: RuntimeSharedHttpInterceptorTestsOptions,
) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const crypto = await importCrypto();

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  type MethodSchemaWithoutRequestBody = HttpSchema.Method<{
    request: { searchParams: { value: string } };
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

    verifyUnhandledRequest.mockClear();

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

    it(`should not log unhandled ${method} requests when no interceptor was matched`, async () => {
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
      await usingHttpInterceptor<SchemaWithoutRequestBody>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
            .with({
              searchParams: { value: '1' },
            })
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
            headers: { 'x-id': crypto.randomUUID() },
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
      });
    });
  });
}
