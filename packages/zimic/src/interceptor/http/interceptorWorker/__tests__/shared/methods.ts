import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import { HTTP_METHODS } from '@/http/types/schema';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/server/constants';
import { PossiblePromise } from '@/types/utils';
import { fetchWithTimeout } from '@/utils/fetch';
import { waitForDelay } from '@/utils/time';
import { expectFetchError, expectFetchErrorOrPreflightResponse } from '@tests/utils/fetch';
import { createInternalHttpInterceptor, createInternalHttpInterceptorWorker } from '@tests/utils/interceptors';

import NotStartedHttpInterceptorWorkerError from '../../errors/NotStartedHttpInterceptorWorkerError';
import LocalHttpInterceptorWorker from '../../LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../../RemoteHttpInterceptorWorker';
import { HttpInterceptorWorkerOptions } from '../../types/options';
import { HttpResponseFactoryContext, HttpResponseFactoryResult } from '../../types/requests';
import { promiseIfRemote } from '../utils/promises';
import { SharedHttpInterceptorWorkerTestOptions } from './types';

export function declareMethodHttpInterceptorWorkerTests(options: SharedHttpInterceptorWorkerTestOptions) {
  const { platform, startServer, getAccessResources, stopServer } = options;

  const workerOptionsArray: HttpInterceptorWorkerOptions[] = [
    { type: 'local' },
    { type: 'remote', serverURL: '<temporary>' },
  ];

  const responseStatus = 200;
  const responseBody = { success: true };

  describe.each(workerOptionsArray)('Shared (type $type)', (workerOptions) => {
    let worker: LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker | undefined;

    let serverURL: string;
    let baseURL: string;
    let pathPrefix: string;

    function createWorker() {
      return createInternalHttpInterceptorWorker(
        workerOptions.type === 'local' ? workerOptions : { ...workerOptions, serverURL },
      );
    }

    function createDefaultHttpInterceptor(worker: LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker) {
      return createInternalHttpInterceptor<{}>(
        worker instanceof LocalHttpInterceptorWorker ? { worker, baseURL } : { worker, pathPrefix },
      );
    }

    beforeEach(async () => {
      if (workerOptions.type === 'remote') {
        await startServer?.();
      }

      ({
        serverURL,
        clientBaseURL: baseURL,
        clientPathPrefix: pathPrefix,
      } = await getAccessResources(workerOptions.type));
    });

    afterEach(async () => {
      await worker?.stop();

      if (workerOptions.type === 'remote') {
        await stopServer?.();
      }
    });

    describe.each(HTTP_METHODS)('Method: %s', (method) => {
      const overridesPreflightResponse = workerOptions.type === 'remote' && method === 'OPTIONS';
      const numberOfRequestsIncludingPrefetch =
        platform === 'browser' && workerOptions.type === 'remote' && method === 'OPTIONS' ? 2 : 1;

      const defaultHeaders = new HttpHeaders<AccessControlHeaders>();

      if (overridesPreflightResponse) {
        for (const [header, value] of Object.entries(DEFAULT_ACCESS_CONTROL_HEADERS)) {
          /* istanbul ignore else -- @preserve
           * This is always true during tests because we force max-age=0 to disable CORS caching. */
          if (value) {
            defaultHeaders.set(header, value);
          }
        }
      }

      function requestHandler(_context: HttpResponseFactoryContext): PossiblePromise<HttpResponseFactoryResult> {
        const response = Response.json(responseBody, {
          status: responseStatus,
          headers: defaultHeaders,
        });
        return { response };
      }

      const spiedRequestHandler = vi.fn(requestHandler);

      async function expectMatchedBodyIfNotHead(response: Response) {
        if (method === 'HEAD') {
          expect(await response.text()).toBe('');
        } else {
          const matchedBody = (await response.json()) as typeof responseBody;
          expect(matchedBody).toEqual(responseBody);
        }
      }

      beforeEach(() => {
        spiedRequestHandler.mockClear();
      });

      it(`should intercept ${method} requests after started`, async () => {
        worker = createWorker();
        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);

        await promiseIfRemote(worker.use(interceptor.client(), method, baseURL, spiedRequestHandler), worker);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const response = await fetch(baseURL, { method });

        expect(spiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPrefetch);

        const [handlerContext] = spiedRequestHandler.mock.calls[numberOfRequestsIncludingPrefetch - 1];
        expect(handlerContext.request).toBeInstanceOf(Request);
        expect(handlerContext.request.method).toBe(method);

        expect(response.status).toBe(200);
        await expectMatchedBodyIfNotHead(response);
      });

      it(`should intercept ${method} requests after started, considering dynamic paths with a generic match`, async () => {
        worker = createWorker();
        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        await promiseIfRemote(worker.use(interceptor.client(), method, `${baseURL}/:id`, spiedRequestHandler), worker);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const response = await fetch(`${baseURL}/${1}`, { method });

        expect(spiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPrefetch);

        const [handlerContext] = spiedRequestHandler.mock.calls[numberOfRequestsIncludingPrefetch - 1];
        expect(handlerContext.request).toBeInstanceOf(Request);
        expect(handlerContext.request.method).toBe(method);

        expect(response.status).toBe(200);
        await expectMatchedBodyIfNotHead(response);
      });

      it(`should intercept ${method} requests after started, considering dynamic paths with a specific match`, async () => {
        worker = createWorker();
        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        await promiseIfRemote(worker.use(interceptor.client(), method, `${baseURL}/${1}`, spiedRequestHandler), worker);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const matchedResponse = await fetch(`${baseURL}/${1}`, { method });
        expect(matchedResponse.status).toBe(200);

        await expectMatchedBodyIfNotHead(matchedResponse);

        expect(spiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPrefetch);

        const [matchedCallContext] = spiedRequestHandler.mock.calls[numberOfRequestsIncludingPrefetch - 1];
        expect(matchedCallContext.request).toBeInstanceOf(Request);
        expect(matchedCallContext.request.method).toBe(method);

        spiedRequestHandler.mockClear();

        const unmatchedResponsePromise = fetch(`${baseURL}/${2}`, { method });
        await expectFetchErrorOrPreflightResponse(unmatchedResponsePromise, {
          shouldBePreflight: overridesPreflightResponse,
        });

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });

      it(`should not intercept bypassed ${method} requests`, async () => {
        worker = createWorker();
        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        const bypassedSpiedRequestHandler = vi.fn(requestHandler).mockImplementation(() => ({ bypass: true }));

        await promiseIfRemote(worker.use(interceptor.client(), method, baseURL, bypassedSpiedRequestHandler), worker);

        expect(bypassedSpiedRequestHandler).not.toHaveBeenCalled();

        const fetchPromise = fetch(baseURL, { method });
        await expectFetchErrorOrPreflightResponse(fetchPromise, {
          shouldBePreflight: overridesPreflightResponse,
        });

        expect(bypassedSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPrefetch);

        const [handlerContext] = bypassedSpiedRequestHandler.mock.calls[numberOfRequestsIncludingPrefetch - 1];
        expect(handlerContext.request).toBeInstanceOf(Request);
        expect(handlerContext.request.method).toBe(method);
      });

      it(`should support intercepting ${method} requests with a delay`, async () => {
        worker = createWorker();
        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        const delayedSpiedRequestHandler = vi.fn(requestHandler).mockImplementation(async (context) => {
          await waitForDelay(100);
          return requestHandler(context);
        });

        await promiseIfRemote(worker.use(interceptor.client(), method, baseURL, delayedSpiedRequestHandler), worker);

        expect(delayedSpiedRequestHandler).not.toHaveBeenCalled();

        let fetchPromise = fetchWithTimeout(baseURL, { method, timeout: 20 });
        await expectFetchError(fetchPromise, { canBeAborted: true });

        fetchPromise = fetchWithTimeout(baseURL, { method, timeout: 500 });
        await expect(fetchPromise).resolves.toBeInstanceOf(Response);

        expect(delayedSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPrefetch + 1);

        for (const [handlerContext] of delayedSpiedRequestHandler.mock.calls) {
          expect(handlerContext.request).toBeInstanceOf(Request);
          expect(handlerContext.request.method).toBe(method);
        }
      });

      it(`should not intercept ${method} requests before started`, async () => {
        worker = createWorker();

        const interceptor = createDefaultHttpInterceptor(worker);
        await expect(async () => {
          await worker?.use(interceptor.client(), method, baseURL, spiedRequestHandler);
        }).rejects.toThrowError(Error);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const fetchPromise = fetchWithTimeout(baseURL, { method, timeout: 200 });
        await expectFetchErrorOrPreflightResponse(fetchPromise, {
          shouldBePreflight: overridesPreflightResponse,
          canBeAborted: true,
        });

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });

      it(`should not intercept ${method} requests after stopped`, async () => {
        worker = createWorker();
        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        await promiseIfRemote(worker.use(interceptor.client(), method, baseURL, spiedRequestHandler), worker);

        await worker.stop();

        const fetchPromise = fetchWithTimeout(baseURL, { method, timeout: 200 });
        await expectFetchErrorOrPreflightResponse(fetchPromise, {
          shouldBePreflight: overridesPreflightResponse,
          canBeAborted: true,
        });

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });

      it(`should clear all ${method} handlers after stopped`, async () => {
        worker = createWorker();
        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        await promiseIfRemote(worker.use(interceptor.client(), method, baseURL, spiedRequestHandler), worker);

        await worker.stop();
        await worker.start();

        const fetchPromise = fetchWithTimeout(baseURL, { method, timeout: 200 });
        await expectFetchErrorOrPreflightResponse(fetchPromise, {
          shouldBePreflight: overridesPreflightResponse,
          canBeAborted: true,
        });

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });

      it(`should not intercept ${method} requests having no handler after cleared`, async () => {
        worker = createWorker();
        await worker.start();

        const interceptor = createDefaultHttpInterceptor(worker);
        await promiseIfRemote(worker.use(interceptor.client(), method, baseURL, spiedRequestHandler), worker);

        await promiseIfRemote(worker.clearHandlers(), worker);

        const fetchPromise = fetchWithTimeout(baseURL, { method, timeout: 200 });
        await expectFetchErrorOrPreflightResponse(fetchPromise, {
          shouldBePreflight: overridesPreflightResponse,
          canBeAborted: true,
        });

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        await promiseIfRemote(worker.use(interceptor.client(), method, baseURL, spiedRequestHandler), worker);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const response = await fetch(baseURL, { method });

        expect(spiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPrefetch);

        const [handlerContext] = spiedRequestHandler.mock.calls[numberOfRequestsIncludingPrefetch - 1];
        expect(handlerContext.request).toBeInstanceOf(Request);
        expect(handlerContext.request.method).toBe(method);

        expect(response.status).toBe(200);
        await expectMatchedBodyIfNotHead(response);
      });

      it(`should not intercept ${method} requests handled by a cleared interceptor`, async () => {
        worker = createWorker();
        await worker.start();

        const okSpiedRequestHandler = vi.fn(spiedRequestHandler).mockImplementation(() => {
          const response = new Response(null, { status: 200, headers: defaultHeaders });
          return { response };
        });
        const noContentSpiedRequestHandler = vi.fn(spiedRequestHandler).mockImplementation(() => {
          const response = new Response(null, { status: 204, headers: defaultHeaders });
          return { response };
        });

        const interceptor = createDefaultHttpInterceptor(worker);
        await promiseIfRemote(worker.use(interceptor.client(), method, baseURL, okSpiedRequestHandler), worker);

        let interceptorsWithHandlers = worker.interceptorsWithHandlers();

        expect(interceptorsWithHandlers).toHaveLength(1);
        expect(interceptorsWithHandlers[0]).toBe(interceptor.client());

        let response = await fetch(baseURL, { method });
        expect(response.status).toBe(200);

        expect(okSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPrefetch);
        expect(noContentSpiedRequestHandler).not.toHaveBeenCalled();

        let [okHandlerContext] = okSpiedRequestHandler.mock.calls[numberOfRequestsIncludingPrefetch - 1];
        expect(okHandlerContext.request).toBeInstanceOf(Request);
        expect(okHandlerContext.request.method).toBe(method);

        const otherInterceptor = createDefaultHttpInterceptor(worker);
        await promiseIfRemote(
          worker.use(otherInterceptor.client(), method, baseURL, noContentSpiedRequestHandler),
          worker,
        );

        interceptorsWithHandlers = worker.interceptorsWithHandlers();
        expect(interceptorsWithHandlers).toHaveLength(2);
        expect(interceptorsWithHandlers[0]).toBe(interceptor.client());
        expect(interceptorsWithHandlers[1]).toBe(otherInterceptor.client());

        response = await fetch(baseURL, { method });
        expect(response.status).toBe(204);

        expect(okSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPrefetch);
        expect(noContentSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPrefetch);

        const [noContentHandlerContext] =
          noContentSpiedRequestHandler.mock.calls[numberOfRequestsIncludingPrefetch - 1];
        expect(noContentHandlerContext.request).toBeInstanceOf(Request);
        expect(noContentHandlerContext.request.method).toBe(method);

        await promiseIfRemote(worker.clearInterceptorHandlers(otherInterceptor.client()), worker);

        interceptorsWithHandlers = worker.interceptorsWithHandlers();
        expect(interceptorsWithHandlers).toHaveLength(1);
        expect(interceptorsWithHandlers[0]).toBe(interceptor.client());

        response = await fetch(baseURL, { method });
        expect(response.status).toBe(200);

        expect(okSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPrefetch * 2);
        expect(noContentSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPrefetch);

        [okHandlerContext] = okSpiedRequestHandler.mock.calls[numberOfRequestsIncludingPrefetch * 2 - 1];
        expect(okHandlerContext.request).toBeInstanceOf(Request);
        expect(okHandlerContext.request.method).toBe(method);

        await promiseIfRemote(worker.clearInterceptorHandlers(interceptor.client()), worker);

        interceptorsWithHandlers = worker.interceptorsWithHandlers();
        expect(interceptorsWithHandlers).toHaveLength(0);

        const fetchPromise = fetchWithTimeout(baseURL, { method, timeout: 200 });
        await expectFetchErrorOrPreflightResponse(fetchPromise, {
          shouldBePreflight: overridesPreflightResponse,
          canBeAborted: true,
        });

        expect(okSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPrefetch * 2);
        expect(noContentSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPrefetch);
      });

      it(`should throw an error if trying to apply a ${method} handler before started`, async () => {
        worker = createWorker();

        const interceptor = createDefaultHttpInterceptor(worker);

        await expect(async () => {
          await worker?.use(interceptor.client(), method, baseURL, spiedRequestHandler);
        }).rejects.toThrowError(NotStartedHttpInterceptorWorkerError);
      });
    });
  });
}
