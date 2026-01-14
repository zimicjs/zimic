import { expectFetchError } from '@zimic/utils/fetch';
import { joinURL, UnsupportedURLProtocolError } from '@zimic/utils/url';
import { beforeEach, expect, expectTypeOf, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { expectBypassedResponse } from '@tests/utils/fetch';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import RunningHttpInterceptorError from '../../errors/RunningHttpInterceptorError';
import { SUPPORTED_BASE_URL_PROTOCOLS } from '../../HttpInterceptorClient';
import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareBaseURLHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

  let defaultBaseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  beforeEach(() => {
    defaultBaseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should handle base URLs and paths correctly', async () => {
    for (const { baseURL, path } of [
      { baseURL: defaultBaseURL.toString().replace(/\/$/, ''), path: 'path' },
      { baseURL: defaultBaseURL.toString(), path: 'path' },
      { baseURL: defaultBaseURL.toString().replace(/\/$/, ''), path: '/path' },
      { baseURL: defaultBaseURL.toString(), path: '/path' },
    ]) {
      await usingHttpInterceptor<{
        ':any': {
          GET: {
            response: {
              200: {};
            };
          };
        };
      }>({ ...interceptorOptions, baseURL }, async (interceptor) => {
        expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));

        const handler = await promiseIfRemote(interceptor.get(path).respond({ status: 200 }), interceptor);

        expect(handler.requests).toHaveLength(0);

        const url = joinURL(baseURL, path);

        const response = await fetch(url, { method: 'GET' });
        expect(response.status).toBe(200);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;
        expect(request).toBeInstanceOf(Request);

        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        expectTypeOf(request.response.status).toEqualTypeOf<200>();
        expect(request.response.status).toBe(200);

        expectTypeOf(request.response.body).toEqualTypeOf<null>();
        expect(request.response.body).toBe(null);
      });
    }
  });

  it('should support changing the base URL after created', async () => {
    const baseURL = defaultBaseURL.toString();

    await usingHttpInterceptor<{
      '/': {
        GET: {
          response: {
            200: {};
          };
        };
      };
    }>({ ...interceptorOptions, baseURL }, async (interceptor) => {
      expect(interceptor.baseURL).toBe(baseURL.toString().replace(/\/$/, ''));

      let handler = await promiseIfRemote(interceptor.get('/').respond({ status: 200 }), interceptor);

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(baseURL, { method: 'GET' });
      expect(response.status).toBe(200);

      expect(handler.requests).toHaveLength(1);

      const newBaseURL = joinURL(baseURL, 'new');
      expect(newBaseURL).not.toBe(interceptor.baseURL);

      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);

      interceptor.baseURL = newBaseURL;
      expect(interceptor.baseURL).toBe(newBaseURL.replace(/\/$/, ''));

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);

      handler = await promiseIfRemote(interceptor.get('/').respond({ status: 200 }), interceptor);

      expect(handler.requests).toHaveLength(0);

      const responsePromise = fetch(baseURL, { method: 'GET' });

      if (type === 'local') {
        await expectBypassedResponse(responsePromise);
      } else {
        await expectFetchError(responsePromise);
      }

      expect(handler.requests).toHaveLength(0);

      response = await fetch(newBaseURL, { method: 'GET' });
      expect(response.status).toBe(200);

      expect(handler.requests).toHaveLength(1);
    });
  });

  it('should not support changing the base URL if the interceptor is running', async () => {
    const baseURL = defaultBaseURL.toString();

    await usingHttpInterceptor<{
      '/': {
        GET: {
          response: {
            200: {};
          };
        };
      };
    }>({ ...interceptorOptions, baseURL }, async (interceptor) => {
      expect(interceptor.baseURL).toBe(baseURL.toString().replace(/\/$/, ''));

      let handler = await promiseIfRemote(interceptor.get('/').respond({ status: 200 }), interceptor);

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(baseURL, { method: 'GET' });
      expect(response.status).toBe(200);

      expect(handler.requests).toHaveLength(1);

      const newBaseURL = joinURL(baseURL, 'new');
      expect(newBaseURL).not.toBe(interceptor.baseURL);

      expect(interceptor.isRunning).toBe(true);

      expect(() => {
        interceptor.baseURL = newBaseURL;
      }).toThrowError(
        new RunningHttpInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));

      handler = await promiseIfRemote(interceptor.get('/').respond({ status: 200 }), interceptor);

      expect(handler.requests).toHaveLength(0);

      await expectFetchError(fetch(newBaseURL, { method: 'GET' }));

      expect(handler.requests).toHaveLength(0);

      response = await fetch(baseURL, { method: 'GET' });
      expect(response.status).toBe(200);

      expect(handler.requests).toHaveLength(1);
    });
  });

  it('should throw an error if provided an invalid base URL', async () => {
    const handler = vi.fn();

    const invalidURL = 'invalid';

    await expect(async () => {
      await usingHttpInterceptor({ ...interceptorOptions, baseURL: invalidURL }, handler);
    }).rejects.toThrowError(/Invalid URL/);

    expect(handler).not.toHaveBeenCalled();
  });

  if (type === 'local') {
    it.each(SUPPORTED_BASE_URL_PROTOCOLS)(
      'should not throw an error if provided a supported base URL protocol (%s)',
      async (supportedProtocol) => {
        const url = `${supportedProtocol}://localhost:3000`;
        const handler = vi.fn();

        const interceptorPromise = usingHttpInterceptor({ ...interceptorOptions, baseURL: url }, handler);
        await expect(interceptorPromise).resolves.not.toThrowError();

        expect(handler).toHaveBeenCalledTimes(1);
      },
    );

    const exampleUnsupportedProtocols = ['ws', 'wss', 'ftp'];

    it.each(exampleUnsupportedProtocols)(
      'should throw an error if provided an unsupported base URL protocol (%s)',
      async (unsupportedProtocol) => {
        expect(SUPPORTED_BASE_URL_PROTOCOLS).not.toContain(unsupportedProtocol);

        const url = `${unsupportedProtocol}://localhost:3000`;
        const handler = vi.fn();

        const interceptorPromise = usingHttpInterceptor({ ...interceptorOptions, baseURL: url }, handler);
        await expect(interceptorPromise).rejects.toThrowError(
          new UnsupportedURLProtocolError(unsupportedProtocol, SUPPORTED_BASE_URL_PROTOCOLS),
        );

        expect(handler).not.toHaveBeenCalled();
      },
    );
  }
}
