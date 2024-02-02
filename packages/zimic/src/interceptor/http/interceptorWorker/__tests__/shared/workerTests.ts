import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchWithTimeout } from '@/utils/fetch';
import { waitForDelay } from '@/utils/time';

import { HTTP_INTERCEPTOR_METHODS } from '../../../interceptor/types/schema';
import InvalidHttpInterceptorWorkerPlatform from '../../errors/InvalidHttpInterceptorWorkerPlatform';
import NotStartedHttpInterceptorWorkerError from '../../errors/NotStartedHttpInterceptorWorkerError';
import OtherHttpInterceptorWorkerRunningError from '../../errors/OtherHttpInterceptorWorkerRunningError';
import InternalHttpInterceptorWorker from '../../InternalHttpInterceptorWorker';
import { HttpInterceptorWorkerPlatform } from '../../types/options';
import { HttpRequestHandler } from '../../types/requests';

export function declareSharedHttpInterceptorWorkerTests(options: { platform: HttpInterceptorWorkerPlatform }) {
  const { platform } = options;

  describe('Shared', () => {
    const baseURL = 'http://localhost:3000';

    let interceptorWorker: InternalHttpInterceptorWorker | undefined;

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

    afterEach(async () => {
      await interceptorWorker?.stop();
    });

    it('should initialize using the correct MSW server/worker', async () => {
      interceptorWorker = new InternalHttpInterceptorWorker({ platform });
      expect(interceptorWorker.platform()).toBe(platform);

      expect(interceptorWorker).toBeInstanceOf(InternalHttpInterceptorWorker);

      await interceptorWorker.start();

      expect(interceptorWorker.hasInternalBrowserWorker()).toBe(platform === 'browser');
      expect(interceptorWorker.hasInternalNodeWorker()).toBe(platform === 'node');
    });

    it('should thrown an error if an invalid platform is provided', () => {
      // @ts-expect-error
      const invalidPlatform: HttpInterceptorWorkerPlatform = 'invalid';

      expect(() => {
        new InternalHttpInterceptorWorker({ platform: invalidPlatform });
      }).toThrowError(InvalidHttpInterceptorWorkerPlatform);
    });

    it('should not throw an error when started multiple times', async () => {
      interceptorWorker = new InternalHttpInterceptorWorker({ platform });
      expect(interceptorWorker.isRunning()).toBe(false);
      await interceptorWorker.start();
      expect(interceptorWorker.isRunning()).toBe(true);
      await interceptorWorker.start();
      expect(interceptorWorker.isRunning()).toBe(true);
      await interceptorWorker.start();
      expect(interceptorWorker.isRunning()).toBe(true);
    });

    it('should not throw an error when stopped without running', async () => {
      interceptorWorker = new InternalHttpInterceptorWorker({ platform });
      expect(interceptorWorker.isRunning()).toBe(false);
      await interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
      await interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
      await interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);
    });

    it('should not throw an error when stopped multiple times while running', async () => {
      interceptorWorker = new InternalHttpInterceptorWorker({ platform });
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
      interceptorWorker = new InternalHttpInterceptorWorker({ platform });
      expect(interceptorWorker.isRunning()).toBe(false);

      const otherInterceptorWorker = new InternalHttpInterceptorWorker({ platform });
      expect(otherInterceptorWorker.isRunning()).toBe(false);

      await interceptorWorker.start();
      expect(interceptorWorker.isRunning()).toBe(true);

      await expect(otherInterceptorWorker.start()).rejects.toThrowError(OtherHttpInterceptorWorkerRunningError);
      expect(otherInterceptorWorker.isRunning()).toBe(false);

      await interceptorWorker.stop();
      expect(interceptorWorker.isRunning()).toBe(false);

      try {
        await otherInterceptorWorker.start();
        expect(otherInterceptorWorker.isRunning()).toBe(true);

        await expect(interceptorWorker.start()).rejects.toThrowError(OtherHttpInterceptorWorkerRunningError);
        expect(interceptorWorker.isRunning()).toBe(false);
      } finally {
        await otherInterceptorWorker.stop();
      }
    });

    describe.each(HTTP_INTERCEPTOR_METHODS)('Method: %s', (method) => {
      it(`should intercept ${method} requests after started`, async () => {
        interceptorWorker = new InternalHttpInterceptorWorker({ platform });
        await interceptorWorker.start();

        const url = `${baseURL}/path`;
        interceptorWorker.use(method, url, spiedRequestHandler);

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

      it(`should intercept ${method} requests after started, considering dynamic routes with a generic match`, async () => {
        interceptorWorker = new InternalHttpInterceptorWorker({ platform });

        await interceptorWorker.start();
        interceptorWorker.use(method, `${baseURL}/path/:id`, spiedRequestHandler);

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

      it(`should intercept ${method} requests after started, considering dynamic routes with a specific match`, async () => {
        interceptorWorker = new InternalHttpInterceptorWorker({ platform });

        await interceptorWorker.start();
        interceptorWorker.use(method, `${baseURL}/path/${1}`, spiedRequestHandler);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const matchedResponse = await fetch(`${baseURL}/path/${1}`, { method });

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

        const unmatchedResponsePromise = fetch(`${baseURL}/path/${2}`, { method });
        await expect(unmatchedResponsePromise).rejects.toThrowError();

        expect(spiedRequestHandler).toHaveBeenCalledTimes(0);
      });

      it(`should not intercept bypassed ${method} requests`, async () => {
        interceptorWorker = new InternalHttpInterceptorWorker({ platform });
        await interceptorWorker.start();

        const bypassedSpiedRequestHandler = vi.fn(requestHandler).mockImplementation(() => ({ bypass: true }));

        interceptorWorker.use(method, `${baseURL}/path`, bypassedSpiedRequestHandler);

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
        interceptorWorker = new InternalHttpInterceptorWorker({ platform });
        await interceptorWorker.start();

        const delayedSpiedRequestHandler = vi.fn(requestHandler).mockImplementation(async (context) => {
          await waitForDelay(100);
          return requestHandler(context);
        });

        interceptorWorker.use(method, `${baseURL}/path`, delayedSpiedRequestHandler);

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
        interceptorWorker = new InternalHttpInterceptorWorker({ platform });

        expect(() => {
          interceptorWorker?.use(method, `${baseURL}/path`, spiedRequestHandler);
        }).toThrowError(Error);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expect(fetchPromise).rejects.toThrowError();

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });

      it(`should not intercept ${method} requests after stopped`, async () => {
        interceptorWorker = new InternalHttpInterceptorWorker({ platform });
        await interceptorWorker.start();

        interceptorWorker.use(method, `${baseURL}/path`, spiedRequestHandler);

        await interceptorWorker.stop();

        const fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expect(fetchPromise).rejects.toThrowError();

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });

      it(`should clear all ${method} handlers after stopped`, async () => {
        interceptorWorker = new InternalHttpInterceptorWorker({ platform });
        await interceptorWorker.start();

        interceptorWorker.use(method, `${baseURL}/path`, spiedRequestHandler);

        await interceptorWorker.stop();
        await interceptorWorker.start();

        const fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expect(fetchPromise).rejects.toThrowError();

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });

      it(`should not intercept ${method} requests having no handler after cleared`, async () => {
        interceptorWorker = new InternalHttpInterceptorWorker({ platform });
        await interceptorWorker.start();

        interceptorWorker.use(method, `${baseURL}/path`, spiedRequestHandler);
        interceptorWorker.clearHandlers();

        const fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expect(fetchPromise).rejects.toThrowError();

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        interceptorWorker.use(method, `${baseURL}/path`, spiedRequestHandler);

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

      it(`should thrown an error if trying to apply a ${method} handler before started`, () => {
        interceptorWorker = new InternalHttpInterceptorWorker({ platform });

        expect(() => {
          interceptorWorker?.use(method, `${baseURL}/path`, spiedRequestHandler);
        }).toThrowError(NotStartedHttpInterceptorWorkerError);
      });
    });
  });
}
