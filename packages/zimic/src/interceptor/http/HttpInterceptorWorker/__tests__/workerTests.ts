import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchWithTimeout } from '@/utils/fetch';

import { HTTP_INTERCEPTOR_METHOD } from '../../HttpInterceptor/types/schema';
import type BrowserHttpInterceptorWorker from '../BrowserHttpInterceptorWorker';
import type NodeHttpInterceptorWorker from '../NodeHttpInterceptorWorker';
import { HttpRequestHandler } from '../types';

export function createHttpInterceptorWorkerTests<
  Worker extends typeof BrowserHttpInterceptorWorker | typeof NodeHttpInterceptorWorker,
>(WorkerClass: Worker) {
  const defaultBaseURL = 'http://localhost:3000';

  describe.each(HTTP_INTERCEPTOR_METHOD)('Method: %s', (method) => {
    let interceptorWorker: BrowserHttpInterceptorWorker | NodeHttpInterceptorWorker;

    const responseStatus = 200;
    const responseBody = { success: true };

    function requestHandler(..._parameters: Parameters<HttpRequestHandler>): ReturnType<HttpRequestHandler> {
      return {
        status: responseStatus,
        body: responseBody,
      };
    }

    const spiedRequestHandler = vi.fn(requestHandler);

    beforeEach(() => {
      spiedRequestHandler.mockClear();
    });

    afterEach(() => {
      interceptorWorker.stop();
    });

    it('should not throw an error when started multiple times', async () => {
      interceptorWorker = new WorkerClass({ baseURL: defaultBaseURL });
      expect(interceptorWorker.isRunning()).toBe(false);
      await interceptorWorker.start();
      expect(interceptorWorker.isRunning()).toBe(true);
      await interceptorWorker.start();
      expect(interceptorWorker.isRunning()).toBe(true);
      await interceptorWorker.start();
      expect(interceptorWorker.isRunning()).toBe(true);
    });

    it('should not throw an error when stopped without running', () => {
      interceptorWorker = new WorkerClass({ baseURL: defaultBaseURL });
      expect(interceptorWorker.isRunning()).toBe(false);
      interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
      interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
      interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
    });

    it('should not throw an error when stopped multiple times while running', async () => {
      interceptorWorker = new WorkerClass({ baseURL: defaultBaseURL });
      expect(interceptorWorker.isRunning()).toBe(false);
      await interceptorWorker.start();
      expect(interceptorWorker.isRunning()).toBe(true);
      interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
      interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
      interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
    });

    it.each([
      { baseURL: `${defaultBaseURL}`, path: 'path' },
      { baseURL: `${defaultBaseURL}/`, path: 'path' },
      { baseURL: `${defaultBaseURL}`, path: '/path' },
      { baseURL: `${defaultBaseURL}/`, path: '/path' },
      { baseURL: `${defaultBaseURL}/api`, path: 'path' },
      { baseURL: `${defaultBaseURL}/api/`, path: 'path' },
      { baseURL: `${defaultBaseURL}/api`, path: '/path' },
      { baseURL: `${defaultBaseURL}/api/`, path: '/path' },
    ])(
      `should intercept ${method} requests after started, considering slashes in the URL: $baseURL and $path`,
      async ({ baseURL, path }) => {
        interceptorWorker = new WorkerClass({ baseURL });
        expect(interceptorWorker.baseURL()).toBe(baseURL);

        await interceptorWorker.start();
        interceptorWorker.use(method, path, spiedRequestHandler);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const url = `${baseURL}/${path}`.replace(/(\w)\/{2,}(\w)/g, '$1/$2');
        const response = await fetch(url, { method });

        expect(spiedRequestHandler).toHaveBeenCalledTimes(1);

        const [callContext] = spiedRequestHandler.mock.calls[0];
        expect(callContext.request).toBeInstanceOf(Request);
        expect(callContext.request.method).toBe(method);
        expect(callContext.params).toEqual({});
        expect(callContext.cookies).toEqual({});

        expect(response.status).toBe(200);

        const body = (await response.json()) as typeof responseBody;
        expect(body).toEqual(responseBody);
      },
    );

    it(`should not intercept bypassed ${method} requests`, async () => {
      interceptorWorker = new WorkerClass({ baseURL: defaultBaseURL });
      await interceptorWorker.start();

      const bypassedSpiedRequestHandler = vi.fn(requestHandler).mockImplementation(() => ({ bypass: true }));

      interceptorWorker.use(method, '/path', bypassedSpiedRequestHandler);

      expect(bypassedSpiedRequestHandler).not.toHaveBeenCalled();

      const fetchPromise = fetchWithTimeout(`${defaultBaseURL}/path`, { method, timeout: 500 });
      await expect(fetchPromise).rejects.toThrowError();

      expect(bypassedSpiedRequestHandler).toHaveBeenCalledTimes(1);

      const [callContext] = bypassedSpiedRequestHandler.mock.calls[0];
      expect(callContext.request).toBeInstanceOf(Request);
      expect(callContext.request.method).toBe(method);
      expect(callContext.params).toEqual({});
      expect(callContext.cookies).toEqual({});
    });

    it(`should not intercept ${method} requests before started`, async () => {
      interceptorWorker = new WorkerClass({ baseURL: defaultBaseURL });
      interceptorWorker.use(method, '/path', spiedRequestHandler);

      expect(spiedRequestHandler).not.toHaveBeenCalled();

      const fetchPromise = fetchWithTimeout(`${defaultBaseURL}/path`, { method, timeout: 500 });
      await expect(fetchPromise).rejects.toThrowError();

      expect(spiedRequestHandler).not.toHaveBeenCalled();
    });

    it(`should not intercept ${method} requests after stopped`, async () => {
      interceptorWorker = new WorkerClass({ baseURL: defaultBaseURL });
      await interceptorWorker.start();

      interceptorWorker.use(method, '/path', spiedRequestHandler);

      interceptorWorker.stop();

      const fetchPromise = fetchWithTimeout(`${defaultBaseURL}/path`, { method, timeout: 500 });
      await expect(fetchPromise).rejects.toThrowError();

      expect(spiedRequestHandler).not.toHaveBeenCalled();
    });
  });
}
