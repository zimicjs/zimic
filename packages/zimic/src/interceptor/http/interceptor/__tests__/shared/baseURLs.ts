import { afterAll, beforeAll, expect, expectTypeOf, it } from 'vitest';

import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';
import LocalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/LocalHttpInterceptorWorker';
import { LocalHttpInterceptorWorker as PublicLocalHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/types/public';
import { usingLocalHttpInterceptor } from '@tests/utils/interceptors';

import { SharedHttpInterceptorTestsOptions } from './interceptorTests';

export function declareBaseURLHttpInterceptorTests(options: SharedHttpInterceptorTestsOptions) {
  const { platform } = options;

  const worker = createHttpInterceptorWorker({
    type: 'local',
  }) satisfies PublicLocalHttpInterceptorWorker as LocalHttpInterceptorWorker;

  const baseURL = 'http://localhost:3000';

  beforeAll(async () => {
    await worker.start();
    expect(worker.platform()).toBe(platform);
  });

  afterAll(async () => {
    await worker.stop();
  });

  it.each([
    { baseURL, path: 'path' },
    { baseURL: `${baseURL}/`, path: 'path' },
    { baseURL: `${baseURL}`, path: '/path' },
    { baseURL: `${baseURL}/`, path: '/path' },
    { baseURL: `${baseURL}/api`, path: 'path' },
    { baseURL: `${baseURL}/api/`, path: 'path' },
    { baseURL: `${baseURL}/api`, path: '/path' },
    { baseURL: `${baseURL}/api/`, path: '/path' },
  ])(`should handle base URL $baseURL and path $path correctly`, async ({ baseURL, path }) => {
    await usingLocalHttpInterceptor<{
      ':any': {
        GET: {
          response: {
            200: {};
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      expect(interceptor.baseURL()).toBe(baseURL);

      const tracker = interceptor.get(path).respond({
        status: 200,
      });

      const requests = tracker.requests();
      expect(requests).toHaveLength(0);

      const url = `${baseURL}/${path}`.replace(/(\w)\/{2,}(\w)/g, '$1/$2');

      const response = await fetch(url, { method: 'GET' });
      expect(response.status).toBe(200);

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
