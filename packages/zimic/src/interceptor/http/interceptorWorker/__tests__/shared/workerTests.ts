import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HTTP_METHODS } from '@/http/types/schema';
import { createHttpInterceptor } from '@/interceptor/http/interceptor/factory';
import LocalHttpInterceptor from '@/interceptor/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/interceptor/http/interceptor/RemoteHttpInterceptor';
import { PublicHttpInterceptor } from '@/interceptor/http/interceptor/types/public';
import { PublicHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/types/public';
import { fetchWithTimeout } from '@/utils/fetch';
import { waitForDelay } from '@/utils/time';
import { expectToThrowFetchError } from '@tests/utils/fetch';

import NotStartedHttpInterceptorWorkerError from '../../errors/NotStartedHttpInterceptorWorkerError';
import OtherHttpInterceptorWorkerRunningError from '../../errors/OtherHttpInterceptorWorkerRunningError';
import { createHttpInterceptorWorker } from '../../factory';
import LocalHttpInterceptorWorker from '../../LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../../RemoteHttpInterceptorWorker';
import { HttpInterceptorWorkerOptions, HttpInterceptorWorkerPlatform } from '../../types/options';
import { HttpRequestHandler } from '../../types/requests';
import { promiseIfRemote } from '../utils/promises';

export function declareSharedHttpInterceptorWorkerTests(options: { platform: HttpInterceptorWorkerPlatform }) {
  const { platform } = options;

  const interceptBaseURL = 'http://localhost:3000';
  const mockServerURL = 'http://localhost:3001';

  const workerOptionsArray: HttpInterceptorWorkerOptions[] = [
    { type: 'local' },
    {
      type: 'remote',
      mockServerURL,
    },
  ];

  describe.each(workerOptionsArray)('Shared (type $type)', (workerOptions) => {
    let worker: LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker | undefined;

    const baseURL = workerOptions.type === 'local' ? interceptBaseURL : mockServerURL;

    const responseStatus = 200;
    const responseBody = { success: true };

    function requestHandler(..._parameters: Parameters<HttpRequestHandler>): ReturnType<HttpRequestHandler> {
      const response = Response.json(responseBody, { status: responseStatus });
      return { response };
    }

    const spiedRequestHandler = vi.fn(requestHandler);

    function createWorker() {
      const worker = createHttpInterceptorWorker(workerOptions) satisfies PublicHttpInterceptorWorker;
      return worker as LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker;
    }

    function createDefaultHttpInterceptor(worker: LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker) {
      const interceptor =
        worker instanceof LocalHttpInterceptorWorker
          ? createHttpInterceptor<{}>({ worker, baseURL })
          : createHttpInterceptor<{}>({ worker, pathPrefix: 'path' });

      return interceptor satisfies PublicHttpInterceptor<{}> as LocalHttpInterceptor<{}> | RemoteHttpInterceptor<{}>;
    }

    beforeEach(async () => {
      if (worker) {
        await promiseIfRemote(worker.clearHandlers(), worker);
      }
      spiedRequestHandler.mockClear();
    });

    afterEach(async () => {
      await worker?.stop();
    });

    it('should initialize using the correct MSW server/worker and platform', async () => {
      worker = createWorker();

      expect(worker.platform()).toBe(null);
      expect(worker).toBeInstanceOf(LocalHttpInterceptorWorker);

      await worker.start();

      expect(worker.platform()).toBe(platform);

      if (worker instanceof LocalHttpInterceptorWorker) {
        expect(worker.hasInternalBrowserWorker()).toBe(platform === 'browser');
        expect(worker.hasInternalNodeWorker()).toBe(platform === 'node');
      }
    });

    it('should not throw an error when started multiple times', async () => {
      worker = createWorker();

      expect(worker.isRunning()).toBe(false);
      await worker.start();
      expect(worker.isRunning()).toBe(true);
      await worker.start();
      expect(worker.isRunning()).toBe(true);
      await worker.start();
      expect(worker.isRunning()).toBe(true);
    });

    it('should not throw an error when stopped without running', async () => {
      worker = createWorker();

      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
    });

    it('should not throw an error when stopped multiple times while running', async () => {
      worker = createWorker();

      expect(worker.isRunning()).toBe(false);
      await worker.start();
      expect(worker.isRunning()).toBe(true);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
    });

    it('should throw an error if multiple workers are started at the same time', async () => {
      worker = createWorker();
      expect(worker.isRunning()).toBe(false);

      const otherInterceptorWorker = createWorker();
      expect(otherInterceptorWorker.isRunning()).toBe(false);

      await worker.start();
      expect(worker.isRunning()).toBe(true);

      await expect(otherInterceptorWorker.start()).rejects.toThrowError(new OtherHttpInterceptorWorkerRunningError());
      expect(otherInterceptorWorker.isRunning()).toBe(false);

      await worker.stop();
      expect(worker.isRunning()).toBe(false);

      try {
        await otherInterceptorWorker.start();
        expect(otherInterceptorWorker.isRunning()).toBe(true);

        await expect(worker.start()).rejects.toThrowError(new OtherHttpInterceptorWorkerRunningError());
        expect(worker.isRunning()).toBe(false);
      } finally {
        await otherInterceptorWorker.stop();
      }
    });

    describe.each(HTTP_METHODS)('Method: %s', (method) => {
      it(`should intercept ${method} requests after started`, async () => {
        worker = createWorker();

        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        const url = `${baseURL}/path`;

        await promiseIfRemote(worker.use(interceptor.client(), method, url, spiedRequestHandler), worker);

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
        worker = createWorker();

        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        await promiseIfRemote(
          worker.use(interceptor.client(), method, `${baseURL}/path/:id`, spiedRequestHandler),
          worker,
        );

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
        worker = createWorker();

        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        await promiseIfRemote(
          worker.use(interceptor.client(), method, `${baseURL}/path/${1}`, spiedRequestHandler),
          worker,
        );

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
        await expectToThrowFetchError(unmatchedResponsePromise);

        expect(spiedRequestHandler).toHaveBeenCalledTimes(0);
      });

      it(`should not intercept bypassed ${method} requests`, async () => {
        worker = createWorker();

        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        const bypassedSpiedRequestHandler = vi.fn(requestHandler).mockImplementation(() => ({ bypass: true }));

        await promiseIfRemote(
          worker.use(interceptor.client(), method, `${baseURL}/path`, bypassedSpiedRequestHandler),
          worker,
        );

        expect(bypassedSpiedRequestHandler).not.toHaveBeenCalled();

        const fetchPromise = fetch(`${baseURL}/path`, { method });
        await expectToThrowFetchError(fetchPromise);

        expect(bypassedSpiedRequestHandler).toHaveBeenCalledTimes(1);

        const [handlerContext] = bypassedSpiedRequestHandler.mock.calls[0];
        expect(handlerContext.request).toBeInstanceOf(Request);
        expect(handlerContext.request.method).toBe(method);
        expect(handlerContext.params).toEqual({});
        expect(handlerContext.cookies).toEqual({});
      });

      it(`should support intercepting ${method} requests with a delay`, async () => {
        worker = createWorker();

        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        const delayedSpiedRequestHandler = vi.fn(requestHandler).mockImplementation(async (context) => {
          await waitForDelay(100);
          return requestHandler(context);
        });

        await promiseIfRemote(
          worker.use(interceptor.client(), method, `${baseURL}/path`, delayedSpiedRequestHandler),
          worker,
        );

        expect(delayedSpiedRequestHandler).not.toHaveBeenCalled();

        let fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 50 });
        await expectToThrowFetchError(fetchPromise, { canBeAborted: true });

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
        worker = createWorker();

        const interceptor = createDefaultHttpInterceptor(worker);
        await expect(async () => {
          await worker?.use(interceptor.client(), method, `${baseURL}/path`, spiedRequestHandler);
        }).rejects.toThrowError(Error);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expectToThrowFetchError(fetchPromise, { canBeAborted: true });

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });

      it(`should not intercept ${method} requests after stopped`, async () => {
        worker = createWorker();

        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        await promiseIfRemote(worker.use(interceptor.client(), method, `${baseURL}/path`, spiedRequestHandler), worker);

        await worker.stop();

        const fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expectToThrowFetchError(fetchPromise, { canBeAborted: true });

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });

      it(`should clear all ${method} handlers after stopped`, async () => {
        worker = createWorker();

        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        await promiseIfRemote(worker.use(interceptor.client(), method, `${baseURL}/path`, spiedRequestHandler), worker);

        await worker.stop();
        await worker.start();

        const fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expectToThrowFetchError(fetchPromise, { canBeAborted: true });

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });

      it(`should not intercept ${method} requests having no handler after cleared`, async () => {
        worker = createWorker();

        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        await promiseIfRemote(worker.use(interceptor.client(), method, `${baseURL}/path`, spiedRequestHandler), worker);

        await promiseIfRemote(worker.clearHandlers(), worker);

        const fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expectToThrowFetchError(fetchPromise, { canBeAborted: true });

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        await promiseIfRemote(worker.use(interceptor.client(), method, `${baseURL}/path`, spiedRequestHandler), worker);

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
        worker = createWorker();

        await worker.start();

        const okSpiedRequestHandler = vi.fn(spiedRequestHandler).mockImplementation(() => {
          const response = new Response(null, { status: 200 });
          return { response };
        });
        const noContentSpiedRequestHandler = vi.fn(spiedRequestHandler).mockImplementation(() => {
          const response = new Response(null, { status: 204 });
          return { response };
        });

        const interceptor = createDefaultHttpInterceptor(worker);
        await promiseIfRemote(
          worker.use(interceptor.client(), method, `${baseURL}/path`, okSpiedRequestHandler),
          worker,
        );

        let interceptorsWithHandlers = worker.interceptorsWithHandlers();

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

        const otherInterceptor = createDefaultHttpInterceptor(worker);
        await promiseIfRemote(
          worker.use(otherInterceptor.client(), method, `${baseURL}/path`, noContentSpiedRequestHandler),
          worker,
        );

        interceptorsWithHandlers = worker.interceptorsWithHandlers();
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

        await promiseIfRemote(worker.clearInterceptorHandlers(otherInterceptor.client()), worker);

        interceptorsWithHandlers = worker.interceptorsWithHandlers();
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

        await promiseIfRemote(worker.clearInterceptorHandlers(otherInterceptor.client()), worker);

        interceptorsWithHandlers = worker.interceptorsWithHandlers();
        expect(interceptorsWithHandlers).toHaveLength(0);

        const fetchPromise = fetchWithTimeout(`${baseURL}/path`, { method, timeout: 200 });
        await expectToThrowFetchError(fetchPromise, { canBeAborted: true });

        expect(okSpiedRequestHandler).toHaveBeenCalledTimes(2);
        expect(noContentSpiedRequestHandler).toHaveBeenCalledTimes(1);
      });

      it(`should thrown an error if trying to apply a ${method} handler before started`, async () => {
        worker = createWorker();

        const interceptor = createDefaultHttpInterceptor(worker);

        await expect(async () => {
          await worker?.use(interceptor.client(), method, `${baseURL}/path`, spiedRequestHandler);
        }).rejects.toThrowError(NotStartedHttpInterceptorWorkerError);
      });
    });
  });
}
