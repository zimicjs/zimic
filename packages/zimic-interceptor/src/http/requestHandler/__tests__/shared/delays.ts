import joinURL from '@zimic/utils/url/joinURL';
import { expect, it, beforeAll, afterAll, describe, beforeEach, afterEach } from 'vitest';

import { SharedHttpInterceptorClient } from '@/http/interceptor/HttpInterceptorClient';
import LocalHttpInterceptor from '@/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/http/interceptor/RemoteHttpInterceptor';
import { HttpInterceptorType } from '@/http/interceptor/types/options';
import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { createInternalHttpInterceptor } from '@tests/utils/interceptors';

import type LocalHttpRequestHandler from '../../LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '../../RemoteHttpRequestHandler';
import { SharedHttpRequestHandlerTestOptions, Schema } from './types';

export function declareHttpRequestHandlerDelayTests(
  options: SharedHttpRequestHandlerTestOptions & {
    type: HttpInterceptorType;
    Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;
  },
) {
  const { platform, type, startServer, stopServer, getBaseURL, Handler } = options;

  let baseURL: string;

  let interceptor: LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>;
  let interceptorClient: SharedHttpInterceptorClient<Schema>;

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);

    interceptor = createInternalHttpInterceptor<Schema>({ type, baseURL });
    interceptorClient = interceptor.client as SharedHttpInterceptorClient<Schema>;

    expect(interceptor.platform).toBe(null);

    await interceptor.start();

    expect(interceptor.platform).toBe(platform);
  });

  afterEach(async () => {
    await interceptor.stop();
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  it('should apply a fixed delay before responding', async () => {
    const handler = await promiseIfRemote(
      interceptor.get('/users').delay(100).respond({ status: 200, body: [] }),
      interceptor,
    );

    const startTime = Date.now();
    const response = await fetch(joinURL(baseURL, '/users'));
    const endTime = Date.now();

    expect(response.status).toBe(200);

    const elapsedTime = endTime - startTime;
    expect(elapsedTime).toBeGreaterThanOrEqual(100);
    expect(elapsedTime).toBeLessThan(200);

    expect(handler.requests).toHaveLength(1);
  });

  it('should apply a ranged delay before responding', async () => {
    const handler = await promiseIfRemote(
      interceptor.get('/users').delay({ min: 50, max: 150 }).respond({ status: 200, body: [] }),
      interceptor,
    );

    const startTime = Date.now();
    const response = await fetch(joinURL(baseURL, '/users'));
    const endTime = Date.now();

    expect(response.status).toBe(200);

    const elapsedTime = endTime - startTime;
    expect(elapsedTime).toBeGreaterThanOrEqual(50);
    expect(elapsedTime).toBeLessThan(200);

    expect(handler.requests).toHaveLength(1);
  });

  it('should apply a computed delay before responding', async () => {
    const handler = await promiseIfRemote(
      interceptor
        .get('/users')
        .delay((request) => {
          const url = new URL(request.url);
          return url.searchParams.get('slow') === 'true' ? 100 : 10;
        })
        .respond({ status: 200, body: [] }),
      interceptor,
    );

    const fastStartTime = Date.now();
    const fastResponse = await fetch(joinURL(baseURL, '/users?slow=false'));
    const fastEndTime = Date.now();

    expect(fastResponse.status).toBe(200);

    const fastElapsedTime = fastEndTime - fastStartTime;
    expect(fastElapsedTime).toBeGreaterThanOrEqual(10);
    expect(fastElapsedTime).toBeLessThan(60);

    const slowStartTime = Date.now();
    const slowResponse = await fetch(joinURL(baseURL, '/users?slow=true'));
    const slowEndTime = Date.now();

    expect(slowResponse.status).toBe(200);

    const slowElapsedTime = slowEndTime - slowStartTime;
    expect(slowElapsedTime).toBeGreaterThanOrEqual(100);
    expect(slowElapsedTime).toBeLessThan(200);

    expect(handler.requests).toHaveLength(2);
  });

  it('should apply a computed async delay before responding', async () => {
    const handler = await promiseIfRemote(
      interceptor
        .get('/users')
        .delay(async (request) => {
          const url = new URL(request.url);
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
          return url.searchParams.get('slow') === 'true' ? 100 : 20;
        })
        .respond({ status: 200, body: [] }),
      interceptor,
    );

    const startTime = Date.now();
    const response = await fetch(joinURL(baseURL, '/users?slow=true'));
    const endTime = Date.now();

    expect(response.status).toBe(200);

    const elapsedTime = endTime - startTime;
    expect(elapsedTime).toBeGreaterThanOrEqual(110);
    expect(elapsedTime).toBeLessThan(200);

    expect(handler.requests).toHaveLength(1);
  });

  it('should support delay chaining with respond', async () => {
    const handler = await promiseIfRemote(
      interceptor.get('/users').delay(50).respond({ status: 200, body: [] }),
      interceptor,
    );

    const startTime = Date.now();
    const response = await fetch(joinURL(baseURL, '/users'));
    const endTime = Date.now();

    expect(response.status).toBe(200);

    const elapsedTime = endTime - startTime;
    expect(elapsedTime).toBeGreaterThanOrEqual(50);
    expect(elapsedTime).toBeLessThan(150);

    expect(handler.requests).toHaveLength(1);
  });

  it('should support delay chaining with with', async () => {
    const handler = await promiseIfRemote(
      interceptor
        .get('/users')
        .with({ headers: { accept: 'application/json' } })
        .delay(50)
        .respond({ status: 200, body: [] }),
      interceptor,
    );

    const startTime = Date.now();
    const response = await fetch(joinURL(baseURL, '/users'), { headers: { accept: 'application/json' } });
    const endTime = Date.now();

    expect(response.status).toBe(200);

    const elapsedTime = endTime - startTime;
    expect(elapsedTime).toBeGreaterThanOrEqual(50);
    expect(elapsedTime).toBeLessThan(150);

    expect(handler.requests).toHaveLength(1);
  });

  it('should reset delay when handler is cleared', async () => {
    const handler = new Handler<Schema, 'GET', '/users'>(interceptorClient, 'GET', '/users');

    await promiseIfRemote(handler.delay(100).respond({ status: 200, body: [] }), interceptor);

    let startTime = Date.now();
    let response = await fetch(joinURL(baseURL, '/users'));
    let endTime = Date.now();

    expect(response.status).toBe(200);

    let elapsedTime = endTime - startTime;
    expect(elapsedTime).toBeGreaterThanOrEqual(100);

    await promiseIfRemote(handler.clear(), interceptor);
    await promiseIfRemote(handler.respond({ status: 200, body: [] }), interceptor);

    startTime = Date.now();
    response = await fetch(joinURL(baseURL, '/users'));
    endTime = Date.now();

    expect(response.status).toBe(200);

    elapsedTime = endTime - startTime;
    expect(elapsedTime).toBeLessThan(100);
  });

  it('should support multiple delay declarations (last one wins)', async () => {
    const handler = await promiseIfRemote(
      interceptor.get('/users').delay(200).delay(50).respond({ status: 200, body: [] }),
      interceptor,
    );

    const startTime = Date.now();
    const response = await fetch(joinURL(baseURL, '/users'));
    const endTime = Date.now();

    expect(response.status).toBe(200);

    const elapsedTime = endTime - startTime;
    expect(elapsedTime).toBeGreaterThanOrEqual(50);
    expect(elapsedTime).toBeLessThan(150);

    expect(handler.requests).toHaveLength(1);
  });

  it('should work with computed response handlers', async () => {
    const handler = await promiseIfRemote(
      interceptor
        .get('/users')
        .delay(50)
        .respond(async (request) => {
          const url = new URL(request.url);
          const status = url.searchParams.get('error') === 'true' ? 500 : 200;
          return { status, body: [] };
        }),
      interceptor,
    );

    const startTime = Date.now();
    const response = await fetch(joinURL(baseURL, '/users?error=false'));
    const endTime = Date.now();

    expect(response.status).toBe(200);

    const elapsedTime = endTime - startTime;
    expect(elapsedTime).toBeGreaterThanOrEqual(50);
    expect(elapsedTime).toBeLessThan(150);

    expect(handler.requests).toHaveLength(1);
  });

  describe('edge cases', () => {
    it('should handle zero delay', async () => {
      const handler = await promiseIfRemote(
        interceptor.get('/users').delay(0).respond({ status: 200, body: [] }),
        interceptor,
      );

      const startTime = Date.now();
      const response = await fetch(joinURL(baseURL, '/users'));
      const endTime = Date.now();

      expect(response.status).toBe(200);

      const elapsedTime = endTime - startTime;
      expect(elapsedTime).toBeLessThan(50);

      expect(handler.requests).toHaveLength(1);
    });

    it('should handle ranged delay with same min and max', async () => {
      const handler = await promiseIfRemote(
        interceptor.get('/users').delay({ min: 100, max: 100 }).respond({ status: 200, body: [] }),
        interceptor,
      );

      const startTime = Date.now();
      const response = await fetch(joinURL(baseURL, '/users'));
      const endTime = Date.now();

      expect(response.status).toBe(200);

      const elapsedTime = endTime - startTime;
      expect(elapsedTime).toBeGreaterThanOrEqual(100);
      expect(elapsedTime).toBeLessThan(200);

      expect(handler.requests).toHaveLength(1);
    });

    it('should handle computed delay returning zero', async () => {
      const handler = await promiseIfRemote(
        interceptor
          .get('/users')
          .delay(() => 0)
          .respond({ status: 200, body: [] }),
        interceptor,
      );

      const startTime = Date.now();
      const response = await fetch(joinURL(baseURL, '/users'));
      const endTime = Date.now();

      expect(response.status).toBe(200);

      const elapsedTime = endTime - startTime;
      expect(elapsedTime).toBeLessThan(50);

      expect(handler.requests).toHaveLength(1);
    });
  });
}
