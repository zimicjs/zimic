import { HttpRequest, HttpResponse } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { expect, vi, it, beforeAll, afterAll, describe, beforeEach, afterEach } from 'vitest';

import { SharedHttpInterceptorClient } from '@/http/interceptor/HttpInterceptorClient';
import LocalHttpInterceptor from '@/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/http/interceptor/RemoteHttpInterceptor';
import { HttpInterceptorType } from '@/http/interceptor/types/options';
import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { createInternalHttpInterceptor } from '@tests/utils/interceptors';

import type LocalHttpRequestHandler from '../../LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '../../RemoteHttpRequestHandler';
import { SharedHttpRequestHandlerTestOptions, Schema } from './types';

export function declareDelayHttpRequestHandlerTests(
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
    await interceptor.start();
  });

  afterEach(async () => {
    await interceptor.stop();
  });

  afterAll(async () => {
    await stopServer?.();
  });

  describe('delay()', () => {
    it('should support fixed delay', async () => {
      const handler = interceptor.get('/users').delay(100).respond({ status: 200, body: [] });

      const startTime = Date.now();
      const response = await fetch(joinURL(baseURL, '/users'));
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some tolerance
      expect(endTime - startTime).toBeLessThan(200); // Should not be too much longer
    });

    it('should support ranged delay', async () => {
      const handler = interceptor.get('/users').delay([100, 200]).respond({ status: 200, body: [] });

      const startTime = Date.now();
      const response = await fetch(joinURL(baseURL, '/users'));
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some tolerance
      expect(endTime - startTime).toBeLessThan(300); // Should not be too much longer
    });

    it('should support function-based delay', async () => {
      const delaySpy = vi.fn((request: HttpRequest) => {
        return request.url.includes('slow=true') ? 100 : 0;
      });

      const handler = interceptor.get('/users').delay(delaySpy).respond({ status: 200, body: [] });

      // Test with slow=true query param
      const startTime = Date.now();
      const response = await fetch(joinURL(baseURL, '/users?slow=true'));
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(delaySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('slow=true'),
        }),
      );
      expect(endTime - startTime).toBeGreaterThanOrEqual(90);

      // Test without slow=true query param
      const startTime2 = Date.now();
      const response2 = await fetch(joinURL(baseURL, '/users'));
      const endTime2 = Date.now();

      expect(response2.status).toBe(200);
      expect(delaySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.not.stringContaining('slow=true'),
        }),
      );
      expect(endTime2 - startTime2).toBeLessThan(50); // Should be fast
    });

    it('should support async function-based delay', async () => {
      const delaySpy = vi.fn(async (request: HttpRequest) => {
        await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay to test async
        return request.url.includes('slow=true') ? 100 : 0;
      });

      const handler = interceptor.get('/users').delay(delaySpy).respond({ status: 200, body: [] });

      const startTime = Date.now();
      const response = await fetch(joinURL(baseURL, '/users?slow=true'));
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(delaySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('slow=true'),
        }),
      );
      expect(endTime - startTime).toBeGreaterThanOrEqual(100); // 10ms async + 100ms delay
    });

    it('should support zero delay', async () => {
      const handler = interceptor.get('/users').delay(0).respond({ status: 200, body: [] });

      const startTime = Date.now();
      const response = await fetch(joinURL(baseURL, '/users'));
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(50); // Should be fast
    });

    it('should support negative delay (treated as zero)', async () => {
      const handler = interceptor.get('/users').delay(-100).respond({ status: 200, body: [] });

      const startTime = Date.now();
      const response = await fetch(joinURL(baseURL, '/users'));
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(50); // Should be fast
    });

    it('should work with multiple requests', async () => {
      const handler = interceptor.get('/users').delay(50).respond({ status: 200, body: [] });

      const startTime = Date.now();
      const [response1, response2] = await Promise.all([
        fetch(joinURL(baseURL, '/users')),
        fetch(joinURL(baseURL, '/users')),
      ]);
      const endTime = Date.now();

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(endTime - startTime).toBeGreaterThanOrEqual(40); // Both should be delayed
      expect(endTime - startTime).toBeLessThan(150); // But not too much longer
    });

    it('should work with different HTTP methods', async () => {
      const getHandler = interceptor.get('/users').delay(50).respond({ status: 200, body: [] });
      const postHandler = interceptor
        .post('/users')
        .delay(100)
        .respond({ status: 201, body: { id: 1 } });

      const startTime = Date.now();
      const [getResponse, postResponse] = await Promise.all([
        fetch(joinURL(baseURL, '/users')),
        fetch(joinURL(baseURL, '/users'), { method: 'POST', body: JSON.stringify({ name: 'John' }) }),
      ]);
      const endTime = Date.now();

      expect(getResponse.status).toBe(200);
      expect(postResponse.status).toBe(201);
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Both should be delayed
    });

    it('should work with restrictions', async () => {
      const handler = interceptor
        .get('/users')
        .with({ headers: { 'X-Test': 'true' } })
        .delay(50)
        .respond({ status: 200, body: [] });

      const startTime = Date.now();
      const response = await fetch(joinURL(baseURL, '/users'), {
        headers: { 'X-Test': 'true' },
      });
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeGreaterThanOrEqual(40);
    });

    it('should work with times()', async () => {
      const handler = interceptor.get('/users').times(2).delay(50).respond({ status: 200, body: [] });

      const startTime = Date.now();
      const [response1, response2] = await Promise.all([
        fetch(joinURL(baseURL, '/users')),
        fetch(joinURL(baseURL, '/users')),
      ]);
      const endTime = Date.now();

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(endTime - startTime).toBeGreaterThanOrEqual(40);
    });

    it('should be cleared when clear() is called', async () => {
      const handler = interceptor.get('/users').delay(100).respond({ status: 200, body: [] });

      // Clear the handler
      handler.clear();

      // Reconfigure without delay
      handler.respond({ status: 200, body: [] });

      const startTime = Date.now();
      const response = await fetch(joinURL(baseURL, '/users'));
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(50); // Should be fast without delay
    });

    it('should work with computed response handlers', async () => {
      const handler = interceptor
        .get('/users')
        .delay(50)
        .respond(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10)); // Additional delay in response
          return { status: 200, body: [] };
        });

      const startTime = Date.now();
      const response = await fetch(joinURL(baseURL, '/users'));
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeGreaterThanOrEqual(50); // Should include both delays
    });

    it('should work with different delay types in sequence', async () => {
      const handler = interceptor
        .get('/users')
        .delay(50)
        .delay(30) // Second delay should override the first
        .respond({ status: 200, body: [] });

      const startTime = Date.now();
      const response = await fetch(joinURL(baseURL, '/users'));
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeGreaterThanOrEqual(20); // Should use the second delay
      expect(endTime - startTime).toBeLessThan(100); // Should not be too much longer
    });
  });
}
