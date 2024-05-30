import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import { HTTP_METHODS } from '@/http/types/schema';
import NotStartedHttpInterceptorError from '@/interceptor/http/interceptor/errors/NotStartedHttpInterceptorError';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/interceptor/server/constants';
import { PossiblePromise } from '@/types/utils';
import { fetchWithTimeout } from '@/utils/fetch';
import { waitForDelay } from '@/utils/time';
import { joinURL, DuplicatedPathParamError, createURL, InvalidURLError, createRegexFromURL } from '@/utils/urls';
import { expectFetchError, expectFetchErrorOrPreflightResponse } from '@tests/utils/fetch';
import {
  assessPreflightInterference,
  createInternalHttpInterceptor,
  usingHttpInterceptorWorker,
} from '@tests/utils/interceptors';

import HttpInterceptorWorker from '../../HttpInterceptorWorker';
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
    { type: 'remote', serverURL: createURL('http://localhost/temporary') },
  ];

  const responseStatus = 200;
  const responseBody = { success: true };

  describe.each(workerOptionsArray)('Shared (type $type)', (defaultWorkerOptions) => {
    let baseURL: URL;
    let workerOptions: LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions;

    function createDefaultHttpInterceptor() {
      return createInternalHttpInterceptor<{}>({ type: defaultWorkerOptions.type, baseURL });
    }

    beforeAll(async () => {
      if (defaultWorkerOptions.type === 'remote') {
        await startServer?.();
      }

      baseURL = await getBaseURL(defaultWorkerOptions.type);

      workerOptions =
        defaultWorkerOptions.type === 'local'
          ? defaultWorkerOptions
          : { ...defaultWorkerOptions, serverURL: createURL(baseURL.origin) };
    });

    afterAll(async () => {
      if (defaultWorkerOptions.type === 'remote') {
        await stopServer?.();
      }
    });

    describe.each(HTTP_METHODS)('Method: %s', (method) => {
      const { overridesPreflightResponse, numberOfRequestsIncludingPreflight } = assessPreflightInterference({
        method,
        platform,
        type: defaultWorkerOptions.type,
      });

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

          expect(spiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

          const [handlerContext] = spiedRequestHandler.mock.calls[numberOfRequestsIncludingPreflight - 1];
          expect(handlerContext.request).toBeInstanceOf(Request);
          expect(handlerContext.request.method).toBe(method);

          expect(response.status).toBe(200);
          await expectMatchedBodyIfNotHead(response);
        });
      });

      const param1 = 'abc';
      const param2 = '2';
      const param3 = '3';

      it.each([
        {
          use: '/:param',
          fetch: `/${param1}`,
          params: { param: param1 },
        },
        {
          use: '/:param',
          fetch: `/${param2}`,
          params: { param: param2 },
        },
        {
          use: `/${param1}`,
          fetch: `/${param1}`,
          params: {},
        },

        {
          use: '/other/path/:param',
          fetch: `/other/path/${param1}`,
          params: { param: param1 },
        },
        {
          use: '/other/path/:param',
          fetch: `/other/path/${param2}`,
          params: { param: param2 },
        },
        {
          use: `/other/path/${param1}`,
          fetch: `/other/path/${param1}`,
          params: {},
        },

        {
          use: '/other/:param/path',
          fetch: `/other/${param1}/path`,
          params: { param: param1 },
        },
        {
          use: '/other/:param/path',
          fetch: `/other/${param2}/path`,
          params: { param: param2 },
        },
        {
          use: `/other/${param1}/path`,
          fetch: `/other/${param1}/path`,
          params: {},
        },

        {
          use: '/other/:param/path/:other',
          fetch: `/other/${param1}/path/${param2}`,
          params: { param: param1, other: param2 },
        },
        {
          use: '/other/:param/path/:other',
          fetch: `/other/${param2}/path/${param1}`,
          params: { param: param2, other: param1 },
        },
        {
          use: `/other/${param1}/path/${param2}`,
          fetch: `/other/${param1}/path/${param2}`,
          params: {},
        },

        {
          use: '/:param/:other',
          fetch: `/${param1}/${param2}`,
          params: { param: param1, other: param2 },
        },
        {
          use: '/:param/:other',
          fetch: `/${param2}/${param1}`,
          params: { param: param2, other: param1 },
        },
        {
          use: `/${param1}/${param2}`,
          fetch: `/${param1}/${param2}`,
          params: {},
        },

        {
          use: '/:param/:other/:another',
          fetch: `/${param1}/${param2}/${param3}`,
          params: { param: param1, other: param2, another: param3 },
        },
        {
          use: '/:param/:other/:another',
          fetch: `/${param2}/${param3}/${param1}`,
          params: { param: param2, other: param3, another: param1 },
        },
        {
          use: `/${param1}/${param2}/${param3}`,
          fetch: `/${param1}/${param2}/${param3}`,
          params: {},
        },

        {
          use: '/:param/path/:other/:another/path',
          fetch: `/${param1}/path/${param2}/${param3}/path`,
          params: { param: param1, other: param2, another: param3 },
        },
        {
          use: '/:param/path/:other/:another/path',
          fetch: `/${param3}/path/${param2}/${param1}/path`,
          params: { param: param3, other: param2, another: param1 },
        },
        {
          use: `/${param1}/path/${param2}/${param3}/path`,
          fetch: `/${param1}/path/${param2}/${param3}/path`,
          params: {},
        },
      ])(`should intercept ${method} requests with matching dynamic paths (use $use; fetch $fetch)`, async (paths) => {
        const url = joinURL(baseURL, paths.use);

        await usingHttpInterceptorWorker(workerOptions, async (worker) => {
          const interceptor = createDefaultHttpInterceptor();
          await promiseIfRemote(worker.use(interceptor.client(), method, url, spiedRequestHandler), worker);

          expect(spiedRequestHandler).not.toHaveBeenCalled();

          const urlExpectedToSucceed = joinURL(baseURL, paths.fetch);
          const response = await fetch(urlExpectedToSucceed, { method });

          expect(spiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

          const [handlerContext] = spiedRequestHandler.mock.calls[numberOfRequestsIncludingPreflight - 1];
          expect(handlerContext.request).toBeInstanceOf(Request);
          expect(handlerContext.request.method).toBe(method);

          const urlRegex = createRegexFromURL(url);
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest(handlerContext.request, { urlRegex });
          expect(parsedRequest.pathParams).toEqual(paths.params);

          expect(response.status).toBe(200);
          await expectMatchedBodyIfNotHead(response);
        });
      });

      it.each([
        {
          use: '/:param',
          fetch: `/${param1}/other`,
        },
        {
          use: '/:param',
          fetch: `/other/${param1}`,
        },
        {
          use: `/${param1}`,
          fetch: `/${param2}`,
        },
        {
          use: `/${param1}`,
          fetch: `/${param1}/other`,
        },
        {
          use: `/${param1}`,
          fetch: `/other/${param1}`,
        },

        {
          use: '/other/path/:param',
          fetch: `/other/path/${param1}/another`,
        },
        {
          use: '/other/path/:param',
          fetch: `/other/${param1}/path`,
        },
        {
          use: `/other/path/${param1}`,
          fetch: `/other/path/${param2}`,
        },
        {
          use: `/other/path/${param1}`,
          fetch: `/other/path/${param1}/another`,
        },
        {
          use: `/other/path/${param1}`,
          fetch: `/other/${param1}/path`,
        },

        {
          use: '/other/:param/path',
          fetch: `/other/${param1}/path/another`,
        },
        {
          use: '/other/:param/path',
          fetch: `/other/path/${param1}`,
        },
        {
          use: `/other/${param1}/path`,
          fetch: `/other/${param2}/path`,
        },
        {
          use: `/other/${param1}/path`,
          fetch: `/other/${param1}/path/another`,
        },
        {
          use: `/other/${param1}/path`,
          fetch: `/other/path/${param1}`,
        },

        {
          use: '/other/:param/path/:other',
          fetch: `/other/${param1}/path/${param2}/another`,
        },
        {
          use: '/other/:param/path/:other',
          fetch: `/other/${param1}/path`,
        },
        {
          use: `/other/${param1}/path/${param2}`,
          fetch: `/other/${param2}/path/${param1}`,
        },
        {
          use: `/other/${param1}/path/${param2}`,
          fetch: `/other/${param1}/path/${param2}/another`,
        },
        {
          use: `/other/${param1}/path/${param2}`,
          fetch: `/other/${param1}/path`,
        },

        {
          use: '/:param/:other',
          fetch: `/${param1}`,
        },
        {
          use: '/:param/:other',
          fetch: `/other/${param1}/${param2}/another`,
        },
        {
          use: `/${param1}/${param2}`,
          fetch: `/${param2}/${param1}`,
        },
        {
          use: `/${param1}/${param2}`,
          fetch: `/${param1}`,
        },
        {
          use: `/${param1}/${param2}`,
          fetch: `/other/${param1}/${param2}/another`,
        },

        {
          use: '/:param/:other/:another',
          fetch: `/${param1}/${param2}`,
        },
        {
          use: '/:param/:other/:another',
          fetch: `/${param1}/${param3}/other/another`,
        },
        {
          use: `/${param1}/${param2}/${param3}`,
          fetch: `/${param3}/${param2}/${param1}`,
        },
        {
          use: `/${param1}/${param2}/${param3}`,
          fetch: `/${param1}/${param2}`,
        },
        {
          use: `/${param1}/${param2}/${param3}`,
          fetch: `/${param1}/${param3}/other/another`,
        },

        {
          use: '/:param/path/:other/:another/path',
          fetch: `/${param1}/path/${param2}/path`,
        },
        {
          use: '/:param/path/:other/:another/path',
          fetch: '/path',
        },
        {
          use: `/${param1}/path/${param2}/${param3}/path`,
          fetch: `/${param3}/path/${param1}/${param2}/path`,
        },
        {
          use: `/${param1}/path/${param2}/${param3}/path`,
          fetch: `/${param1}/path/${param2}/path`,
        },
        {
          use: `/${param1}/path/${param2}/${param3}/path`,
          fetch: '/path',
        },
      ])(
        `should not intercept ${method} requests with non-matching dynamic paths (use $use; fetch $fetch)`,
        async (paths) => {
          const url = joinURL(baseURL, paths.use);

          await usingHttpInterceptorWorker(workerOptions, async (worker) => {
            const interceptor = createDefaultHttpInterceptor();
            await promiseIfRemote(worker.use(interceptor.client(), method, url, spiedRequestHandler), worker);

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
        { use: '/:param/:param', fetch: '/1/1', duplicatedParameter: 'param' },
        { use: '/:param/:param/:param', fetch: '/1/1/1', duplicatedParameter: 'param' },
        { use: '/:param/:other/:param', fetch: '/1/1/1', duplicatedParameter: 'param' },
        { use: '/:param/:other/:param/:other', fetch: '/1/1/1/1', duplicatedParameter: 'param' },
        { use: '/some/:other/path/:other', fetch: '/some/1/path/1', duplicatedParameter: 'other' },
        { use: '/some/path/:other/:other', fetch: '/some/path/1/1', duplicatedParameter: 'other' },
      ])(
        `should throw an error if trying to use a ${method} url with duplicate dynamic path params (use $use)`,
        async (paths) => {
          const url = joinURL(baseURL, paths.use);

          await usingHttpInterceptorWorker(workerOptions, async (worker) => {
            const interceptor = createDefaultHttpInterceptor();

            await expect(async () => {
              await worker.use(interceptor.client(), method, url, spiedRequestHandler);
            }).rejects.toThrowError(new DuplicatedPathParamError(url, paths.duplicatedParameter));

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

          expect(bypassedSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

          const [handlerContext] = bypassedSpiedRequestHandler.mock.calls[numberOfRequestsIncludingPreflight - 1];
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

          expect(delayedSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight + 1);

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

          expect(spiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

          const [handlerContext] = spiedRequestHandler.mock.calls[numberOfRequestsIncludingPreflight - 1];
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

          expect(okSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
          expect(noContentSpiedRequestHandler).not.toHaveBeenCalled();

          let [okHandlerContext] = okSpiedRequestHandler.mock.calls[numberOfRequestsIncludingPreflight - 1];
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

          expect(okSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
          expect(noContentSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

          const [noContentHandlerContext] =
            noContentSpiedRequestHandler.mock.calls[numberOfRequestsIncludingPreflight - 1];
          expect(noContentHandlerContext.request).toBeInstanceOf(Request);
          expect(noContentHandlerContext.request.method).toBe(method);

          await promiseIfRemote(worker.clearInterceptorHandlers(otherInterceptor.client()), worker);

          interceptorsWithHandlers = worker.interceptorsWithHandlers();
          expect(interceptorsWithHandlers).toHaveLength(1);
          expect(interceptorsWithHandlers[0]).toBe(interceptor.client());

          response = await fetch(baseURL, { method });
          expect(response.status).toBe(200);

          expect(okSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight * 2);
          expect(noContentSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

          [okHandlerContext] = okSpiedRequestHandler.mock.calls[numberOfRequestsIncludingPreflight * 2 - 1];
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

          expect(okSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight * 2);
          expect(noContentSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
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

      it(`should throw an error if trying to use ${method} with an invalid url`, () => {
        const invalidURL = 'invalid';

        return usingHttpInterceptorWorker(workerOptions, async (worker) => {
          const interceptor = createDefaultHttpInterceptor();

          await expect(async () => {
            await worker.use(interceptor.client(), method, invalidURL, spiedRequestHandler);
          }).rejects.toThrowError(new InvalidURLError(invalidURL));

          expect(spiedRequestHandler).not.toHaveBeenCalled();
        });
      });
    });
  });
}
