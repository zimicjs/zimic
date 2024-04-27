import { expect, expectTypeOf, it } from 'vitest';

import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import { joinURL } from '@/utils/fetch';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { RuntimeSharedHttpInterceptorTestsOptions } from './interceptorTests';

export function declareBaseURLHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { getBaseURL, getPathPrefix, getWorker, getInterceptorOptions } = options;

  it('should handle base URLs and paths correctly', async () => {
    const worker = getWorker();
    const defaultBaseURL = getBaseURL();
    const defaultPathPrefix = getPathPrefix();
    const interceptorOptions = getInterceptorOptions();

    for (const { baseURL, pathPrefix, path } of [
      { baseURL: `${defaultBaseURL}`, pathPrefix: `${defaultPathPrefix}`, path: 'path' },
      { baseURL: `${defaultBaseURL}/`, pathPrefix: `${defaultPathPrefix}/`, path: 'path' },
      { baseURL: `${defaultBaseURL}`, pathPrefix: `${defaultPathPrefix}`, path: '/path' },
      { baseURL: `${defaultBaseURL}/`, pathPrefix: `${defaultPathPrefix}/`, path: '/path' },
    ]) {
      await usingHttpInterceptor<{
        ':any': {
          GET: {
            response: {
              200: {};
            };
          };
        };
      }>({ ...interceptorOptions, baseURL, pathPrefix }, async (interceptor) => {
        expect(interceptor.baseURL()).toBe(baseURL);

        const tracker = await promiseIfRemote(
          interceptor.get(path).respond({
            status: 200,
          }),
          worker,
        );

        let requests = await tracker.requests();
        expect(requests).toHaveLength(0);

        const url = joinURL(baseURL, path);

        const response = await fetch(url, { method: 'GET' });
        expect(response.status).toBe(200);

        requests = await tracker.requests();
        expect(requests).toHaveLength(1);
        const [request] = requests;
        expect(request).toBeInstanceOf(Request);

        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        expectTypeOf(request.response.status).toEqualTypeOf<200>();
        expect(request.response.status).toEqual(200);

        expectTypeOf(request.response.body).toEqualTypeOf<null>();
        expect(request.response.body).toEqual(null);
      });
    }
  });
}
