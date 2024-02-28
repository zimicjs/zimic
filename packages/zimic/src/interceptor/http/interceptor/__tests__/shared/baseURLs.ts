import { afterAll, beforeAll, expect, expectTypeOf, it } from 'vitest';

import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { SharedHttpInterceptorTestsOptions } from './interceptorTests';

export function declareBaseURLHttpInterceptorTests(options: SharedHttpInterceptorTestsOptions) {
  const { platform } = options;
  const defaultBaseURL = 'http://localhost:3000';

  const worker = createHttpInterceptorWorker({ platform });

  beforeAll(async () => {
    await worker.start();
  });

  afterAll(async () => {
    await worker.stop();
  });

  it.each([
    { baseURL: defaultBaseURL, path: 'path' },
    { baseURL: `${defaultBaseURL}/`, path: 'path' },
    { baseURL: `${defaultBaseURL}`, path: '/path' },
    { baseURL: `${defaultBaseURL}/`, path: '/path' },
    { baseURL: `${defaultBaseURL}/api`, path: 'path' },
    { baseURL: `${defaultBaseURL}/api/`, path: 'path' },
    { baseURL: `${defaultBaseURL}/api`, path: '/path' },
    { baseURL: `${defaultBaseURL}/api/`, path: '/path' },
  ])(`should handle base URL $baseURL and path $path correctly`, async ({ baseURL, path }) => {
    await usingHttpInterceptor<{
      ':any': {
        GET: {
          response: {
            200: {};
          };
        };
      };
    }>({ worker, baseURL }, async (interceptor) => {
      expect(interceptor.baseURL()).toBe(baseURL);

      const tracker = interceptor.get<':any'>(path).respond({
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
