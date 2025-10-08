import { HttpSchema } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, expect, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { expectBypassedResponse } from '@tests/utils/fetch';
import { createInternalHttpInterceptor, usingHttpInterceptor } from '@tests/utils/interceptors';

import NotRunningHttpInterceptorError from '../../errors/NotRunningHttpInterceptorError';
import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareLifeCycleHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  type MethodSchema = HttpSchema.Method<{
    response: { 204: {} };
  }>;

  it('should ignore all handlers after restarted when intercepting requests', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      expect(interceptor.isRunning).toBe(true);
      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);

      let responsePromise = fetch(joinURL(baseURL, '/users'), {
        method: 'GET',
      });

      if (type === 'local') {
        await expectBypassedResponse(responsePromise);
      } else {
        await expectFetchError(responsePromise);
      }

      expect(handler.requests).toHaveLength(0);

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);

      responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(0);
    });
  });

  it('should ignore all handlers after restarted when intercepting requests, even if another interceptor is still running', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      await usingHttpInterceptor(interceptorOptions, async (otherInterceptor) => {
        expect(interceptor.isRunning).toBe(true);
        expect(otherInterceptor.isRunning).toBe(true);

        await interceptor.stop();
        expect(interceptor.isRunning).toBe(false);
        expect(otherInterceptor.isRunning).toBe(true);

        let responsePromise = fetch(joinURL(baseURL, '/users'), {
          method: 'GET',
        });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(0);

        await interceptor.start();
        expect(interceptor.isRunning).toBe(true);
        expect(otherInterceptor.isRunning).toBe(true);

        responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(0);
      });
    });
  });

  it('should throw an error when trying to create a request handler if not running', async () => {
    const interceptor = createInternalHttpInterceptor(interceptorOptions);
    expect(interceptor.isRunning).toBe(false);

    await expect(async () => {
      await interceptor.get('/');
    }).rejects.toThrowError(new NotRunningHttpInterceptorError());
  });
}
