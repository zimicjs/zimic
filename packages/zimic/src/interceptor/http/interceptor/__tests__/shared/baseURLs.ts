import { afterAll, beforeAll, expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { RuntimeSharedHttpInterceptorTestsOptions } from './interceptorTests';

export function declareBaseURLHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, worker, baseURL, interceptorOptions } = options;

  beforeAll(async () => {
    await worker.start();
    expect(worker.platform()).toBe(platform);
  });

  afterAll(async () => {
    await worker.stop();
  });

  it.each([
    { baseURL: `${baseURL}`, path: 'path' },
    { baseURL: `${baseURL}/`, path: 'path' },
    { baseURL: `${baseURL}`, path: '/path' },
    { baseURL: `${baseURL}/`, path: '/path' },
    { baseURL: `${baseURL}/api`, path: 'path' },
    { baseURL: `${baseURL}/api/`, path: 'path' },
    { baseURL: `${baseURL}/api`, path: '/path' },
    { baseURL: `${baseURL}/api/`, path: '/path' },
  ])(`should handle base URL $baseURL and path $path correctly`, async ({ baseURL, path }) => {
    await usingHttpInterceptor<{
      ':any': {
        GET: {
          response: {
            200: {};
          };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      expect(interceptor.baseURL()).toBe(baseURL);

      const tracker = interceptor.get(path).respond({
        status: 200,
      });

      let requests = await tracker.requests();
      expect(requests).toHaveLength(0);

      const url = `${baseURL}/${path}`.replace(/(\w)\/{2,}(\w)/g, '$1/$2');

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
  });
}
