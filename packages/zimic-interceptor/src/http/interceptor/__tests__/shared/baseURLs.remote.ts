import { expectFetchError } from '@zimic/utils/fetch';
import { joinURL } from '@zimic/utils/url';
import { beforeEach, expect, it, vi } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { UnhandledRequestStrategy } from '../../types/options';

interface SharedRemoteBaseURLHttpInterceptorTestsOptions {
  getBaseURL: () => string;
}

export function declareRemoteBaseURLHttpInterceptorTests(options: SharedRemoteBaseURLHttpInterceptorTestsOptions) {
  const { getBaseURL } = options;

  const olderAuth = { token: 'older-token' };
  const auth = { token: 'token' };

  let baseURL: string;

  beforeEach(() => {
    baseURL = getBaseURL();
  });

  it('should apply the unhandled request strategy of the last started interceptor if only an older one using another authentication token has a matching handler', async () => {
    const olderOnUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(() => ({
      action: 'reject',
      log: false,
    }));

    const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(() => ({
      action: 'reject',
      log: false,
    }));

    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
    }>(
      { type: 'remote', baseURL, auth: olderAuth, onUnhandledRequest: olderOnUnhandledRequest },
      async (olderInterceptor) => {
        const olderHandler = await olderInterceptor.get('/users').respond({ status: 200 });

        await usingHttpInterceptor<{
          '/posts': { GET: { response: { 200: {} } } };
        }>({ type: 'remote', baseURL, auth, onUnhandledRequest }, async (interceptor) => {
          const handler = await interceptor.get('/posts').respond({ status: 200 });

          await expectFetchError(fetch(joinURL(baseURL, '/users'), { method: 'GET' }));

          expect(handler.requests).toHaveLength(0);
          expect(olderHandler.requests).toHaveLength(0);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(olderOnUnhandledRequest).not.toHaveBeenCalled();
        });
      },
    );
  });

  it('should intercept requests with the last started interceptor if an older one using another authentication token also matches', async () => {
    const olderRestriction = vi.fn(() => true);

    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
    }>({ type: 'remote', baseURL, auth: olderAuth }, async (olderInterceptor) => {
      const olderHandler = await olderInterceptor.get('/users').with(olderRestriction).respond({ status: 200 });

      await usingHttpInterceptor<{
        '/users': { GET: { response: { 204: {} } } };
      }>({ type: 'remote', baseURL, auth }, async (interceptor) => {
        const handler = await interceptor.get('/users').respond({ status: 204 });

        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);
        expect(olderHandler.requests).toHaveLength(0);
        expect(olderRestriction).not.toHaveBeenCalled();
      });
    });
  });

  it('should intercept requests with an older interceptor using another authentication token after the last started one stops', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
    }>({ type: 'remote', baseURL, auth: olderAuth }, async (olderInterceptor) => {
      const olderHandler = await olderInterceptor.get('/users').respond({ status: 200 });

      await usingHttpInterceptor<{
        '/users': { GET: { response: { 204: {} } } };
      }>({ type: 'remote', baseURL, auth }, async (interceptor) => {
        const handler = await interceptor.get('/users').respond({ status: 204 });

        let response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);
        expect(olderHandler.requests).toHaveLength(0);

        await interceptor.stop();

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(200);

        expect(olderHandler.requests).toHaveLength(1);
      });
    });
  });

  it('should intercept requests with an older interceptor using another authentication token after the last started one stops if an interceptor using its authentication token is still running', async () => {
    const otherBaseURL = joinURL(baseURL, 'other');

    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
    }>({ type: 'remote', baseURL, auth: olderAuth }, async (olderInterceptor) => {
      const olderHandler = await olderInterceptor.get('/users').respond({ status: 200 });

      await usingHttpInterceptor<{}>({ type: 'remote', baseURL: otherBaseURL, auth }, async (otherInterceptor) => {
        await usingHttpInterceptor<{
          '/users': { GET: { response: { 204: {} } } };
        }>({ type: 'remote', baseURL, auth }, async (interceptor) => {
          await interceptor.get('/users').respond({ status: 204 });

          let response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(response.status).toBe(204);

          await interceptor.stop();
          expect(otherInterceptor.isRunning).toBe(true);

          response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(response.status).toBe(200);

          expect(olderHandler.requests).toHaveLength(1);
        });
      });
    });
  });

  it('should intercept requests with the last started interceptor after it is cleared and declares its handlers again if an older one uses another authentication token', async () => {
    const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(() => ({
      action: 'reject',
      log: false,
    }));

    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
    }>({ type: 'remote', baseURL, auth: olderAuth }, async (olderInterceptor) => {
      const olderHandler = await olderInterceptor.get('/users').respond({ status: 200 });

      await usingHttpInterceptor<{
        '/users': { GET: { response: { 204: {} } } };
      }>({ type: 'remote', baseURL, auth, onUnhandledRequest }, async (interceptor) => {
        await interceptor.get('/users').respond({ status: 204 });

        await interceptor.clear();

        await expectFetchError(fetch(joinURL(baseURL, '/users'), { method: 'GET' }));

        expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
        expect(olderHandler.requests).toHaveLength(0);

        const handler = await interceptor.get('/users').respond({ status: 204 });

        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);
        expect(olderHandler.requests).toHaveLength(0);
      });
    });
  });

  it('should intercept requests with the last started interceptor after an older one using another authentication token is cleared', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
    }>({ type: 'remote', baseURL, auth: olderAuth }, async (olderInterceptor) => {
      const olderHandler = await olderInterceptor.get('/users').respond({ status: 200 });

      await usingHttpInterceptor<{
        '/users': { GET: { response: { 201: {} } } };
      }>({ type: 'remote', baseURL, auth: olderAuth }, async (otherOlderInterceptor) => {
        await otherOlderInterceptor.get('/users').respond({ status: 201 });

        await usingHttpInterceptor<{
          '/users': { GET: { response: { 204: {} } } };
        }>({ type: 'remote', baseURL, auth }, async (interceptor) => {
          const handler = await interceptor.get('/users').respond({ status: 204 });

          let response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(response.status).toBe(204);

          await otherOlderInterceptor.clear();

          response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(response.status).toBe(204);

          expect(handler.requests).toHaveLength(2);
          expect(olderHandler.requests).toHaveLength(0);
        });
      });
    });
  });

  it('should intercept requests with the last started interceptor after an older one using another authentication token is cleared and declares its handlers again', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
    }>({ type: 'remote', baseURL, auth: olderAuth }, async (olderInterceptor) => {
      await olderInterceptor.get('/users').respond({ status: 200 });

      await usingHttpInterceptor<{
        '/users': { GET: { response: { 204: {} } } };
      }>({ type: 'remote', baseURL, auth }, async (interceptor) => {
        const handler = await interceptor.get('/users').respond({ status: 204 });

        let response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        await olderInterceptor.clear();

        const olderHandler = await olderInterceptor.get('/users').respond({ status: 200 });

        response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(2);
        expect(olderHandler.requests).toHaveLength(0);
      });
    });
  });

  it('should intercept requests with the last started interceptor after an older one using another authentication token declares its handlers later', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
    }>({ type: 'remote', baseURL, auth: olderAuth }, async (olderInterceptor) => {
      await usingHttpInterceptor<{
        '/users': { GET: { response: { 201: {} } } };
      }>({ type: 'remote', baseURL, auth: olderAuth }, async (otherOlderInterceptor) => {
        const otherOlderHandler = await otherOlderInterceptor.get('/users').respond({ status: 201 });

        await usingHttpInterceptor<{
          '/users': { GET: { response: { 204: {} } } };
        }>({ type: 'remote', baseURL, auth }, async (interceptor) => {
          const handler = await interceptor.get('/users').respond({ status: 204 });

          const olderHandler = await olderInterceptor.get('/users').respond({ status: 200 });

          const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
          expect(response.status).toBe(204);

          expect(handler.requests).toHaveLength(1);
          expect(olderHandler.requests).toHaveLength(0);
          expect(otherOlderHandler.requests).toHaveLength(0);
        });
      });
    });
  });

  it('should intercept requests with the last started interceptor after an older one using another authentication token declares more handlers', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
      '/posts': { GET: { response: { 200: {} } } };
    }>({ type: 'remote', baseURL, auth: olderAuth }, async (olderInterceptor) => {
      const olderHandler = await olderInterceptor.get('/users').respond({ status: 200 });

      await usingHttpInterceptor<{
        '/users': { GET: { response: { 204: {} } } };
      }>({ type: 'remote', baseURL, auth }, async (interceptor) => {
        const handler = await interceptor.get('/users').respond({ status: 204 });

        await olderInterceptor.get('/posts').respond({ status: 200 });

        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);
        expect(olderHandler.requests).toHaveLength(0);
      });
    });
  });
}
