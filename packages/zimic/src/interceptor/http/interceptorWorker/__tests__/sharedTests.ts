import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchWithTimeout } from '@/utils/fetch';

import { HTTP_INTERCEPTOR_METHODS } from '../../interceptor/types/schema';
import type BrowserHttpInterceptorWorker from '../BrowserHttpInterceptorWorker';
import type NodeHttpInterceptorWorker from '../NodeHttpInterceptorWorker';
import { HttpRequestHandler } from '../types';

export function declareSharedHttpInterceptorWorkerTests<
  Worker extends typeof BrowserHttpInterceptorWorker | typeof NodeHttpInterceptorWorker,
>(WorkerClass: Worker) {
  const defaultBaseURL = 'http://localhost:3000';

  let interceptorWorker: BrowserHttpInterceptorWorker | NodeHttpInterceptorWorker | undefined;

  const responseStatus = 200;
  const responseBody = { success: true };

  function requestHandler(..._parameters: Parameters<HttpRequestHandler>): ReturnType<HttpRequestHandler> {
    const response = Response.json(responseBody, { status: responseStatus });
    return { response };
  }

  const spiedRequestHandler = vi.fn(requestHandler);

  beforeEach(() => {
    interceptorWorker?.clearHandlers();
    spiedRequestHandler.mockClear();
  });

  afterEach(() => {
    interceptorWorker?.clearHandlers();
    interceptorWorker?.stop();
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

  describe.each(HTTP_INTERCEPTOR_METHODS)('Method: %s', (method) => {
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

    it(`should intercept ${method} requests after started, considering dynamic routes with a generic match`, async () => {
      interceptorWorker = new WorkerClass({ baseURL: defaultBaseURL });

      await interceptorWorker.start();
      interceptorWorker.use(method, '/path/:id', spiedRequestHandler);

      expect(spiedRequestHandler).not.toHaveBeenCalled();

      const response = await fetch(`${defaultBaseURL}/path/${1}`, { method });

      expect(spiedRequestHandler).toHaveBeenCalledTimes(1);

      const [callContext] = spiedRequestHandler.mock.calls[0];
      expect(callContext.request).toBeInstanceOf(Request);
      expect(callContext.request.method).toBe(method);
      expect(callContext.params).toEqual({ id: '1' });
      expect(callContext.cookies).toEqual({});

      expect(response.status).toBe(200);

      const body = (await response.json()) as typeof responseBody;
      expect(body).toEqual(responseBody);
    });

    it(`should intercept ${method} requests after started, considering dynamic routes with a specific match`, async () => {
      interceptorWorker = new WorkerClass({ baseURL: defaultBaseURL });

      await interceptorWorker.start();
      interceptorWorker.use(method, `/path/${1}`, spiedRequestHandler);

      expect(spiedRequestHandler).not.toHaveBeenCalled();

      const matchedResponse = await fetch(`${defaultBaseURL}/path/${1}`, { method });

      expect(spiedRequestHandler).toHaveBeenCalledTimes(1);

      const [matchedCallContext] = spiedRequestHandler.mock.calls[0];
      expect(matchedCallContext.request).toBeInstanceOf(Request);
      expect(matchedCallContext.request.method).toBe(method);
      expect(matchedCallContext.params).toEqual({});
      expect(matchedCallContext.cookies).toEqual({});

      expect(matchedResponse.status).toBe(200);

      const matchedBody = (await matchedResponse.json()) as typeof responseBody;
      expect(matchedBody).toEqual(responseBody);

      spiedRequestHandler.mockClear();

      const unmatchedResponsePromise = fetch(`${defaultBaseURL}/path/${2}`, { method });
      await expect(unmatchedResponsePromise).rejects.toThrowError();

      expect(spiedRequestHandler).toHaveBeenCalledTimes(0);
    });

    it(`should not intercept bypassed ${method} requests`, async () => {
      interceptorWorker = new WorkerClass({ baseURL: defaultBaseURL });
      await interceptorWorker.start();

      const bypassedSpiedRequestHandler = vi.fn(requestHandler).mockImplementation(() => ({ bypass: true }));

      interceptorWorker.use(method, '/path', bypassedSpiedRequestHandler);

      expect(bypassedSpiedRequestHandler).not.toHaveBeenCalled();

      const fetchPromise = fetch(`${defaultBaseURL}/path`, { method });
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

    it(`should not intercept ${method} requests having no handler after cleared`, async () => {
      interceptorWorker = new WorkerClass({ baseURL: defaultBaseURL });
      await interceptorWorker.start();

      interceptorWorker.use(method, '/path', spiedRequestHandler);
      interceptorWorker.clearHandlers();

      const fetchPromise = fetchWithTimeout(`${defaultBaseURL}/path`, { method, timeout: 500 });
      await expect(fetchPromise).rejects.toThrowError();

      expect(spiedRequestHandler).not.toHaveBeenCalled();

      interceptorWorker.use(method, '/path', spiedRequestHandler);

      expect(spiedRequestHandler).not.toHaveBeenCalled();

      const response = await fetch(`${defaultBaseURL}/path`, { method });

      expect(spiedRequestHandler).toHaveBeenCalledTimes(1);

      const [callContext] = spiedRequestHandler.mock.calls[0];
      expect(callContext.request).toBeInstanceOf(Request);
      expect(callContext.request.method).toBe(method);
      expect(callContext.params).toEqual({});
      expect(callContext.cookies).toEqual({});

      expect(response.status).toBe(200);

      const body = (await response.json()) as typeof responseBody;
      expect(body).toEqual(responseBody);
    });
  });
}
