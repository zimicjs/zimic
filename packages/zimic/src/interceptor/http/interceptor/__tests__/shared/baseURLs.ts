import { beforeEach, expect, expectTypeOf, it, vi } from 'vitest';

import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import { joinURL, ExtendedURL, InvalidURLError, UnsupportedURLProtocolError } from '@/utils/urls';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { SUPPORTED_BASE_URL_PROTOCOLS } from '../../HttpInterceptorClient';
import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareBaseURLHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

  let defaultBaseURL: ExtendedURL;
  let interceptorOptions: HttpInterceptorOptions;

  beforeEach(() => {
    defaultBaseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should handle base URLs and paths correctly', async () => {
    for (const { baseURL, path } of [
      { baseURL: defaultBaseURL.raw, path: 'path' },
      { baseURL: `${defaultBaseURL.raw}/`, path: 'path' },
      { baseURL: defaultBaseURL.raw, path: '/path' },
      { baseURL: `${defaultBaseURL.raw}/`, path: '/path' },
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
        expect(interceptor.baseURL()).toBe(baseURL);

        const handler = await promiseIfRemote(interceptor.get(path).respond({ status: 200 }), interceptor);

        let requests = await handler.requests();
        expect(requests).toHaveLength(0);

        const url = joinURL(baseURL, path);

        const response = await fetch(url, { method: 'GET' });
        expect(response.status).toBe(200);

        requests = await handler.requests();
        expect(requests).toHaveLength(1);
        const [request] = requests;
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

  it('should throw an error if provided an invalid base URL', async () => {
    const handler = vi.fn();

    const invalidURL = 'invalid';

    await expect(async () => {
      await usingHttpInterceptor({ ...interceptorOptions, baseURL: invalidURL }, handler);
    }).rejects.toThrowError(new InvalidURLError(invalidURL));

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
