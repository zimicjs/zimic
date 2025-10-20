import { HttpSearchParams, HttpSchema } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import waitForDelay from '@zimic/utils/time/waitForDelay';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, expect, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions, UnhandledRequestStrategy } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions, verifyUnhandledRequestMessage } from './utils';

export function declareUnhandledRequestFactoriesHttpInterceptorTests(
  options: RuntimeSharedHttpInterceptorTestsOptions,
) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  type Schema = HttpSchema<{
    '/users': {
      GET: {
        request: { searchParams: { value?: string; name?: string } };
        response: { 204: {} };
      };
    };
  }>;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should support a synchronous unhandled request factory', async () => {
    const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>((request) => {
      const url = new URL(request.url);

      return {
        action: 'reject',
        log: !url.searchParams.has('name'),
      };
    });

    await usingHttpInterceptor<Schema>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor
          .get('/users')
          .with({ searchParams: { value: '1' } })
          .respond({ status: 204 }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      await usingIgnoredConsole(['warn', 'error'], async (console) => {
        const searchParams = new HttpSearchParams<{ value: string; name?: string }>({ value: '1' });

        const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);

        expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(0);

        searchParams.set('value', '2');
        searchParams.set('name', 'User 1');

        let responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);

        expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(0);

        const request = new Request(joinURL(baseURL, '/users'), { method: 'GET' });
        responsePromise = fetch(request);
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);

        expect(onUnhandledRequest).toHaveBeenCalledTimes(2);
        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(1);

        const errorMessage = console.error.mock.calls[0].join(' ');
        await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });
      });
    });
  });

  it('should support an asynchronous unhandled request factory', async () => {
    const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(async (request) => {
      const url = new URL(request.url);

      await waitForDelay(100);

      return {
        action: 'reject',
        log: !url.searchParams.has('name'),
      };
    });

    await usingHttpInterceptor<Schema>({ ...interceptorOptions, type, onUnhandledRequest }, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor
          .get('/users')
          .with({ searchParams: { value: '1' } })
          .respond({ status: 204 }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      await usingIgnoredConsole(['warn', 'error'], async (console) => {
        const searchParams = new HttpSearchParams<{ value: string; name?: string }>({ value: '1' });

        const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);

        expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(0);

        searchParams.set('value', '2');
        searchParams.set('name', 'User 1');

        let responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);

        expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(0);

        const request = new Request(joinURL(baseURL, '/users'), { method: 'GET' });
        responsePromise = fetch(request);
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);

        expect(onUnhandledRequest).toHaveBeenCalledTimes(2);
        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(1);

        const errorMessage = console.error.mock.calls[0].join(' ');
        await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });
      });
    });
  });

  it('should log an error if a synchronous unhandled request factory throws', async () => {
    const error = new Error('Unhandled request.');

    const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>((request) => {
      const url = new URL(request.url);

      if (!url.searchParams.has('name')) {
        throw error;
      }

      return { action: 'reject', log: false };
    });

    await usingHttpInterceptor<Schema>({ ...interceptorOptions, type, onUnhandledRequest }, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor
          .get('/users')
          .with({ searchParams: { value: '1' } })
          .respond({ status: 204 }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      await usingIgnoredConsole(['warn', 'error'], async (console) => {
        const searchParams = new HttpSearchParams<{ value: string; name?: string }>({ value: '1' });

        const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);

        expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(0);

        searchParams.set('value', '2');
        searchParams.set('name', 'User 1');

        let responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);

        expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(0);

        const request = new Request(joinURL(baseURL, '/users'), { method: 'GET' });
        responsePromise = fetch(request);
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);

        expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(2);

        expect(console.error).toHaveBeenNthCalledWith(1, error);

        await verifyUnhandledRequestMessage(console.error.mock.calls[1].join(' '), {
          request,
          platform,
          type: 'reject',
        });
      });
    });
  });

  it('should log an error if an asynchronous unhandled request factory throws', async () => {
    const error = new Error('Unhandled request.');

    const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(async (request) => {
      const url = new URL(request.url);

      await waitForDelay(10);

      if (!url.searchParams.has('name')) {
        throw error;
      }

      return { action: 'reject', log: false };
    });

    await usingHttpInterceptor<Schema>({ ...interceptorOptions, type, onUnhandledRequest }, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor
          .get('/users')
          .with({ searchParams: { value: '1' } })
          .respond({ status: 204 }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      await usingIgnoredConsole(['warn', 'error'], async (console) => {
        const searchParams = new HttpSearchParams<{
          value: string;
          name?: string;
        }>({ value: '1' });

        const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);

        expect(onUnhandledRequest).toHaveBeenCalledTimes(0);
        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(0);

        searchParams.set('value', '2');
        searchParams.set('name', 'User 1');

        let responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);

        expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(0);

        const request = new Request(joinURL(baseURL, '/users'), { method: 'GET' });
        responsePromise = fetch(request);
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);

        expect(onUnhandledRequest).toHaveBeenCalledTimes(2);

        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(2);

        expect(console.error).toHaveBeenNthCalledWith(1, error);

        await verifyUnhandledRequestMessage(console.error.mock.calls[1].join(' '), {
          request,
          platform,
          type: 'reject',
        });
      });
    });
  });
}
