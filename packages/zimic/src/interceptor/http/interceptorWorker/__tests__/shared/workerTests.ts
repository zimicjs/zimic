import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHttpInterceptor } from '@/interceptor/http/interceptor/factory';
import { fetchWithTimeout } from '@/utils/fetch';
import { waitForDelay } from '@/utils/time';

import { HTTP_INTERCEPTOR_METHODS, HttpInterceptorSchema } from '../../../interceptor/types/schema';
import InvalidHttpInterceptorWorkerPlatform from '../../errors/InvalidHttpInterceptorWorkerPlatform';
import NotStartedHttpInterceptorWorkerError from '../../errors/NotStartedHttpInterceptorWorkerError';
import OtherHttpInterceptorWorkerRunningError from '../../errors/OtherHttpInterceptorWorkerRunningError';
import { createHttpInterceptorWorker } from '../../factory';
import HttpInterceptorWorker from '../../HttpInterceptorWorker';
import { HttpInterceptorWorkerPlatform } from '../../types/options';
import { HttpRequestHandler } from '../../types/requests';

export function declareSharedHttpInterceptorWorkerTests(options: { platform: HttpInterceptorWorkerPlatform }) {
  const { platform } = options;

  describe('Shared', () => {
    const baseURL = 'http://localhost:3000';

    let interceptorWorker: HttpInterceptorWorker | undefined;

    const responseStatus = 200;
    const responseBody = { success: true };

    function requestHandler(..._parameters: Parameters<HttpRequestHandler>): ReturnType<HttpRequestHandler> {
      const response = Response.json(responseBody, { status: responseStatus });
      return { response };
    }

    const spiedRequestHandler = vi.fn(requestHandler);

    function createDefaultHttpInterceptor(worker: HttpInterceptorWorker) {
      return createHttpInterceptor<HttpInterceptorSchema>({
        worker,
        baseURL,
      });
    }

    beforeEach(() => {
      interceptorWorker?.clearHandlers();
      spiedRequestHandler.mockClear();
    });

    afterEach(async () => {
      await interceptorWorker?.stop();
    });

    it('should initialize using the correct MSW server/worker', async () => {
      interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
      expect(interceptorWorker.platform()).toBe(platform);

      expect(interceptorWorker).toBeInstanceOf(HttpInterceptorWorker);

      await interceptorWorker.start();

      expect(interceptorWorker.hasInternalBrowserWorker()).toBe(platform === 'browser');
      expect(interceptorWorker.hasInternalNodeWorker()).toBe(platform === 'node');
    });

    it('should thrown an error if an invalid platform is provided', () => {
      // @ts-expect-error
      const invalidPlatform: HttpInterceptorWorkerPlatform = 'invalid';

      expect(() => {
        createHttpInterceptorWorker({ platform: invalidPlatform });
      }).toThrowError(InvalidHttpInterceptorWorkerPlatform);
    });

    it('should not throw an error when started multiple times', async () => {
      interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
      expect(interceptorWorker.isRunning()).toBe(false);
      await interceptorWorker.start();
      expect(interceptorWorker.isRunning()).toBe(true);
      await interceptorWorker.start();
      expect(interceptorWorker.isRunning()).toBe(true);
      await interceptorWorker.start();
      expect(interceptorWorker.isRunning()).toBe(true);
    });

    it('should not throw an error when stopped without running', async () => {
      interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
      expect(interceptorWorker.isRunning()).toBe(false);
      await interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
      await interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
      await interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
    });

    it('should not throw an error when stopped multiple times while running', async () => {
      interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
      expect(interceptorWorker.isRunning()).toBe(false);
      await interceptorWorker.start();
      expect(interceptorWorker.isRunning()).toBe(true);
      await interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
      await interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
      await interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
    });

    it('should throw an error if multiple workers are started at the same time', async () => {
      interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
      expect(interceptorWorker.isRunning()).toBe(false);

      const otherInterceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
      expect(otherInterceptorWorker.isRunning()).toBe(false);

      await interceptorWorker.start();
      expect(interceptorWorker.isRunning()).toBe(true);

      await expect(otherInterceptorWorker.start()).rejects.toThrowError(new OtherHttpInterceptorWorkerRunningError());
      expect(otherInterceptorWorker.isRunning()).toBe(false);

      await interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);

      try {
        await otherInterceptorWorker.start();
        expect(otherInterceptorWorker.isRunning()).toBe(true);

        await expect(interceptorWorker.start()).rejects.toThrowError(new OtherHttpInterceptorWorkerRunningError());
        expect(interceptorWorker.isRunning()).toBe(false);
      } finally {
        await otherInterceptorWorker.stop();
      }
    });

    describe.each(HTTP_INTERCEPTOR_METHODS)('Method: %s', (method) => {
      it(`should intercept ${method} requests after started`, async () => {
        interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
        await interceptorWorker.start();

        const interceptor = createDefaultHttpInterceptor(interceptorWorker);
        const url = `${baseURL}/path`;
        interceptorWorker.use(interceptor, method, url, spiedRequestHandler);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const response = await fetch(url, { method });

        expect(spiedRequestHandler).toHaveBeenCalledTimes(1);

        const [handlerContext] = spiedRequestHandler.mock.calls[0];
        expect(handlerContext.request).toBeInstanceOf(Request);
        expect(handlerContext.request.method).toBe(method);
        expect(handlerContext.params).toEqual({});
        expect(handlerContext.cookies).toEqual({});

        expect(response.status).toBe(200);

        const body = (await response.json()) as typeof responseBody;
        expect(body).toEqual(responseBody);
      });

      it(`should intercept ${method} requests after started, considering dynamic paths with a generic match`, async () => {
        interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
        await interceptorWorker.start();

        const interceptor = createDefaultHttpInterceptor(interceptorWorker);
        interceptorWorker.use(interceptor, method, `${baseURL}/path/:id`, spiedRequestHandler);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const response = await fetch(`${baseURL}/path/${1}`, { method });

        expect(spiedRequestHandler).toHaveBeenCalledTimes(1);

        const [handlerContext] = spiedRequestHandler.mock.calls[0];
        expect(handlerContext.request).toBeInstanceOf(Request);
        expect(handlerContext.request.method).toBe(method);
        expect(handlerContext.params).toEqual({ id: '1' });
        expect(handlerContext.cookies).toEqual({});

        expect(response.status).toBe(200);

        const body = (await response.json()) as typeof responseBody;
        expect(body).toEqual(responseBody);
      });

      it(`should intercept ${method} requests after started, considering dynamic paths with a specific match`, async () => {
        interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
        await interceptorWorker.start();

        const interceptor = createDefaultHttpInterceptor(interceptorWorker);
        interceptorWorker.use(interceptor, method, `${baseURL}/path/${1}`, spiedRequestHandler);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const matchedResponse = await fetch(`${baseURL}/path/${1}`, { method });
        expect(matchedResponse.status).toBe(200);

        const matchedBody = (await matchedResponse.json()) as typeof responseBody;
        expect(matchedBody).toEqual(responseBody);

        expect(spiedRequestHandler).toHaveBeenCalledTimes(1);

        const [matchedCallContext] = spiedRequestHandler.mock.calls[0];
        expect(matchedCallContext.request).toBeInstanceOf(Request);
        expect(matchedCallContext.request.method).toBe(method);
        expect(matchedCallContext.params).toEqual({});
        expect(matchedCallContext.cookies).toEqual({});

        spiedRequestHandler.mockClear();

        const unmatchedResponsePromise = fetch(`${baseURL}/path/${2}`, { method });
        await expect(unmatchedResponsePromise).rejects.toThrowError();

        expect(spiedRequestHandler).toHaveBeenCalledTimes(0);
      });

      it(`should not intercept bypassed ${method} requests`, async () => {
        interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
        await interceptorWorker.start();

        const interceptor = createDefaultHttpInterceptor(interceptorWorker);
        const bypassedSpiedRequestHandler = vi.fn(requestHandler).mockImplementation(() => ({ bypass: true }));

        interceptorWorker.use(interceptor, method, `${baseURL}/path`, bypassedSpiedRequestHandler);

        expect(bypassedSpiedRequestHandler).not.toHaveBeenCalled();

        const fetchPromise = fetch(`${baseURL}/path`, { method });
        await expect(fetchPromise).rejects.toThrowError();

        expect(bypassedSpiedRequestHandler).toHaveBeenCalledTimes(1);

        const [handlerContext] = bypassedSpiedRequestHandler.mock.calls[0];
        expect(handlerContext.request).toBeInstanceOf(Request);
        expect(handlerContext.request.method).toBe(method);
        expect(handlerContext.params).toEqual({});
        expect(handlerContext.cookies).toEqual({});
      });

      it(`should support intercepting ${method} requests with a delay`, async () => {
        interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
        await interceptorWorker.start();

        const interceptor = createDefaultHttpInterceptor(interceptorWorker);
        const delayedSpiedRequestHandler = vi.fn(requestHandler).mockImplementation(async (context) => {
          await waitForDelay(100);
          return requestHandler(context);
        });

        interceptorWorker.use(interceptor, method, `${baseURL}/path`, delayedSpiedRequestHandler);

        expect(delayedSpiedRequestHandler).not.toHaveBeenCalled();

        let fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 50 });
        await expect(fetchPromise).rejects.toThrowError();

        fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expect(fetchPromise).resolves.toBeInstanceOf(Response);

        expect(delayedSpiedRequestHandler).toHaveBeenCalledTimes(2);

        for (const [handlerContext] of delayedSpiedRequestHandler.mock.calls) {
          expect(handlerContext.request).toBeInstanceOf(Request);
          expect(handlerContext.request.method).toBe(method);
          expect(handlerContext.params).toEqual({});
          expect(handlerContext.cookies).toEqual({});
        }
      });

      it(`should not intercept ${method} requests before started`, async () => {
        interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;

        const interceptor = createDefaultHttpInterceptor(interceptorWorker);
        expect(() => {
          interceptorWorker?.use(interceptor, method, `${baseURL}/path`, spiedRequestHandler);
        }).toThrowError(Error);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expect(fetchPromise).rejects.toThrowError();

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });

      it(`should not intercept ${method} requests after stopped`, async () => {
        interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
        await interceptorWorker.start();

        const interceptor = createDefaultHttpInterceptor(interceptorWorker);
        interceptorWorker.use(interceptor, method, `${baseURL}/path`, spiedRequestHandler);

        await interceptorWorker.stop();

        const fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expect(fetchPromise).rejects.toThrowError();

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });

      it(`should clear all ${method} handlers after stopped`, async () => {
        interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
        await interceptorWorker.start();

        const interceptor = createDefaultHttpInterceptor(interceptorWorker);
        interceptorWorker.use(interceptor, method, `${baseURL}/path`, spiedRequestHandler);

        await interceptorWorker.stop();
        await interceptorWorker.start();

        const fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expect(fetchPromise).rejects.toThrowError();

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });

      it(`should not intercept ${method} requests having no handler after cleared`, async () => {
        interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
        await interceptorWorker.start();

        const interceptor = createDefaultHttpInterceptor(interceptorWorker);
        interceptorWorker.use(interceptor, method, `${baseURL}/path`, spiedRequestHandler);

        interceptorWorker.clearHandlers();

        const fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expect(fetchPromise).rejects.toThrowError();

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        interceptorWorker.use(interceptor, method, `${baseURL}/path`, spiedRequestHandler);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const response = await fetch(`${baseURL}/path`, { method });

        expect(spiedRequestHandler).toHaveBeenCalledTimes(1);

        const [handlerContext] = spiedRequestHandler.mock.calls[0];
        expect(handlerContext.request).toBeInstanceOf(Request);
        expect(handlerContext.request.method).toBe(method);
        expect(handlerContext.params).toEqual({});
        expect(handlerContext.cookies).toEqual({});

        expect(response.status).toBe(200);

        const body = (await response.json()) as typeof responseBody;
        expect(body).toEqual(responseBody);
      });

      it(`should not intercept ${method} requests handled by a cleared interceptor`, async () => {
        interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;
        await interceptorWorker.start();

        const okSpiedRequestHandler = vi.fn(spiedRequestHandler).mockImplementation(() => {
          const response = new Response(null, { status: 200 });
          return { response };
        });
        const noContentSpiedRequestHandler = vi.fn(spiedRequestHandler).mockImplementation(() => {
          const response = new Response(null, { status: 204 });
          return { response };
        });

        const interceptor = createDefaultHttpInterceptor(interceptorWorker);
        interceptorWorker.use(interceptor, method, `${baseURL}/path`, okSpiedRequestHandler);

        let interceptorsWithHandlers = interceptorWorker.interceptorsWithHandlers();
        expect(interceptorsWithHandlers).toHaveLength(1);
        expect(interceptorsWithHandlers[0]).toBe(interceptor);

        let response = await fetch(`${baseURL}/path`, { method });
        expect(response.status).toBe(200);

        expect(okSpiedRequestHandler).toHaveBeenCalledTimes(1);
        expect(noContentSpiedRequestHandler).toHaveBeenCalledTimes(0);

        let [okHandlerContext] = okSpiedRequestHandler.mock.calls[0];
        expect(okHandlerContext.request).toBeInstanceOf(Request);
        expect(okHandlerContext.request.method).toBe(method);
        expect(okHandlerContext.params).toEqual({});
        expect(okHandlerContext.cookies).toEqual({});

        const otherInterceptor = createDefaultHttpInterceptor(interceptorWorker);
        interceptorWorker.use(otherInterceptor, method, `${baseURL}/path`, noContentSpiedRequestHandler);

        interceptorsWithHandlers = interceptorWorker.interceptorsWithHandlers();
        expect(interceptorsWithHandlers).toHaveLength(2);
        expect(interceptorsWithHandlers[0]).toBe(interceptor);
        expect(interceptorsWithHandlers[1]).toBe(otherInterceptor);

        response = await fetch(`${baseURL}/path`, { method });
        expect(response.status).toBe(204);

        expect(okSpiedRequestHandler).toHaveBeenCalledTimes(1);
        expect(noContentSpiedRequestHandler).toHaveBeenCalledTimes(1);

        const [noContentHandlerContext] = noContentSpiedRequestHandler.mock.calls[0];
        expect(noContentHandlerContext.request).toBeInstanceOf(Request);
        expect(noContentHandlerContext.request.method).toBe(method);
        expect(noContentHandlerContext.params).toEqual({});
        expect(noContentHandlerContext.cookies).toEqual({});

        interceptorWorker.clearInterceptorHandlers(otherInterceptor);

        interceptorsWithHandlers = interceptorWorker.interceptorsWithHandlers();
        expect(interceptorsWithHandlers).toHaveLength(1);
        expect(interceptorsWithHandlers[0]).toBe(interceptor);

        response = await fetch(`${baseURL}/path`, { method });
        expect(response.status).toBe(200);

        expect(okSpiedRequestHandler).toHaveBeenCalledTimes(2);
        expect(noContentSpiedRequestHandler).toHaveBeenCalledTimes(1);

        [okHandlerContext] = okSpiedRequestHandler.mock.calls[1];
        expect(okHandlerContext.request).toBeInstanceOf(Request);
        expect(okHandlerContext.request.method).toBe(method);
        expect(okHandlerContext.params).toEqual({});
        expect(okHandlerContext.cookies).toEqual({});

        interceptorWorker.clearInterceptorHandlers(interceptor);

        interceptorsWithHandlers = interceptorWorker.interceptorsWithHandlers();
        expect(interceptorsWithHandlers).toHaveLength(0);

        const fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expect(fetchPromise).rejects.toThrowError();

        expect(okSpiedRequestHandler).toHaveBeenCalledTimes(2);
        expect(noContentSpiedRequestHandler).toHaveBeenCalledTimes(1);
      });

      it(`should thrown an error if trying to apply a ${method} handler before started`, () => {
        interceptorWorker = createHttpInterceptorWorker({ platform }) as HttpInterceptorWorker;

        const interceptor = createDefaultHttpInterceptor(interceptorWorker);
        expect(() => {
          interceptorWorker?.use(interceptor, method, `${baseURL}/path`, spiedRequestHandler);
        }).toThrowError(NotStartedHttpInterceptorWorkerError);
      });
    });
  });
}
