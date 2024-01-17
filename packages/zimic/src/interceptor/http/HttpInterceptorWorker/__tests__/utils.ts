import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HTTP_INTERCEPTOR_METHOD } from '../../HttpInterceptor/types/schema';
import BrowserHttpInterceptorWorker from '../BrowserHttpInterceptorWorker';
import NodeHttpInterceptorWorker from '../NodeHttpInterceptorWorker';
import { HttpRequestHandlerContext } from '../types';

export function createHttpInterceptorWorkerTests<
  Worker extends typeof BrowserHttpInterceptorWorker | typeof NodeHttpInterceptorWorker,
>(WorkerClass: Worker) {
  const defaultBaseURL = 'http://localhost:3000';

  describe.each(HTTP_INTERCEPTOR_METHOD)('Method: %s', (method) => {
    let interceptorWorker: BrowserHttpInterceptorWorker | NodeHttpInterceptorWorker;

    const responseStatus = 200;
    const responseBody = { success: true };

    function requestHandler(_context: HttpRequestHandlerContext) {
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

    it(`should not intercept ${method} requests before started`, async () => {
      interceptorWorker = new WorkerClass({ baseURL: defaultBaseURL });
      interceptorWorker.use(method, '/path', spiedRequestHandler);

      expect(spiedRequestHandler).not.toHaveBeenCalled();

      const fetchPromise = fetch(`${defaultBaseURL}/path`, { method });
      await expect(fetchPromise).rejects.toThrowError();

      expect(spiedRequestHandler).not.toHaveBeenCalled();
    });

    it(`should not intercept ${method} requests after stopped`, async () => {
      interceptorWorker = new WorkerClass({ baseURL: defaultBaseURL });
      await interceptorWorker.start();

      interceptorWorker.use(method, '/path', spiedRequestHandler);

      expect(spiedRequestHandler).not.toHaveBeenCalled();

      interceptorWorker.stop();

      const abortController = new AbortController();

      const fetchTimeout = 500;
      setTimeout(() => {
        abortController.abort();
      }, fetchTimeout);

      const fetchPromise = fetch(`${defaultBaseURL}/path`, {
        method,
        signal: abortController.signal,
      });
      await expect(fetchPromise).rejects.toThrowError();
    });
  });
}
