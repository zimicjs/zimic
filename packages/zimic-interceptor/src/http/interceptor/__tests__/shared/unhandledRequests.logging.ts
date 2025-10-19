import { HttpSearchParams, HttpSchema } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectBypassedResponse } from '@tests/utils/fetch';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions, UnhandledRequestStrategy } from '../../types/options';
import {
  RuntimeSharedHttpInterceptorTestsOptions,
  verifyUnhandledRequest,
  verifyUnhandledRequestMessage,
} from './utils';

export function declareUnhandledRequestLoggingHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  type MethodSchemaWithoutRequestBody = HttpSchema.Method<{
    request: {
      headers: { 'x-value'?: string };
      searchParams: { value?: string; name?: string };
    };
    response: { 204: {} };
  }>;

  type SchemaWithoutRequestBody = HttpSchema<{
    '/users': { GET: MethodSchemaWithoutRequestBody };
  }>;

  type MethodSchemaWithRequestBody = HttpSchema.Method<{
    request: {
      headers: { 'x-value'?: string };
      searchParams: { value?: string; name?: string };
      body: { message: string };
    };
    response: { 204: {} };
  }>;

  type SchemaWithRequestBody = HttpSchema<{
    '/users': { POST: MethodSchemaWithRequestBody };
  }>;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  describe.each([
    { declarationType: 'undefined' as const, log: undefined },
    { declarationType: 'static' as const, log: undefined },
    { declarationType: 'static' as const, log: true },
    { declarationType: 'factory' as const, log: undefined },
    { declarationType: 'factory' as const, log: true },
  ])('Logging enabled (declaration type: $declarationType)', ({ declarationType, log }) => {
    const onUnhandledRequest: {
      bypass?: UnhandledRequestStrategy.Local;
      reject?: UnhandledRequestStrategy.Remote;
    } = {
      bypass:
        declarationType === 'static' || declarationType === 'undefined'
          ? { action: 'bypass', log }
          : (request) => {
              verifyUnhandledRequest(request);
              return { action: 'bypass', log };
            },

      reject:
        declarationType === 'undefined'
          ? undefined
          : declarationType === 'static'
            ? { action: 'reject', log }
            : (request) => {
                verifyUnhandledRequest(request);
                return { action: 'reject', log };
              },
    };

    if (type === 'local') {
      it('should show a warning when logging is enabled and requests with no body are unhandled and bypassed', async () => {
        await usingHttpInterceptor<SchemaWithoutRequestBody>(
          { ...interceptorOptions, type, onUnhandledRequest: onUnhandledRequest.bypass },
          async (interceptor) => {
            expect(interceptor.onUnhandledRequest).toBe(onUnhandledRequest.bypass);

            const handler = interceptor.get('/users').respond({ status: 204 });

            expect(handler.requests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (console) => {
              const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
              expect(response.status).toBe(204);

              expect(handler.requests).toHaveLength(1);
              const interceptedRequest = handler.requests[0];
              expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
              expect(interceptedRequest.body).toBe(null);

              expect(console.warn).toHaveBeenCalledTimes(0);
              expect(console.error).toHaveBeenCalledTimes(0);

              handler.clear();

              const request = new Request(joinURL(baseURL, '/users'), { method: 'GET' });
              const responsePromise = fetch(request);
              await expectBypassedResponse(responsePromise);

              expect(handler.requests).toHaveLength(0);

              expect(console.warn).toHaveBeenCalledTimes(1);
              expect(console.error).toHaveBeenCalledTimes(0);

              const warnMessage = console.warn.mock.calls[0].join(' ');
              await verifyUnhandledRequestMessage(warnMessage, { request, platform, type: 'bypass' });
            });
          },
        );
      });
    }

    if (type === 'local') {
      it('should show a warning when logging is enabled and requests with body are unhandled and bypassed', async () => {
        await usingHttpInterceptor<SchemaWithRequestBody>(
          { ...interceptorOptions, type, onUnhandledRequest: onUnhandledRequest.bypass },
          async (interceptor) => {
            expect(interceptor.onUnhandledRequest).toBe(onUnhandledRequest.bypass);

            const handler = interceptor.post('/users').respond({ status: 204 });

            expect(handler.requests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (console) => {
              const response = await fetch(joinURL(baseURL, '/users'), {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ message: 'ok' }),
              });
              expect(response.status).toBe(204);

              expect(handler.requests).toHaveLength(1);
              const interceptedRequest = handler.requests[0];
              expectTypeOf(interceptedRequest.body).toEqualTypeOf<{ message: string }>();
              expect(interceptedRequest.body).toEqual({ message: 'ok' });

              expect(console.warn).toHaveBeenCalledTimes(0);
              expect(console.error).toHaveBeenCalledTimes(0);

              handler.clear();

              const request = new Request(joinURL(baseURL, '/users'), {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ message: 'ok' }),
              });
              const requestClone = request.clone();

              const responsePromise = fetch(request);
              await expectBypassedResponse(responsePromise);

              expect(handler.requests).toHaveLength(0);

              expect(console.warn).toHaveBeenCalledTimes(1);
              expect(console.error).toHaveBeenCalledTimes(0);

              const warnMessage = console.warn.mock.calls[0].join(' ');
              await verifyUnhandledRequestMessage(warnMessage, { request: requestClone, platform, type: 'bypass' });
            });
          },
        );
      });

      it('should show a warning when logging is enabled and requests are unhandled due to restrictions and bypassed', async () => {
        await usingHttpInterceptor<SchemaWithoutRequestBody>(
          { ...interceptorOptions, type, onUnhandledRequest: onUnhandledRequest.bypass },
          async (interceptor) => {
            expect(interceptor.onUnhandledRequest).toBe(onUnhandledRequest.bypass);

            const handler = interceptor
              .get('/users')
              .with({ headers: { 'x-value': '1' } })
              .respond({ status: 204 });

            expect(handler.requests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (console) => {
              const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET', headers: { 'x-value': '1' } });
              expect(response.status).toBe(204);

              expect(handler.requests).toHaveLength(1);
              const interceptedRequest = handler.requests[0];
              expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
              expect(interceptedRequest.body).toBe(null);

              expect(console.warn).toHaveBeenCalledTimes(0);
              expect(console.error).toHaveBeenCalledTimes(0);

              const request = new Request(joinURL(baseURL, '/users'), { method: 'GET' });
              const responsePromise = fetch(request);
              await expectBypassedResponse(responsePromise);

              expect(handler.requests).toHaveLength(1);

              expect(console.warn).toHaveBeenCalledTimes(1);
              expect(console.error).toHaveBeenCalledTimes(0);

              const warnMessage = console.warn.mock.calls[0].join(' ');
              await verifyUnhandledRequestMessage(warnMessage, { request, platform, type: 'bypass' });
            });
          },
        );
      });

      it('should show a warning when logging is enabled and requests are unhandled due to unmocked path and bypassed', async () => {
        await usingHttpInterceptor<SchemaWithoutRequestBody>(
          { ...interceptorOptions, type, onUnhandledRequest: onUnhandledRequest.bypass },
          async (interceptor) => {
            expect(interceptor.onUnhandledRequest).toBe(onUnhandledRequest.bypass);

            const handler = interceptor.get('/users').respond({ status: 204 });

            expect(handler.requests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (console) => {
              const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
              expect(response.status).toBe(204);

              expect(handler.requests).toHaveLength(1);
              const interceptedRequest = handler.requests[0];
              expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
              expect(interceptedRequest.body).toBe(null);

              expect(console.warn).toHaveBeenCalledTimes(0);
              expect(console.error).toHaveBeenCalledTimes(0);

              const request = new Request(joinURL(baseURL, '/users/other'), { method: 'GET' });
              const responsePromise = fetch(request);
              await expectBypassedResponse(responsePromise);

              expect(handler.requests).toHaveLength(1);

              expect(console.warn).toHaveBeenCalledTimes(1);
              expect(console.error).toHaveBeenCalledTimes(0);

              const warnMessage = console.warn.mock.calls[0].join(' ');
              await verifyUnhandledRequestMessage(warnMessage, { request, platform, type: 'bypass' });
            });
          },
        );
      });

      it('should show a warning when logging is enabled and requests with array search params are unhandled and bypassed', async () => {
        await usingHttpInterceptor<SchemaWithoutRequestBody>(
          { ...interceptorOptions, type, onUnhandledRequest: onUnhandledRequest.bypass },
          async (interceptor) => {
            expect(interceptor.onUnhandledRequest).toBe(onUnhandledRequest.bypass);

            const handler = interceptor.get('/users').respond({ status: 204 });

            expect(handler.requests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (console) => {
              const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
              expect(response.status).toBe(204);

              expect(handler.requests).toHaveLength(1);
              const interceptedRequest = handler.requests[0];
              expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
              expect(interceptedRequest.body).toBe(null);

              expect(console.warn).toHaveBeenCalledTimes(0);
              expect(console.error).toHaveBeenCalledTimes(0);

              const searchParams = new HttpSearchParams({
                singleValue: 'value',
                arrayWithOneValue: ['value-1'],
                arrayWithMultipleValues: ['value-1', 'value-2'],
              });

              const request = new Request(joinURL(baseURL, `/users/other?${searchParams.toString()}`), {
                method: 'GET',
              });
              const responsePromise = fetch(request);
              await expectBypassedResponse(responsePromise);

              expect(handler.requests).toHaveLength(1);

              expect(console.warn).toHaveBeenCalledTimes(1);
              expect(console.error).toHaveBeenCalledTimes(0);

              const warnMessage = console.warn.mock.calls[0].join(' ');
              await verifyUnhandledRequestMessage(warnMessage, { request, platform, type: 'bypass' });
            });
          },
        );
      });
    }

    it('should show an error when logging is enabled and requests with no body are unhandled and rejected', async () => {
      await usingHttpInterceptor<SchemaWithoutRequestBody>(
        { ...interceptorOptions, type, onUnhandledRequest: onUnhandledRequest.reject },
        async (interceptor) => {
          expect(interceptor.onUnhandledRequest).toBe(onUnhandledRequest.reject);

          const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);

          expect(handler.requests).toHaveLength(0);

          await usingIgnoredConsole(['warn', 'error'], async (console) => {
            const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
            expect(response.status).toBe(204);

            expect(handler.requests).toHaveLength(1);
            const interceptedRequest = handler.requests[0];
            expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
            expect(interceptedRequest.body).toBe(null);

            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(0);

            await promiseIfRemote(handler.clear(), interceptor);

            const request = new Request(joinURL(baseURL, '/users'), { method: 'GET' });
            const responsePromise = fetch(request);
            await expectFetchError(responsePromise);

            expect(handler.requests).toHaveLength(0);

            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(1);

            const errorMessage = console.error.mock.calls[0].join(' ');
            await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });
          });
        },
      );
    });

    it('should show an error when logging is enabled and requests with body are unhandled and rejected', async () => {
      await usingHttpInterceptor<SchemaWithRequestBody>(
        { ...interceptorOptions, type, onUnhandledRequest: onUnhandledRequest.reject },
        async (interceptor) => {
          expect(interceptor.onUnhandledRequest).toBe(onUnhandledRequest.reject);

          const handler = await promiseIfRemote(interceptor.post('/users').respond({ status: 204 }), interceptor);

          expect(handler.requests).toHaveLength(0);

          await usingIgnoredConsole(['warn', 'error'], async (console) => {
            const response = await fetch(joinURL(baseURL, '/users'), {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ message: 'ok' }),
            });
            expect(response.status).toBe(204);

            expect(handler.requests).toHaveLength(1);
            const interceptedRequest = handler.requests[0];
            expectTypeOf(interceptedRequest.body).toEqualTypeOf<{ message: string }>();
            expect(interceptedRequest.body).toEqual({ message: 'ok' });

            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(0);

            await promiseIfRemote(handler.clear(), interceptor);

            const request = new Request(joinURL(baseURL, '/users'), {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ message: 'ok' }),
            });
            const requestClone = request.clone();

            const responsePromise = fetch(request);
            await expectFetchError(responsePromise);

            expect(handler.requests).toHaveLength(0);

            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(1);

            const errorMessage = console.error.mock.calls[0].join(' ');
            await verifyUnhandledRequestMessage(errorMessage, { request: requestClone, platform, type: 'reject' });
          });
        },
      );
    });

    it('should show an error when logging is enabled and requests are unhandled due to restrictions and rejected', async () => {
      await usingHttpInterceptor<SchemaWithoutRequestBody>(
        { ...interceptorOptions, type, onUnhandledRequest: onUnhandledRequest.reject },
        async (interceptor) => {
          expect(interceptor.onUnhandledRequest).toBe(onUnhandledRequest.reject);

          const handler = await promiseIfRemote(
            interceptor
              .get('/users')
              .with({ searchParams: { value: '1' } })
              .respond({ status: 204 }),
            interceptor,
          );

          expect(handler.requests).toHaveLength(0);

          await usingIgnoredConsole(['warn', 'error'], async (console) => {
            const searchParams = new HttpSearchParams({ value: '1' });

            const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
            expect(response.status).toBe(204);

            expect(handler.requests).toHaveLength(1);
            const interceptedRequest = handler.requests[0];
            expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
            expect(interceptedRequest.body).toBe(null);

            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(0);

            const request = new Request(joinURL(baseURL, '/users'), { method: 'GET' });
            const responsePromise = fetch(request);
            await expectFetchError(responsePromise);

            expect(handler.requests).toHaveLength(1);

            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(1);

            const errorMessage = console.error.mock.calls[0].join(' ');
            await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });
          });
        },
      );
    });

    it('should show an error when logging is enabled and requests are unhandled due to unmocked path and rejected', async () => {
      await usingHttpInterceptor<SchemaWithoutRequestBody>(
        { ...interceptorOptions, type, onUnhandledRequest: onUnhandledRequest.reject },
        async (interceptor) => {
          expect(interceptor.onUnhandledRequest).toBe(onUnhandledRequest.reject);

          const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);

          expect(handler.requests).toHaveLength(0);

          await usingIgnoredConsole(['warn', 'error'], async (console) => {
            const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
            expect(response.status).toBe(204);

            expect(handler.requests).toHaveLength(1);
            const interceptedRequest = handler.requests[0];
            expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
            expect(interceptedRequest.body).toBe(null);

            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(0);

            const request = new Request(joinURL(baseURL, '/users/other'), { method: 'GET' });
            const responsePromise = fetch(request);

            await expectFetchError(responsePromise);

            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(1);

            const errorMessage = console.error.mock.calls[0].join(' ');
            await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });

            expect(handler.requests).toHaveLength(1);
          });
        },
      );
    });

    it('should show an error when logging is enabled and requests with array search params are unhandled and rejected', async () => {
      await usingHttpInterceptor<SchemaWithoutRequestBody>(
        { ...interceptorOptions, type, onUnhandledRequest: onUnhandledRequest.reject },
        async (interceptor) => {
          expect(interceptor.onUnhandledRequest).toBe(onUnhandledRequest.reject);

          const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);

          expect(handler.requests).toHaveLength(0);

          await usingIgnoredConsole(['warn', 'error'], async (console) => {
            const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
            expect(response.status).toBe(204);

            expect(handler.requests).toHaveLength(1);
            const interceptedRequest = handler.requests[0];
            expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
            expect(interceptedRequest.body).toBe(null);

            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(0);

            const searchParams = new HttpSearchParams({
              singleValue: 'value',
              arrayWithOneValue: ['value-1'],
              arrayWithMultipleValues: ['value-1', 'value-2'],
            });

            const request = new Request(joinURL(baseURL, `/users/other?${searchParams.toString()}`), { method: 'GET' });
            const responsePromise = fetch(request);

            await expectFetchError(responsePromise);

            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(1);

            const errorMessage = console.error.mock.calls[0].join(' ');
            await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });

            expect(handler.requests).toHaveLength(1);
          });
        },
      );
    });
  });

  describe.each([{ declarationType: 'static' as const }, { declarationType: 'factory' as const }])(
    'Logging disabled',
    ({ declarationType }) => {
      const log = false;

      const onUnhandledRequest: {
        bypass: UnhandledRequestStrategy.Local;
        reject: UnhandledRequestStrategy.Remote;
      } = {
        bypass:
          declarationType === 'static'
            ? { action: 'bypass', log }
            : (request) => {
                verifyUnhandledRequest(request);
                return { action: 'bypass', log };
              },

        reject:
          declarationType === 'static'
            ? { action: 'reject', log }
            : (request) => {
                verifyUnhandledRequest(request);
                return { action: 'reject', log };
              },
      };

      if (type === 'local') {
        it('should not show a warning when logging is disabled and requests are unhandled and bypassed', async () => {
          await usingHttpInterceptor<SchemaWithoutRequestBody>(
            { ...interceptorOptions, type, onUnhandledRequest: onUnhandledRequest.bypass },
            async (interceptor) => {
              expect(interceptor.onUnhandledRequest).toBe(onUnhandledRequest.bypass);

              const handler = interceptor
                .get('/users')
                .with({ searchParams: { value: '1' } })
                .respond({ status: 204 });

              expect(handler.requests).toHaveLength(0);

              await usingIgnoredConsole(['warn', 'error'], async (console) => {
                const searchParams = new HttpSearchParams({ value: '1' });

                const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
                expect(response.status).toBe(204);

                expect(handler.requests).toHaveLength(1);

                expect(console.warn).toHaveBeenCalledTimes(0);
                expect(console.error).toHaveBeenCalledTimes(0);

                const request = new Request(joinURL(baseURL, '/users'), { method: 'GET' });
                const responsePromise = fetch(request);
                await expectBypassedResponse(responsePromise);

                expect(handler.requests).toHaveLength(1);

                expect(console.warn).toHaveBeenCalledTimes(0);
                expect(console.error).toHaveBeenCalledTimes(0);
              });
            },
          );
        });
      }

      it('should not show an error when logging is disabled and requests are unhandled and rejected', async () => {
        await usingHttpInterceptor<SchemaWithoutRequestBody>(
          { ...interceptorOptions, type, onUnhandledRequest: onUnhandledRequest.reject },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor
                .get('/users')
                .with({ searchParams: { value: '1' } })
                .respond({ status: 204 }),
              interceptor,
            );

            expect(handler.requests).toHaveLength(0);

            await usingIgnoredConsole(['warn', 'error'], async (console) => {
              const searchParams = new HttpSearchParams({ value: '1' });

              const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
              expect(response.status).toBe(204);

              expect(handler.requests).toHaveLength(1);

              expect(console.warn).toHaveBeenCalledTimes(0);
              expect(console.error).toHaveBeenCalledTimes(0);

              const request = new Request(joinURL(baseURL, '/users'), { method: 'GET' });
              const responsePromise = fetch(request);
              await expectFetchError(responsePromise);

              expect(handler.requests).toHaveLength(1);

              expect(console.warn).toHaveBeenCalledTimes(0);
              expect(console.error).toHaveBeenCalledTimes(0);
            });
          },
        );
      });
    },
  );

  it('should not log unhandled requests when no interceptors exist', async () => {
    await usingIgnoredConsole(['warn', 'error'], async (console) => {
      expect(console.warn).toHaveBeenCalledTimes(0);
      expect(console.error).toHaveBeenCalledTimes(0);

      const request = new Request(joinURL(baseURL, '/users'), { method: 'GET' });

      const responsePromise = fetch(request, {
        signal: AbortSignal.timeout(500),
      });

      if (type === 'local') {
        await expectBypassedResponse(responsePromise, { canBeAborted: true });
      } else {
        await expectFetchError(responsePromise, { canBeAborted: true });
      }

      expect(console.warn).toHaveBeenCalledTimes(0);
      expect(console.error).toHaveBeenCalledTimes(0);
    });
  });

  it('should not log unhandled requests when no interceptor matching the base URL of the request was found', async () => {
    const otherBaseURL = joinURL(baseURL, 'other');

    await usingHttpInterceptor<SchemaWithoutRequestBody>(
      { ...interceptorOptions, baseURL: otherBaseURL, onUnhandledRequest: { action: 'reject', log: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);

        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (console) => {
          const request = new Request(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(request.url.startsWith(otherBaseURL)).toBe(false);

          const responsePromise = fetch(request);

          if (type === 'local') {
            await expectBypassedResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          expect(handler.requests).toHaveLength(0);

          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(0);
        });
      },
    );
  });

  it('should not log unhandled requests when the matched interceptor is not running', async () => {
    await usingHttpInterceptor<SchemaWithoutRequestBody>(
      { ...interceptorOptions, onUnhandledRequest: { action: 'reject', log: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with({ searchParams: { value: '1' } })
            .respond({ status: 204 }),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (console) => {
          const searchParams = new HttpSearchParams({ value: '1' });

          const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
          expect(response.status).toBe(204);

          expect(handler.requests).toHaveLength(1);

          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(0);

          const request = new Request(joinURL(baseURL, '/users'), { method: 'GET' });
          let responsePromise = fetch(request);
          await expectFetchError(responsePromise);

          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(1);

          const errorMessage = console.error.mock.calls[0].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });

          console.warn.mockClear();
          console.error.mockClear();

          await interceptor.stop();

          responsePromise = fetch(request, { signal: AbortSignal.timeout(500) });

          if (type === 'local') {
            await expectBypassedResponse(responsePromise, { canBeAborted: true });
          } else {
            await expectFetchError(responsePromise, { canBeAborted: true });
          }

          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(0);
        });
      },
    );
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

        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);

        expect(handler.requests).toHaveLength(0);

        await usingIgnoredConsole(['warn', 'error'], async (console) => {
          const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(response.status).toBe(204);

          expect(handler.requests).toHaveLength(1);
          const interceptedRequest = handler.requests[0];
          expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
          expect(interceptedRequest.body).toBe(null);

          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(0);

          const request = new Request(joinURL(baseURL, '/users/unknown'), { method: 'GET' });
          const responsePromise = fetch(request);

          await expectFetchError(responsePromise);

          expect(handler.requests).toHaveLength(1);

          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(0);
        });

        const newOnUnhandledRequest: UnhandledRequestStrategy.Remote = { action: 'reject', log: true };
        expect(initialOnUnhandledRequest).not.toEqual(newOnUnhandledRequest);

        interceptor.onUnhandledRequest = newOnUnhandledRequest;
        expect(interceptor.onUnhandledRequest).toEqual(newOnUnhandledRequest);

        await usingIgnoredConsole(['warn', 'error'], async (console) => {
          const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(response.status).toBe(204);

          expect(handler.requests).toHaveLength(2);
          const interceptedRequest = handler.requests[1];
          expectTypeOf(interceptedRequest.body).toEqualTypeOf<null>();
          expect(interceptedRequest.body).toBe(null);

          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(0);

          const request = new Request(joinURL(baseURL, '/users/unknown'), { method: 'GET' });
          const responsePromise = fetch(request);

          await expectFetchError(responsePromise);

          expect(handler.requests).toHaveLength(2);

          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(1);

          const errorMessage = console.error.mock.calls[0].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });
        });
      },
    );
  });
}
