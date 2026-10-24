import { HttpSchema, HttpSearchParams } from '@zimic/http';
import { createPromiseWithResolvers } from '@zimic/utils/data';
import { expectFetchError } from '@zimic/utils/fetch';
import { joinURL } from '@zimic/utils/url';
import { beforeEach, expect, expectTypeOf, it, vi } from 'vitest';

import LocalHttpRequestHandler from '@/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/http/requestHandler/RemoteHttpRequestHandler';
import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';

import { HttpInterceptorOptions, UnhandledRequestStrategy } from '../../types/options';
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

  type MethodWithSearchParamsSchema = HttpSchema.Method<{
    request: { searchParams: { value?: string } };
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

  it('should not consider handlers from before cleared when multiple paths matched requests', async () => {
    const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(() => ({
      action: 'reject',
      log: false,
    }));

    await usingHttpInterceptor<{
      '/users': { GET: MethodWithSearchParamsSchema };
      '/:resource': { GET: MethodSchema };
    }>({ ...interceptorOptions, type, onUnhandledRequest }, async (interceptor) => {
      await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);
      await promiseIfRemote(interceptor.get('/:resource').respond({ status: 204 }), interceptor);

      await promiseIfRemote(interceptor.clear(), interceptor);

      const handler = await promiseIfRemote(
        interceptor
          .get('/users')
          .with({ searchParams: { value: '1' } })
          .respond({ status: 204 }),
        interceptor,
      );

      const searchParams = new HttpSearchParams({ value: 2 });

      const responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(0);
      expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle requests once after cleared and redeclared when multiple paths matched requests', async () => {
    const restriction = vi.fn(() => false);

    const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(() => ({
      action: 'reject',
      log: false,
    }));

    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
      '/:resource': { GET: MethodSchema };
    }>({ ...interceptorOptions, type, onUnhandledRequest }, async (interceptor) => {
      await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);
      await promiseIfRemote(interceptor.get('/:resource').respond({ status: 204 }), interceptor);

      await promiseIfRemote(interceptor.clear(), interceptor);

      const handler = await promiseIfRemote(
        interceptor.get('/:resource').with(restriction).respond({ status: 204 }),
        interceptor,
      );

      const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      await expectFetchError(responsePromise);

      expect(restriction).toHaveBeenCalledTimes(1);
      expect(handler.requests).toHaveLength(0);
      expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle requests once if another interceptor is cleared while they are being handled', async () => {
    const restrictionStartedPromise = createPromiseWithResolvers<void>();
    const restrictionReleasedPromise = createPromiseWithResolvers<void>();

    const restriction = vi.fn(async () => {
      restrictionStartedPromise.resolve();
      await restrictionReleasedPromise;
      return false;
    });

    const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(() => ({
      action: 'reject',
      log: false,
    }));

    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>({ ...interceptorOptions, baseURL: joinURL(baseURL, '/other') }, async (otherInterceptor) => {
      await promiseIfRemote(otherInterceptor.get('/users').respond({ status: 204 }), otherInterceptor);

      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>({ ...interceptorOptions, type, onUnhandledRequest }, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.get('/users').with(restriction).respond({ status: 204 }),
          interceptor,
        );

        const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await restrictionStartedPromise;

        await promiseIfRemote(otherInterceptor.clear(), otherInterceptor);
        restrictionReleasedPromise.resolve();

        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(0);
        expect(restriction).toHaveBeenCalledTimes(1);
        expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
      });
    });
  });

  it('should not consider handlers of another interceptor cleared while requests are being handled', async () => {
    const restrictionStartedPromise = createPromiseWithResolvers<void>();
    const restrictionReleasedPromise = createPromiseWithResolvers<void>();

    const restriction = vi.fn(async () => {
      restrictionStartedPromise.resolve();
      await restrictionReleasedPromise;
      return false;
    });

    const otherOnUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>();

    const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(() => ({
      action: 'reject',
      log: false,
    }));

    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>({ ...interceptorOptions, type, onUnhandledRequest: otherOnUnhandledRequest }, async (otherInterceptor) => {
      await promiseIfRemote(otherInterceptor.get('/users').respond({ status: 204 }), otherInterceptor);

      await usingHttpInterceptor<{
        '/users': { GET: MethodSchema };
      }>({ ...interceptorOptions, type, onUnhandledRequest }, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.get('/users').with(restriction).respond({ status: 204 }),
          interceptor,
        );

        const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        await restrictionStartedPromise;

        await promiseIfRemote(otherInterceptor.clear(), otherInterceptor);
        restrictionReleasedPromise.resolve();

        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(0);
        expect(otherOnUnhandledRequest).not.toHaveBeenCalled();
        expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
      });
    });
  });

  it('should not handle requests after cleared while they are being matched', async () => {
    const restrictionStartedPromise = createPromiseWithResolvers<void>();
    const restrictionReleasedPromise = createPromiseWithResolvers<void>();

    const restriction = vi.fn(async () => {
      restrictionStartedPromise.resolve();
      await restrictionReleasedPromise;
      return true;
    });

    const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(() => ({
      action: 'reject',
      log: false,
    }));

    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>({ ...interceptorOptions, type, onUnhandledRequest }, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.get('/users').with(restriction).respond({ status: 204 }),
        interceptor,
      );

      const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      await restrictionStartedPromise;

      await promiseIfRemote(interceptor.clear(), interceptor);

      // Redeclaring the cleared handler would apply its new response to the request being matched.
      await promiseIfRemote(handler.respond({ status: 204 }), interceptor);

      restrictionReleasedPromise.resolve();

      await expectFetchError(responsePromise);

      expect(restriction).toHaveBeenCalledTimes(1);
      expect(handler.requests).toHaveLength(0);
      expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
    });
  });
}
