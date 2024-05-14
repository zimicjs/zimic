import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import { HTTP_METHODS } from '@/http/types/schema';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/server/constants';
import { PossiblePromise } from '@/types/utils';
import { DuplicatePathParameterError, createExtendedURL, fetchWithTimeout, joinURL } from '@/utils/fetch';
import { waitForDelay } from '@/utils/time';
import { expectFetchError, expectFetchErrorOrPreflightResponse } from '@tests/utils/fetch';
import { createInternalHttpInterceptor, usingHttpInterceptorWorker } from '@tests/utils/interceptors';

import NotStartedHttpInterceptorError from '../../../interceptor/errors/NotStartedHttpInterceptorError';
import {
  HttpInterceptorWorkerOptions,
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from '../../types/options';
import { HttpResponseFactoryContext, HttpResponseFactoryResult } from '../../types/requests';
import { promiseIfRemote } from '../utils/promises';
import { SharedHttpInterceptorWorkerTestOptions } from './types';

export function declareMethodHttpInterceptorWorkerTests(options: SharedHttpInterceptorWorkerTestOptions) {
  const { platform, startServer, getBaseURL, stopServer } = options;

  const workerOptionsArray: HttpInterceptorWorkerOptions[] = [
    { type: 'local' },
    { type: 'remote', serverURL: createExtendedURL('http://localhost/temporary') },
  ];

  const responseStatus = 200;
  const responseBody = { success: true };

  describe.each(workerOptionsArray)('Shared (type $type)', (defaultWorkerOptions) => {
    let baseURL: URL;
    let workerOptions: LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions;

    function createDefaultHttpInterceptor() {
      return createInternalHttpInterceptor<{}>({ type: defaultWorkerOptions.type, baseURL });
    }

    beforeEach(async () => {
      if (defaultWorkerOptions.type === 'remote') {
        await startServer?.();
      }

      baseURL = await getBaseURL(defaultWorkerOptions.type);

      workerOptions =
        defaultWorkerOptions.type === 'local'
          ? defaultWorkerOptions
          : { ...defaultWorkerOptions, serverURL: createExtendedURL(baseURL.origin) };
    });

    afterEach(async () => {
      if (defaultWorkerOptions.type === 'remote') {
        await stopServer?.();
      }
    });

    describe.each(HTTP_METHODS)('Method: %s', (method) => {
      const overridesPreflightResponse = defaultWorkerOptions.type === 'remote' && method === 'OPTIONS';
      const numberOfRequestsIncludingPrefetch =
        platform === 'browser' && defaultWorkerOptions.type === 'remote' && method === 'OPTIONS' ? 2 : 1;

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
        await usingHttpInterceptorWorker(workerOptions, async (worker) => {
          const interceptor = createDefaultHttpInterceptor();

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
      });

      const param1 = 'abc';
      const param2 = 2;
      const param3 = 3;

      it.each([
        { use: '/:param', fetch: `/${param1}` },
        { use: '/:param', fetch: `/${param2}` },
        { use: `/${param1}`, fetch: `/${param1}` },

        { use: '/other/path/:param', fetch: `/other/path/${param1}` },
        { use: '/other/path/:param', fetch: `/other/path/${param2}` },
        { use: `/other/path/${param1}`, fetch: `/other/path/${param1}` },

        { use: '/other/:param/path', fetch: `/other/${param1}/path` },
        { use: '/other/:param/path', fetch: `/other/${param2}/path` },
        { use: `/other/${param1}/path`, fetch: `/other/${param1}/path` },

        { use: '/other/:param/path/:other', fetch: `/other/${param1}/path/${param2}` },
        { use: '/other/:param/path/:other', fetch: `/other/${param2}/path/${param1}` },
        { use: `/other/${param1}/path/${param2}`, fetch: `/other/${param1}/path/${param2}` },

        { use: '/:param/:other', fetch: `/${param1}/${param2}` },
        { use: '/:param/:other', fetch: `/${param2}/${param1}` },
        { use: `/${param1}/${param2}`, fetch: `/${param1}/${param2}` },

        { use: '/:param/:other/:another', fetch: `/${param1}/${param2}/${param3}` },
        { use: '/:param/:other/:another', fetch: `/${param2}/${param3}/${param1}` },
        { use: `/${param1}/${param2}/${param3}`, fetch: `/${param1}/${param2}/${param3}` },

        { use: '/:param/path/:other/:another/path', fetch: `/${param1}/path/${param2}/${param3}/path` },
        { use: '/:param/path/:other/:another/path', fetch: `/${param3}/path/${param2}/${param1}/path` },
        { use: `/${param1}/path/${param2}/${param3}/path`, fetch: `/${param1}/path/${param2}/${param3}/path` },
      ])(`should intercept ${method} requests with matching dynamic paths (use $use; fetch $fetch)`, async (paths) => {
        const useURL = joinURL(baseURL, paths.use);

        await usingHttpInterceptorWorker(workerOptions, async (worker) => {
          const interceptor = createDefaultHttpInterceptor();
          await promiseIfRemote(worker.use(interceptor.client(), method, useURL, spiedRequestHandler), worker);

          expect(spiedRequestHandler).not.toHaveBeenCalled();

          const urlExpectedToSucceed = joinURL(baseURL, paths.fetch);
          const response = await fetch(urlExpectedToSucceed, { method });

          expect(spiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPrefetch);

          const [handlerContext] = spiedRequestHandler.mock.calls[numberOfRequestsIncludingPrefetch - 1];
          expect(handlerContext.request).toBeInstanceOf(Request);
          expect(handlerContext.request.method).toBe(method);

          expect(response.status).toBe(200);
          await expectMatchedBodyIfNotHead(response);
        });
      });

      it.each([
        { use: '/:param', fetch: `/${param1}/other` },
        { use: '/:param', fetch: `/other/${param1}` },
        { use: `/${param1}`, fetch: `/${param2}` },
        { use: `/${param1}`, fetch: `/${param1}/other` },
        { use: `/${param1}`, fetch: `/other/${param1}` },

        { use: '/other/path/:param', fetch: `/other/path/${param1}/another` },
        { use: '/other/path/:param', fetch: `/other/${param1}/path` },
        { use: `/other/path/${param1}`, fetch: `/other/path/${param2}` },
        { use: `/other/path/${param1}`, fetch: `/other/path/${param1}/another` },
        { use: `/other/path/${param1}`, fetch: `/other/${param1}/path` },

        { use: '/other/:param/path', fetch: `/other/${param1}/path/another` },
        { use: '/other/:param/path', fetch: `/other/path/${param1}` },
        { use: `/other/${param1}/path`, fetch: `/other/${param2}/path` },
        { use: `/other/${param1}/path`, fetch: `/other/${param1}/path/another` },
        { use: `/other/${param1}/path`, fetch: `/other/path/${param1}` },

        { use: '/other/:param/path/:other', fetch: `/other/${param1}/path/${param2}/another` },
        { use: '/other/:param/path/:other', fetch: `/other/${param1}/path` },
        { use: `/other/${param1}/path/${param2}`, fetch: `/other/${param2}/path/${param1}` },
        { use: `/other/${param1}/path/${param2}`, fetch: `/other/${param1}/path/${param2}/another` },
        { use: `/other/${param1}/path/${param2}`, fetch: `/other/${param1}/path` },

        { use: '/:param/:other', fetch: `/${param1}` },
        { use: '/:param/:other', fetch: `/other/${param1}/${param2}/another` },
        { use: `/${param1}/${param2}`, fetch: `/${param2}/${param1}` },
        { use: `/${param1}/${param2}`, fetch: `/${param1}` },
        { use: `/${param1}/${param2}`, fetch: `/other/${param1}/${param2}/another` },

        { use: '/:param/:other/:another', fetch: `/${param1}/${param2}` },
        { use: '/:param/:other/:another', fetch: `/${param1}/${param3}/other/another` },
        { use: `/${param1}/${param2}/${param3}`, fetch: `/${param3}/${param2}/${param1}` },
        { use: `/${param1}/${param2}/${param3}`, fetch: `/${param1}/${param2}` },
        { use: `/${param1}/${param2}/${param3}`, fetch: `/${param1}/${param3}/other/another` },

        { use: '/:param/path/:other/:another/path', fetch: `/${param1}/path/${param2}/path` },
        { use: '/:param/path/:other/:another/path', fetch: '/path' },
        { use: `/${param1}/path/${param2}/${param3}/path`, fetch: `/${param3}/path/${param1}/${param2}/path` },
        { use: `/${param1}/path/${param2}/${param3}/path`, fetch: `/${param1}/path/${param2}/path` },
        { use: `/${param1}/path/${param2}/${param3}/path`, fetch: '/path' },
      ])(
        `should not intercept ${method} requests with non-matching dynamic paths (use $use; fetch $fetch)`,
        async (paths) => {
          const useURL = joinURL(baseURL, paths.use);

          await usingHttpInterceptorWorker(workerOptions, async (worker) => {
            const interceptor = createDefaultHttpInterceptor();
            await promiseIfRemote(worker.use(interceptor.client(), method, useURL, spiedRequestHandler), worker);

            expect(spiedRequestHandler).not.toHaveBeenCalled();

            const urlExpectedToFail = joinURL(baseURL, paths.fetch);

            const fetchPromise = fetchWithTimeout(urlExpectedToFail, { method, timeout: 200 });
            await expectFetchErrorOrPreflightResponse(fetchPromise, {
              shouldBePreflight: overridesPreflightResponse,
              canBeAborted: true,
            });

            expect(spiedRequestHandler).not.toHaveBeenCalled();
          });
        },
      );

      it.each([
        { use: '/:param/:param', duplicatedParameter: 'param' },
        { use: '/:param/:param/:param', duplicatedParameter: 'param' },
        { use: '/:param/:other/:param', duplicatedParameter: 'param' },
        { use: '/:param/:other/:param/:other', duplicatedParameter: 'param' },
        { use: '/some/:other/path/:other', duplicatedParameter: 'other' },
        { use: '/some/path/:other/:other', duplicatedParameter: 'other' },
      ])(
        `should throw an error if trying to use a ${method} url with duplicate dynamic path params (use $use; fetch $fetch)`,
        async (paths) => {
          const useURL = joinURL(baseURL, paths.use);

          await usingHttpInterceptorWorker(workerOptions, async (worker) => {
            const interceptor = createDefaultHttpInterceptor();

            await expect(async () => {
              await worker.use(interceptor.client(), method, useURL, spiedRequestHandler);
            }).rejects.toThrowError(new DuplicatePathParameterError(useURL, paths.duplicatedParameter));

            expect(spiedRequestHandler).not.toHaveBeenCalled();
          });
        },
      );

      it(`should not intercept bypassed ${method} requests`, async () => {
        await usingHttpInterceptorWorker(workerOptions, async (worker) => {
          const interceptor = createDefaultHttpInterceptor();
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
      });

      it(`should support intercepting ${method} requests with a delay`, async () => {
        await usingHttpInterceptorWorker(workerOptions, async (worker) => {
          const interceptor = createDefaultHttpInterceptor();
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
      });

      it(`should not intercept ${method} requests before started`, async () => {
        await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
          const interceptor = createDefaultHttpInterceptor();
          await expect(async () => {
            await worker.use(interceptor.client(), method, baseURL, spiedRequestHandler);
          }).rejects.toThrowError(Error);

          expect(spiedRequestHandler).not.toHaveBeenCalled();

          const fetchPromise = fetchWithTimeout(baseURL, { method, timeout: 200 });
          await expectFetchErrorOrPreflightResponse(fetchPromise, {
            shouldBePreflight: overridesPreflightResponse,
            canBeAborted: true,
          });

          expect(spiedRequestHandler).not.toHaveBeenCalled();
        });
      });

      it(`should not intercept ${method} requests after stopped`, async () => {
        await usingHttpInterceptorWorker(workerOptions, async (worker) => {
          const interceptor = createDefaultHttpInterceptor();
          await promiseIfRemote(worker.use(interceptor.client(), method, baseURL, spiedRequestHandler), worker);

          await worker.stop();

          const fetchPromise = fetchWithTimeout(baseURL, { method, timeout: 200 });
          await expectFetchErrorOrPreflightResponse(fetchPromise, {
            shouldBePreflight: overridesPreflightResponse,
            canBeAborted: true,
          });

          expect(spiedRequestHandler).not.toHaveBeenCalled();
        });
      });

      it(`should clear all ${method} handlers after stopped`, async () => {
        await usingHttpInterceptorWorker(workerOptions, async (worker) => {
          const interceptor = createDefaultHttpInterceptor();
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
      });

      it(`should not intercept ${method} requests having no handler after cleared`, async () => {
        await usingHttpInterceptorWorker(workerOptions, async (worker) => {
          const interceptor = createDefaultHttpInterceptor();
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
      });

      it(`should not intercept ${method} requests handled by a cleared interceptor`, async () => {
        await usingHttpInterceptorWorker(workerOptions, async (worker) => {
          const okSpiedRequestHandler = vi.fn(spiedRequestHandler).mockImplementation(() => {
            const response = new Response(null, { status: 200, headers: defaultHeaders });
            return { response };
          });
          const noContentSpiedRequestHandler = vi.fn(spiedRequestHandler).mockImplementation(() => {
            const response = new Response(null, { status: 204, headers: defaultHeaders });
            return { response };
          });

          const interceptor = createDefaultHttpInterceptor();
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

          const otherInterceptor = createDefaultHttpInterceptor();
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
      });

      it(`should throw an error if trying to apply a ${method} handler before started`, async () => {
        await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
          const interceptor = createDefaultHttpInterceptor();

          await expect(async () => {
            await worker.use(interceptor.client(), method, baseURL, spiedRequestHandler);
          }).rejects.toThrowError(NotStartedHttpInterceptorError);
        });
      });
    });
  });
}
