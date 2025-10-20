import { HttpSchema, HttpSearchParams } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import joinURL from '@zimic/utils/url/joinURL';
import color from 'picocolors';
import { beforeEach, describe, expect, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { expectTimesCheckError } from '@/http/requestHandler/__tests__/shared/utils';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareTimesHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  type MethodSchema = HttpSchema.Method<{
    request: {
      searchParams: { value?: string };
    };
    response: {
      204: {};
    };
  }>;

  describe('Exact number of requests', () => {
    it('should intercept an exact number of limited requests', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }).times(1), interceptor);

        expect(handler.requests).toHaveLength(0);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 request, but got 0.',
          expectedNumberOfRequests: 1,
        });

        let response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        handler.times(2);

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(2);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        handler.times(1 * 3);

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1 * 3);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    it('should intercept less than an exact number of limited requests', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }).times(2), interceptor);

        expect(handler.requests).toHaveLength(0);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 2 requests, but got 0.',
          expectedNumberOfRequests: 2,
        });

        let response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 2 requests, but got 1.',
          expectedNumberOfRequests: 2,
        });

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(2);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        handler.times(1 * 4);

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1 * 3);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: `Expected exactly ${1 * 4} requests, but got ${1 * 3}.`,
          expectedNumberOfRequests: 1 * 4,
        });
      });
    });

    it('should not intercept more than an exact number of limited requests', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }).times(1), interceptor);

        expect(handler.requests).toHaveLength(0);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 request, but got 0.',
          expectedNumberOfRequests: 1,
        });

        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        let responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 request, but got 2.',
          expectedNumberOfRequests: 1,
        });

        responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });

        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: `Expected exactly 1 request, but got ${1 * 3}.`,
          expectedNumberOfRequests: 1,
        });
      });
    });
  });

  describe('Range number of requests', () => {
    it('should intercept the minimum number of requests limited in a range', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .respond({ status: 204 })
            .times(0, 1 * 3),
          interceptor,
        );

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        expect(handler.requests).toHaveLength(0);

        let response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(2);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1 * 3);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    it('should intercept less than the minimum number of requests limited in a range', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .respond({ status: 204 })
            .times(2, 1 * 3),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: `Expected at least 2 and at most ${1 * 3} requests, but got 0.`,
          expectedNumberOfRequests: { min: 2, max: 1 * 3 },
        });

        let response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: `Expected at least 2 and at most ${1 * 3} requests, but got 1.`,
          expectedNumberOfRequests: { min: 2, max: 1 * 3 },
        });

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(2);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    it('should intercept the maximum number of requests limited in a range', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .respond({ status: 204 })
            .times(2, 1 * 3),
          interceptor,
        );

        let response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1 * 3);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    it('should not intercept more than the maximum number of requests limited in a range', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .respond({ status: 204 })
            .times(2, 1 * 3),
          interceptor,
        );

        let response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1 * 3);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1 * 3);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: `Expected at least 2 and at most ${1 * 3} requests, but got ${1 * 4}.`,
          expectedNumberOfRequests: { min: 2, max: 1 * 3 },
        });
      });
    });

    it('should intercept the exact number of requests limited in a range where the minimum and maximum are equal', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.get('/users').respond({ status: 204 }).times(1, 1),
          interceptor,
        );

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 request, but got 0.',
          expectedNumberOfRequests: { min: 1, max: 1 },
        });

        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 request, but got 2.',
          expectedNumberOfRequests: { min: 1, max: 1 },
        });
      });
    });
  });

  describe('Request distribution', () => {
    it('should distribute requests to the next matching handler when the maximum number of requests is reached and no restrictions are used', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handlers = await Promise.all([
          promiseIfRemote(interceptor.get('/users').respond({ status: 204 }).times(1), interceptor),
          promiseIfRemote(interceptor.get('/users').respond({ status: 204 }).times(1, 2), interceptor),
          promiseIfRemote(interceptor.get('/users').respond({ status: 204 }).times(2), interceptor),
        ]);

        await expectTimesCheckError(() => promiseIfRemote(handlers[0].checkTimes(), handlers[0]), {
          message: 'Expected exactly 1 request, but got 0.',
          expectedNumberOfRequests: 1,
        });
        await expectTimesCheckError(() => promiseIfRemote(handlers[1].checkTimes(), handlers[1]), {
          message: 'Expected at least 1 and at most 2 requests, but got 0.',
          expectedNumberOfRequests: { min: 1, max: 2 },
        });
        await expectTimesCheckError(() => promiseIfRemote(handlers[2].checkTimes(), handlers[2]), {
          message: 'Expected exactly 2 requests, but got 0.',
          expectedNumberOfRequests: 2,
        });

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 2 requests, but got 0.',
          expectedNumberOfRequests: 2,
        });

        let response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(0);
        expect(handlers[2].requests).toHaveLength(1);

        await expectTimesCheckError(() => promiseIfRemote(handlers[0].checkTimes(), handlers[0]), {
          message: 'Expected exactly 1 request, but got 0.',
          expectedNumberOfRequests: 1,
        });
        await expectTimesCheckError(() => promiseIfRemote(handlers[1].checkTimes(), handlers[1]), {
          message: 'Expected at least 1 and at most 2 requests, but got 0.',
          expectedNumberOfRequests: { min: 1, max: 2 },
        });
        await expectTimesCheckError(() => promiseIfRemote(handlers[2].checkTimes(), handlers[2]), {
          message: 'Expected exactly 2 requests, but got 1.',
          expectedNumberOfRequests: 2,
        });

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 2 requests, but got 1.',
          expectedNumberOfRequests: 2,
        });

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(0);
        expect(handlers[2].requests).toHaveLength(2);

        await expectTimesCheckError(() => promiseIfRemote(handlers[0].checkTimes(), handlers[0]), {
          message: 'Expected exactly 1 request, but got 0.',
          expectedNumberOfRequests: 1,
        });
        await expectTimesCheckError(() => promiseIfRemote(handlers[1].checkTimes(), handlers[1]), {
          message: 'Expected at least 1 and at most 2 requests, but got 0.',
          expectedNumberOfRequests: { min: 1, max: 2 },
        });
        await promiseIfRemote(handlers[2].checkTimes(), handlers[2]);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected at least 1 and at most 2 requests, but got 0.',
          expectedNumberOfRequests: { min: 1, max: 2 },
        });

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(1);
        expect(handlers[2].requests).toHaveLength(2);

        await expectTimesCheckError(() => promiseIfRemote(handlers[0].checkTimes(), handlers[0]), {
          message: 'Expected exactly 1 request, but got 0.',
          expectedNumberOfRequests: 1,
        });
        await promiseIfRemote(handlers[1].checkTimes(), handlers[1]);
        await promiseIfRemote(handlers[2].checkTimes(), handlers[2]);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 request, but got 0.',
          expectedNumberOfRequests: 1,
        });

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(2);
        expect(handlers[2].requests).toHaveLength(2);

        await expectTimesCheckError(() => promiseIfRemote(handlers[0].checkTimes(), handlers[0]), {
          message: 'Expected exactly 1 request, but got 0.',
          expectedNumberOfRequests: 1,
        });
        await promiseIfRemote(handlers[1].checkTimes(), handlers[1]);
        await promiseIfRemote(handlers[2].checkTimes(), handlers[2]);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 request, but got 0.',
          expectedNumberOfRequests: 1,
        });

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(1);
        expect(handlers[1].requests).toHaveLength(2);
        expect(handlers[2].requests).toHaveLength(2);

        await promiseIfRemote(handlers[0].checkTimes(), handlers[0]);
        await promiseIfRemote(handlers[1].checkTimes(), handlers[1]);
        await promiseIfRemote(handlers[2].checkTimes(), handlers[2]);

        const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handlers[0].requests).toHaveLength(1);
        expect(handlers[1].requests).toHaveLength(2);
        expect(handlers[2].requests).toHaveLength(2);

        await promiseIfRemote(handlers[0].checkTimes(), handlers[0]);
        await promiseIfRemote(handlers[1].checkTimes(), handlers[1]);

        await expectTimesCheckError(() => promiseIfRemote(handlers[2].checkTimes(), handlers[2]), {
          message: 'Expected exactly 2 requests, but got 3.',
          expectedNumberOfRequests: 2,
        });

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 2 requests, but got 3.',
          expectedNumberOfRequests: 2,
        });
      });
    });

    it('should distribute requests to the next matching handler when the maximum number of requests is reached and restrictions are used', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handlers = await Promise.all([
          promiseIfRemote(
            interceptor
              .get('/users')
              .respond({ status: 204 })
              .with({ searchParams: { value: '1' } })
              .times(1),
            interceptor,
          ),
          promiseIfRemote(
            interceptor
              .get('/users')
              .respond({ status: 204 })
              .with({ searchParams: { value: '2' } })
              .times(1, 2),
            interceptor,
          ),
          promiseIfRemote(
            interceptor
              .get('/users')
              .respond({ status: 204 })
              .with({ searchParams: { value: '2' } })
              .times(2),
            interceptor,
          ),
        ]);

        await expectTimesCheckError(() => promiseIfRemote(handlers[0].checkTimes(), handlers[0]), {
          message: 'Expected exactly 1 matching request, but got 0.',
          expectedNumberOfRequests: 1,
        });
        await expectTimesCheckError(() => promiseIfRemote(handlers[1].checkTimes(), handlers[1]), {
          message: 'Expected at least 1 and at most 2 matching requests, but got 0.',
          expectedNumberOfRequests: { min: 1, max: 2 },
        });
        await expectTimesCheckError(() => promiseIfRemote(handlers[2].checkTimes(), handlers[2]), {
          message: 'Expected exactly 2 matching requests, but got 0.',
          expectedNumberOfRequests: 2,
        });

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 2 matching requests, but got 0.',
          expectedNumberOfRequests: 2,
        });

        const searchParams = new HttpSearchParams({ value: '2' });

        let response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(0);
        expect(handlers[2].requests).toHaveLength(1);

        await expectTimesCheckError(() => promiseIfRemote(handlers[0].checkTimes(), handlers[0]), {
          message: 'Expected exactly 1 matching request, but got 0.',
          expectedNumberOfRequests: 1,
        });
        await expectTimesCheckError(() => promiseIfRemote(handlers[1].checkTimes(), handlers[1]), {
          message: 'Expected at least 1 and at most 2 matching requests, but got 0.',
          expectedNumberOfRequests: { min: 1, max: 2 },
        });
        await expectTimesCheckError(() => promiseIfRemote(handlers[2].checkTimes(), handlers[2]), {
          message: 'Expected exactly 2 matching requests, but got 1.',
          expectedNumberOfRequests: 2,
        });

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 2 matching requests, but got 1.',
          expectedNumberOfRequests: 2,
        });

        searchParams.set('value', '1');

        response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(1);
        expect(handlers[1].requests).toHaveLength(0);
        expect(handlers[2].requests).toHaveLength(1);

        await promiseIfRemote(handlers[0].checkTimes(), handlers[0]);
        await expectTimesCheckError(() => promiseIfRemote(handlers[1].checkTimes(), handlers[1]), {
          message: 'Expected at least 1 and at most 2 matching requests, but got 0.',
          expectedNumberOfRequests: { min: 1, max: 2 },
        });
        await expectTimesCheckError(() => promiseIfRemote(handlers[2].checkTimes(), handlers[2]), {
          message: 'Expected exactly 2 matching requests, but got 1.',
          expectedNumberOfRequests: 2,
        });

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 2 matching requests, but got 1.',
          expectedNumberOfRequests: 2,
        });

        searchParams.set('value', 'unknown');

        let responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handlers[0].requests).toHaveLength(1);
        expect(handlers[1].requests).toHaveLength(0);
        expect(handlers[2].requests).toHaveLength(1);

        await promiseIfRemote(handlers[0].checkTimes(), handlers[0]);
        await expectTimesCheckError(() => promiseIfRemote(handlers[1].checkTimes(), handlers[1]), {
          message: [
            'Expected at least 1 and at most 2 matching requests, but got 0.',
            '',
            'Requests evaluated by this handler:',
            '',
            `  ${color.green('- Expected')}`,
            `  ${color.red('+ Received')}`,
            '',
            `1: GET ${joinURL(baseURL, '/users?value=unknown')}`,
            '     Search params:',
            `       ${color.green('- { "value": "2" }')}`,
            `       ${color.red('+ { "value": "unknown" }')}`,
          ].join('\n'),
          expectedNumberOfRequests: { min: 1, max: 2 },
        });
        await expectTimesCheckError(() => promiseIfRemote(handlers[2].checkTimes(), handlers[2]), {
          message: [
            'Expected exactly 2 matching requests, but got 1.',
            '',
            'Requests evaluated by this handler:',
            '',
            `  ${color.green('- Expected')}`,
            `  ${color.red('+ Received')}`,
            '',
            `1: GET ${joinURL(baseURL, '/users?value=unknown')}`,
            '     Search params:',
            `       ${color.green('- { "value": "2" }')}`,
            `       ${color.red('+ { "value": "unknown" }')}`,
          ].join('\n'),
          expectedNumberOfRequests: 2,
        });

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: [
            'Expected exactly 2 matching requests, but got 1.',
            '',
            'Requests evaluated by this handler:',
            '',
            `  ${color.green('- Expected')}`,
            `  ${color.red('+ Received')}`,
            '',
            `1: GET ${joinURL(baseURL, '/users?value=unknown')}`,
            '     Search params:',
            `       ${color.green('- { "value": "2" }')}`,
            `       ${color.red('+ { "value": "unknown" }')}`,
          ].join('\n'),
          expectedNumberOfRequests: 2,
        });

        searchParams.set('value', '2');

        response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(1);
        expect(handlers[1].requests).toHaveLength(0);
        expect(handlers[2].requests).toHaveLength(2);

        await promiseIfRemote(handlers[0].checkTimes(), handlers[0]);
        await expectTimesCheckError(() => promiseIfRemote(handlers[1].checkTimes(), handlers[1]), {
          message: [
            'Expected at least 1 and at most 2 matching requests, but got 0.',
            '',
            'Requests evaluated by this handler:',
            '',
            `  ${color.green('- Expected')}`,
            `  ${color.red('+ Received')}`,
            '',
            `1: GET ${joinURL(baseURL, '/users?value=unknown')}`,
            '     Search params:',
            `       ${color.green('- { "value": "2" }')}`,
            `       ${color.red('+ { "value": "unknown" }')}`,
          ].join('\n'),
          expectedNumberOfRequests: { min: 1, max: 2 },
        });
        await promiseIfRemote(handlers[2].checkTimes(), handlers[2]);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: [
            'Expected at least 1 and at most 2 matching requests, but got 0.',
            '',
            'Requests evaluated by this handler:',
            '',
            `  ${color.green('- Expected')}`,
            `  ${color.red('+ Received')}`,
            '',
            `1: GET ${joinURL(baseURL, '/users?value=unknown')}`,
            '     Search params:',
            `       ${color.green('- { "value": "2" }')}`,
            `       ${color.red('+ { "value": "unknown" }')}`,
          ].join('\n'),
          expectedNumberOfRequests: { min: 1, max: 2 },
        });

        response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(1);
        expect(handlers[1].requests).toHaveLength(1);
        expect(handlers[2].requests).toHaveLength(2);

        await promiseIfRemote(handlers[0].checkTimes(), handlers[0]);
        await promiseIfRemote(handlers[1].checkTimes(), handlers[1]);
        await promiseIfRemote(handlers[2].checkTimes(), handlers[2]);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(1);
        expect(handlers[1].requests).toHaveLength(2);
        expect(handlers[2].requests).toHaveLength(2);

        await promiseIfRemote(handlers[0].checkTimes(), handlers[0]);
        await promiseIfRemote(handlers[1].checkTimes(), handlers[1]);
        await promiseIfRemote(handlers[2].checkTimes(), handlers[2]);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handlers[0].requests).toHaveLength(1);
        expect(handlers[1].requests).toHaveLength(2);
        expect(handlers[2].requests).toHaveLength(2);

        await promiseIfRemote(handlers[0].checkTimes(), handlers[0]);
        await promiseIfRemote(handlers[1].checkTimes(), handlers[1]);
        await expectTimesCheckError(() => promiseIfRemote(handlers[2].checkTimes(), handlers[2]), {
          message: [
            'Expected exactly 2 matching requests, but got 3.',
            '',
            'Requests evaluated by this handler:',
            '',
            `  ${color.green('- Expected')}`,
            `  ${color.red('+ Received')}`,
            '',
            `1: GET ${joinURL(baseURL, '/users?value=unknown')}`,
            '     Search params:',
            `       ${color.green('- { "value": "2" }')}`,
            `       ${color.red('+ { "value": "unknown" }')}`,
          ].join('\n'),
          expectedNumberOfRequests: 2,
        });

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: [
            'Expected exactly 2 matching requests, but got 3.',
            '',
            'Requests evaluated by this handler:',
            '',
            `  ${color.green('- Expected')}`,
            `  ${color.red('+ Received')}`,
            '',
            `1: GET ${joinURL(baseURL, '/users?value=unknown')}`,
            '     Search params:',
            `       ${color.green('- { "value": "2" }')}`,
            `       ${color.red('+ { "value": "unknown" }')}`,
          ].join('\n'),
          expectedNumberOfRequests: 2,
        });
      });
    });
  });

  describe('Unmatched requests', () => {
    it('should not consider requests unmatched due to restrictions in times checks', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with({ searchParams: { value: '1' } })
            .respond({ status: 204 })
            .times(1),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 matching request, but got 0.',
          expectedNumberOfRequests: 1,
        });

        const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(0);

        const contentLines = [
          'Expected exactly 1 matching request, but got 0.',
          '',
          'Requests evaluated by this handler:',
          '',
          `  ${color.green('- Expected')}`,
          `  ${color.red('+ Received')}`,
        ];

        for (let requestIndex = 0; requestIndex < 1; requestIndex++) {
          const requestNumber = requestIndex + 1;

          contentLines.push(
            '',
            `${requestNumber}: GET ${joinURL(baseURL, '/users')}`,
            '     Search params:',
            `       ${color.green('- { "value": "1" }')}`,
            `       ${color.red('+ {}')}`,
          );
        }

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: contentLines.join('\n'),
          expectedNumberOfRequests: 1,
        });
      });
    });

    it('should consider requests unmatched due to missing response declarations in times checks', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.get('/users').times(1), interceptor);

        expect(handler.requests).toHaveLength(0);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 request, but got 0.',
          expectedNumberOfRequests: 1,
        });

        let responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(0);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(0);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 request, but got 2.',
          expectedNumberOfRequests: 1,
        });
      });
    });

    it('should consider requests with restrictions unmatched due to missing response declarations in times checks', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with({ searchParams: { value: '1' } })
            .times(1),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 matching request, but got 0.',
          expectedNumberOfRequests: 1,
        });

        let responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(0);

        const contentLines = [
          'Expected exactly 1 matching request, but got 0.',
          '',
          'Requests evaluated by this handler:',
          '',
          `  ${color.green('- Expected')}`,
          `  ${color.red('+ Received')}`,
        ];

        for (let requestIndex = 0; requestIndex < 1; requestIndex++) {
          const requestNumber = requestIndex + 1;

          contentLines.push(
            '',
            `${requestNumber}: GET ${joinURL(baseURL, '/users')}`,
            '     Search params:',
            `       ${color.green('- { "value": "1" }')}`,
            `       ${color.red('+ {}')}`,
          );
        }

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: contentLines.join('\n'),
          expectedNumberOfRequests: 1,
        });

        const searchParams = new HttpSearchParams({ value: '1' });

        responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(0);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(0);

        contentLines[0] = 'Expected exactly 1 matching request, but got 2.';

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: contentLines.join('\n'),
          expectedNumberOfRequests: 1,
        });
      });
    });

    it('should consider requests unmatched due to missing response declarations when no requests are expected in times checks', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.get('/users').times(0), interceptor);

        expect(handler.requests).toHaveLength(0);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(0);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 0 requests, but got 1.',
          expectedNumberOfRequests: 0,
        });
      });
    });

    it('should not consider requests unmatched due to unmocked path in times checks', async () => {
      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with({ searchParams: { value: '1' } })
            .respond({ status: 204 })
            .times(1),
          interceptor,
        );

        expect(handler.requests).toHaveLength(0);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 matching request, but got 0.',
          expectedNumberOfRequests: 1,
        });

        const responsePromise = fetch(joinURL(baseURL, '/users/other'), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(0);

        await expectTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 matching request, but got 0.',
          expectedNumberOfRequests: 1,
        });
      });
    });
  });
}
