import { HttpSchema } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, describe, expect, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareDelaysHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  type MethodSchema = HttpSchema.Method<{
    response: {
      200: { body: { message: string } };
    };
  }>;

  describe('Fixed delay', () => {
    it('should apply a fixed delay before responding', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const fixedDelayInMilliseconds = 100;

        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .delay(fixedDelayInMilliseconds)
            .respond({
              status: 200,
              body: { message: 'success' },
            }),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        const startTime = Date.now();
        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        const endTime = Date.now();
        const elapsedTime = endTime - startTime;

        expect(response.status).toBe(200);

        const body = (await response.json()) as { message: string };
        expect(body).toEqual({ message: 'success' });

        expect(handler.requests).toHaveLength(1);

        // Assert that the delay was applied with some tolerance
        expect(elapsedTime).toBeGreaterThanOrEqual(fixedDelayInMilliseconds - 10);
      });
    });

    it('should not apply delay when set to 0', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .delay(0)
            .respond({
              status: 200,
              body: { message: 'success' },
            }),
          interceptor,
        );

        const startTime = Date.now();
        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        const endTime = Date.now();
        const elapsedTime = endTime - startTime;

        expect(response.status).toBe(200);
        expect(handler.requests).toHaveLength(1);

        // Should respond quickly with minimal delay
        expect(elapsedTime).toBeLessThan(50);
      });
    });
  });

  describe('Ranged delay', () => {
    it('should apply a random delay within the specified range', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const minDelay = 100;
        const maxDelay = 200;

        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .delay(minDelay, maxDelay)
            .respond({
              status: 200,
              body: { message: 'success' },
            }),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        const startTime = Date.now();
        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        const endTime = Date.now();
        const elapsedTime = endTime - startTime;

        expect(response.status).toBe(200);

        const body = (await response.json()) as { message: string };
        expect(body).toEqual({ message: 'success' });

        expect(handler.requests).toHaveLength(1);

        // Assert that the delay was within the expected range with some tolerance
        expect(elapsedTime).toBeGreaterThanOrEqual(minDelay - 10);
        expect(elapsedTime).toBeLessThan(maxDelay + 50);
      });
    });

    it('should apply different delays for multiple requests with ranged delay', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const minDelay = 50;
        const maxDelay = 150;

        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .delay(minDelay, maxDelay)
            .respond({
              status: 200,
              body: { message: 'success' },
            }),
          interceptor,
        );

        const delays: number[] = [];

        for (let i = 0; i < 5; i++) {
          const startTime = Date.now();
          const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          const endTime = Date.now();
          const elapsedTime = endTime - startTime;

          expect(response.status).toBe(200);
          delays.push(elapsedTime);
        }

        expect(handler.requests).toHaveLength(5);

        // All delays should be within the expected range
        for (const delay of delays) {
          expect(delay).toBeGreaterThanOrEqual(minDelay - 10);
          expect(delay).toBeLessThan(maxDelay + 50);
        }
      });
    });
  });

  describe('Computed delay', () => {
    it('should apply a delay computed from the request', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: HttpSchema.Method<{
            request: { searchParams: { slow?: string } };
            response: { 200: MethodSchema['response'][200] };
          }>;
        };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .delay((request) => {
              const isSlow = request.searchParams.get('slow') === 'true';
              return isSlow ? 100 : 0;
            })
            .respond({
              status: 200,
              body: { message: 'success' },
            }),
          interceptor,
        );

        // Test fast request
        let startTime = Date.now();
        let response = await fetch(joinURL(baseURL, '/users?slow=false'), { method: 'GET' });
        let endTime = Date.now();
        let elapsedTime = endTime - startTime;

        expect(response.status).toBe(200);
        expect(elapsedTime).toBeLessThan(50);

        // Test slow request
        startTime = Date.now();
        response = await fetch(joinURL(baseURL, '/users?slow=true'), { method: 'GET' });
        endTime = Date.now();
        elapsedTime = endTime - startTime;

        expect(response.status).toBe(200);
        expect(elapsedTime).toBeGreaterThanOrEqual(90);

        expect(handler.requests).toHaveLength(2);
      });
    });

    it('should support async delay computation', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .delay(async () => {
              // Simulate async computation
              await new Promise<void>((resolve) => {
                setTimeout(resolve, 50);
              });
              return 100;
            })
            .respond({
              status: 200,
              body: { message: 'success' },
            }),
          interceptor,
        );

        const startTime = Date.now();
        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        const endTime = Date.now();
        const elapsedTime = endTime - startTime;

        expect(response.status).toBe(200);
        expect(handler.requests).toHaveLength(1);

        // Should include both the async computation time and the delay
        expect(elapsedTime).toBeGreaterThanOrEqual(140);
      });
    });
  });

  describe('Delay with restrictions', () => {
    it('should apply delay only to requests matching restrictions', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: HttpSchema.Method<{
            request: { searchParams: { tag?: string } };
            response: { 200: MethodSchema['response'][200] };
          }>;
        };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with({ searchParams: { tag: 'admin' } })
            .delay(100)
            .respond({
              status: 200,
              body: { message: 'success' },
            }),
          interceptor,
        );

        // Request matching restriction should have delay
        const startTime = Date.now();
        const response = await fetch(joinURL(baseURL, '/users?tag=admin'), { method: 'GET' });
        const endTime = Date.now();
        const elapsedTime = endTime - startTime;

        expect(response.status).toBe(200);
        expect(elapsedTime).toBeGreaterThanOrEqual(90);

        expect(handler.requests).toHaveLength(1);
      });
    });
  });

  describe('Delay chaining', () => {
    it('should allow chaining delay with respond', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .delay(50)
            .respond({
              status: 200,
              body: { message: 'success' },
            }),
          interceptor,
        );

        const startTime = Date.now();
        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        const endTime = Date.now();

        expect(response.status).toBe(200);
        expect(endTime - startTime).toBeGreaterThanOrEqual(40);
        expect(handler.requests).toHaveLength(1);
      });
    });

    it('should allow chaining delay with with and respond', async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: HttpSchema.Method<{
            request: { searchParams: { tag?: string } };
            response: { 200: MethodSchema['response'][200] };
          }>;
        };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with({ searchParams: { tag: 'admin' } })
            .delay(50)
            .respond({
              status: 200,
              body: { message: 'success' },
            }),
          interceptor,
        );

        const response = await fetch(joinURL(baseURL, '/users?tag=admin'), { method: 'GET' });

        expect(response.status).toBe(200);
        expect(handler.requests).toHaveLength(1);
      });
    });
  });

  describe('Delay with clear', () => {
    it('should clear delay when handler is cleared', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .delay(100)
            .respond({
              status: 200,
              body: { message: 'success' },
            }),
          interceptor,
        );

        // First request should have delay
        let startTime = Date.now();
        let response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        let endTime = Date.now();
        let elapsedTime = endTime - startTime;

        expect(response.status).toBe(200);
        expect(elapsedTime).toBeGreaterThanOrEqual(90);
        expect(handler.requests).toHaveLength(1);

        // Clear and respond without delay
        handler.clear();
        await promiseIfRemote(
          handler.respond({
            status: 200,
            body: { message: 'success' },
          }),
          interceptor,
        );

        // Second request should not have delay
        startTime = Date.now();
        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        endTime = Date.now();
        elapsedTime = endTime - startTime;

        expect(response.status).toBe(200);
        expect(elapsedTime).toBeLessThan(50);
        expect(handler.requests).toHaveLength(1);
      });
    });
  });

  describe('Multiple delays', () => {
    it('should use the last declared delay', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .delay(200)
            .delay(50) // This should override the previous delay
            .respond({
              status: 200,
              body: { message: 'success' },
            }),
          interceptor,
        );

        const startTime = Date.now();
        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        const endTime = Date.now();
        const elapsedTime = endTime - startTime;

        expect(response.status).toBe(200);
        expect(elapsedTime).toBeGreaterThanOrEqual(40);
        expect(elapsedTime).toBeLessThan(150); // Should not have the 200ms delay
        expect(handler.requests).toHaveLength(1);
      });
    });
  });
}
