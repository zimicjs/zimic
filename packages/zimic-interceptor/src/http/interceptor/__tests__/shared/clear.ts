import { HttpSchema } from '@zimic/http';
import { expectFetchError } from '@zimic/utils/fetch';
import { joinURL } from '@zimic/utils/url';
import { beforeEach, expect, expectTypeOf, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/http/requestHandler/RemoteHttpRequestHandler';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareClearHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  const Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  type MethodSchema = HttpSchema.Method<{
    response: { 204: {} };
  }>;

  it('should ignore all handlers after cleared when intercepting requests', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);
      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      await promiseIfRemote(interceptor.clear(), interceptor);

      const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(0);
    });
  });

  it('should support creating new handlers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);

      await promiseIfRemote(interceptor.clear(), interceptor);

      const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);
      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);
      const request = handler.requests[0];
      expect(request).toBeInstanceOf(Request);

      expectTypeOf(request.body).toEqualTypeOf<null>();
      expect(request.body).toBe(null);

      expectTypeOf(request.response.status).toEqualTypeOf<204>();
      expect(request.response.status).toBe(204);

      expectTypeOf(request.response.body).toEqualTypeOf<null>();
      expect(request.response.body).toBe(null);
    });
  });

  it('should support reusing previous handlers after cleared', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(interceptor.get('/users'), interceptor);

      await promiseIfRemote(handler.respond({ status: 204 }), interceptor);

      await promiseIfRemote(interceptor.clear(), interceptor);

      const otherHandler = await promiseIfRemote(handler.respond({ status: 204 }), interceptor);
      expect(otherHandler).toBeInstanceOf(Handler);

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(otherHandler.requests).toHaveLength(1);
      const request = otherHandler.requests[0];
      expect(request).toBeInstanceOf(Request);

      expectTypeOf(request.body).toEqualTypeOf<null>();
      expect(request.body).toBe(null);

      expectTypeOf(request.response.status).toEqualTypeOf<204>();
      expect(request.response.status).toBe(204);

      expectTypeOf(request.response.body).toEqualTypeOf<null>();
      expect(request.response.body).toBe(null);
    });
  });
}
