import { HttpResponse, HttpHeaders, HTTP_METHODS } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import waitForDelay from '@zimic/utils/time/waitForDelay';
import { PossiblePromise } from '@zimic/utils/types';
import createRegExpFromURL from '@zimic/utils/url/createRegExpFromURL';
import joinURL from '@zimic/utils/url/joinURL';
import { DuplicatedPathParamError } from '@zimic/utils/url/validateURLPathParams';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import NotRunningHttpInterceptorError from '@/http/interceptor/errors/NotRunningHttpInterceptorError';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/server/constants';
import { importCrypto } from '@/utils/crypto';
import { expectBypassedResponse, expectPreflightResponse } from '@tests/utils/fetch';
import {
  assessPreflightInterference,
  createInternalHttpInterceptor,
  usingHttpInterceptorWorker,
} from '@tests/utils/interceptors';

import HttpInterceptorWorker from '../../HttpInterceptorWorker';
import { MSWHttpResponseFactoryContext } from '../../types/msw';
import { LocalHttpInterceptorWorkerOptions, RemoteHttpInterceptorWorkerOptions } from '../../types/options';
import { promiseIfRemote } from '../utils/promises';
import { SharedHttpInterceptorWorkerTestOptions } from './types';

export function declareMethodHttpInterceptorWorkerTests(options: SharedHttpInterceptorWorkerTestOptions) {
  const { platform, defaultWorkerOptions, startServer, getBaseURL, stopServer } = options;

  const responseStatus = 200;
  const responseBody = { success: true };

  let baseURL: string;
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
        : { ...defaultWorkerOptions, serverURL: new URL(new URL(baseURL).origin) };
  });

  afterAll(async () => {
    if (defaultWorkerOptions.type === 'remote') {
      await stopServer?.();
    }
  });

  describe.each(HTTP_METHODS)('Method (%s)', (method) => {
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

    function requestHandler(_context: MSWHttpResponseFactoryContext): PossiblePromise<HttpResponse | null> {
      const response = Response.json(responseBody, {
        status: responseStatus,
        headers: defaultHeaders,
      });
      return response as HttpResponse;
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

    it(`should intercept ${method} requests after started`, async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor();

        await promiseIfRemote(worker.use(interceptor.client, method, baseURL, spiedRequestHandler), worker);

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
        use: ':param',
        fetch: param1,
        params: { param: param1 },
      },
      {
        use: ':param',
        fetch: param2,
        params: { param: param2 },
      },
      {
        use: param1,
        fetch: param1,
        params: {},
      },

      {
        use: ':param',
        fetch: `/${param1}`,
        params: { param: param1 },
      },
      {
        use: ':param',
        fetch: `/${param2}`,
        params: { param: param2 },
      },
      {
        use: param1,
        fetch: `/${param1}`,
        params: {},
      },

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
        use: '/:param',
        fetch: param1,
        params: { param: param1 },
      },
      {
        use: '/:param',
        fetch: param2,
        params: { param: param2 },
      },
      {
        use: `/${param1}`,
        fetch: param1,
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
    ])(`should intercept ${method} requests with matching dynamic paths (use $use; fetch $fetch)`, async (path) => {
      const url = joinURL(baseURL, path.use);

      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor();
        await promiseIfRemote(worker.use(interceptor.client, method, url, spiedRequestHandler), worker);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const urlExpectedToSucceed = joinURL(baseURL, path.fetch);
        const response = await fetch(urlExpectedToSucceed, { method });

        expect(spiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

        const [handlerContext] = spiedRequestHandler.mock.calls[numberOfRequestsIncludingPreflight - 1];
        expect(handlerContext.request).toBeInstanceOf(Request);
        expect(handlerContext.request.method).toBe(method);

        const urlRegex = createRegExpFromURL(url);
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest(handlerContext.request, { urlRegex });
        expect(parsedRequest.pathParams).toEqual(path.params);

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
      async (path) => {
        const url = joinURL(baseURL, path.use);

        await usingHttpInterceptorWorker(workerOptions, async (worker) => {
          const interceptor = createDefaultHttpInterceptor();
          await promiseIfRemote(worker.use(interceptor.client, method, url, spiedRequestHandler), worker);

          expect(spiedRequestHandler).not.toHaveBeenCalled();

          const urlExpectedToFail = joinURL(baseURL, path.fetch);

          const responsePromise = fetch(urlExpectedToFail, { method });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else if (defaultWorkerOptions.type === 'local') {
            await expectBypassedResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

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
            await worker.use(interceptor.client, method, url, spiedRequestHandler);
          }).rejects.toThrowError(new DuplicatedPathParamError(new URL(url), paths.duplicatedParameter));

          expect(spiedRequestHandler).not.toHaveBeenCalled();

          const urlExpectedToFail = joinURL(baseURL, paths.fetch);

          const responsePromise = fetch(urlExpectedToFail, { method });

          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else if (defaultWorkerOptions.type === 'local') {
            await expectBypassedResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          expect(spiedRequestHandler).not.toHaveBeenCalled();
        });
      },
    );

    it(`should not intercept ${method} requests that resulted in no mocked response`, async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor();
        const emptySpiedRequestHandler = vi.fn(requestHandler).mockImplementation(() => null);

        await promiseIfRemote(worker.use(interceptor.client, method, baseURL, emptySpiedRequestHandler), worker);

        expect(emptySpiedRequestHandler).not.toHaveBeenCalled();

        const crypto = await importCrypto();

        const responsePromise = fetch(baseURL, {
          method,
          headers: { 'x-id': crypto.randomUUID() }, // Ensure the request is unique.
        });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else if (defaultWorkerOptions.type === 'local') {
          await expectBypassedResponse(responsePromise);
        } else {
          await expectFetchError(responsePromise);
        }

        expect(emptySpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

        const [handlerContext] = emptySpiedRequestHandler.mock.calls[numberOfRequestsIncludingPreflight - 1];
        expect(handlerContext.request).toBeInstanceOf(Request);
        expect(handlerContext.request.method).toBe(method);
      });
    });

    it(`should support intercepting ${method} requests with a delay`, async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor();

        let resolveWaitPromise: (() => void) | undefined;

        let waitPromise = new Promise<void>((resolve) => {
          resolveWaitPromise = resolve;
        });

        const delayedSpiedRequestHandler = vi.fn(requestHandler).mockImplementation(async (context) => {
          await waitPromise;
          return requestHandler(context);
        });

        await promiseIfRemote(worker.use(interceptor.client, method, baseURL, delayedSpiedRequestHandler), worker);

        expect(delayedSpiedRequestHandler).not.toHaveBeenCalled();

        let responsePromise = fetch(baseURL, { method, signal: AbortSignal.timeout(50) });
        await expectFetchError(responsePromise, { canBeAborted: true });

        resolveWaitPromise?.();

        waitPromise = waitForDelay(100);

        responsePromise = fetch(baseURL, { method });
        await expect(responsePromise).resolves.toBeInstanceOf(Response);

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
          await worker.use(interceptor.client, method, baseURL, spiedRequestHandler);
        }).rejects.toThrowError(Error);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const responsePromise = fetch(baseURL, {
          method,
          signal: overridesPreflightResponse ? undefined : AbortSignal.timeout(500),
        });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else if (defaultWorkerOptions.type === 'local') {
          await expectBypassedResponse(responsePromise, { canBeAborted: true });
        } else {
          await expectFetchError(responsePromise, { canBeAborted: true });
        }

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });
    });

    it(`should not intercept ${method} requests after stopped`, async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor();
        await promiseIfRemote(worker.use(interceptor.client, method, baseURL, spiedRequestHandler), worker);

        await worker.stop();

        const responsePromise = fetch(baseURL, {
          method,
          signal: overridesPreflightResponse ? undefined : AbortSignal.timeout(500),
        });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else if (defaultWorkerOptions.type === 'local') {
          await expectBypassedResponse(responsePromise, { canBeAborted: true });
        } else {
          await expectFetchError(responsePromise, { canBeAborted: true });
        }

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });
    });

    it(`should clear all ${method} handlers after stopped`, async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor();
        await promiseIfRemote(worker.use(interceptor.client, method, baseURL, spiedRequestHandler), worker);

        await worker.stop();
        await worker.start();

        const responsePromise = fetch(baseURL, {
          method,
          signal: overridesPreflightResponse ? undefined : AbortSignal.timeout(500),
        });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else if (defaultWorkerOptions.type === 'local') {
          await expectBypassedResponse(responsePromise, { canBeAborted: true });
        } else {
          await expectFetchError(responsePromise, { canBeAborted: true });
        }

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });
    });

    it(`should not intercept ${method} requests having no handler after cleared`, async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor();
        await promiseIfRemote(worker.use(interceptor.client, method, baseURL, spiedRequestHandler), worker);

        await promiseIfRemote(worker.clearHandlers(), worker);

        const responsePromise = fetch(baseURL, { method });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else if (defaultWorkerOptions.type === 'local') {
          await expectBypassedResponse(responsePromise);
        } else {
          await expectFetchError(responsePromise);
        }

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        await promiseIfRemote(worker.use(interceptor.client, method, baseURL, spiedRequestHandler), worker);

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
        const okSpiedRequestHandler = vi.fn(requestHandler).mockImplementation(() => {
          const response = new Response(null, { status: 200, headers: defaultHeaders });
          return response as HttpResponse;
        });
        const noContentSpiedRequestHandler = vi.fn(requestHandler).mockImplementation(() => {
          const response = new Response(null, { status: 204, headers: defaultHeaders });
          return response as HttpResponse;
        });

        const interceptor = createDefaultHttpInterceptor();
        await promiseIfRemote(worker.use(interceptor.client, method, baseURL, okSpiedRequestHandler), worker);

        let interceptorsWithHandlers = worker.interceptorsWithHandlers;

        expect(interceptorsWithHandlers).toHaveLength(1);
        expect(interceptorsWithHandlers[0]).toBe(interceptor.client);

        let response = await fetch(baseURL, { method });
        expect(response.status).toBe(200);

        expect(okSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
        expect(noContentSpiedRequestHandler).not.toHaveBeenCalled();

        let [okHandlerContext] = okSpiedRequestHandler.mock.calls[numberOfRequestsIncludingPreflight - 1];
        expect(okHandlerContext.request).toBeInstanceOf(Request);
        expect(okHandlerContext.request.method).toBe(method);

        const otherInterceptor = createDefaultHttpInterceptor();
        await promiseIfRemote(
          worker.use(otherInterceptor.client, method, baseURL, noContentSpiedRequestHandler),
          worker,
        );

        interceptorsWithHandlers = worker.interceptorsWithHandlers;
        expect(interceptorsWithHandlers).toHaveLength(2);
        expect(interceptorsWithHandlers[0]).toBe(interceptor.client);
        expect(interceptorsWithHandlers[1]).toBe(otherInterceptor.client);

        response = await fetch(baseURL, { method });
        expect(response.status).toBe(204);

        expect(okSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
        expect(noContentSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

        const [noContentHandlerContext] =
          noContentSpiedRequestHandler.mock.calls[numberOfRequestsIncludingPreflight - 1];
        expect(noContentHandlerContext.request).toBeInstanceOf(Request);
        expect(noContentHandlerContext.request.method).toBe(method);

        await promiseIfRemote(worker.clearInterceptorHandlers(otherInterceptor.client), worker);

        interceptorsWithHandlers = worker.interceptorsWithHandlers;
        expect(interceptorsWithHandlers).toHaveLength(1);
        expect(interceptorsWithHandlers[0]).toBe(interceptor.client);

        response = await fetch(baseURL, { method });
        expect(response.status).toBe(200);

        expect(okSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight * 2);
        expect(noContentSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

        [okHandlerContext] = okSpiedRequestHandler.mock.calls[numberOfRequestsIncludingPreflight * 2 - 1];
        expect(okHandlerContext.request).toBeInstanceOf(Request);
        expect(okHandlerContext.request.method).toBe(method);

        await promiseIfRemote(worker.clearInterceptorHandlers(interceptor.client), worker);

        interceptorsWithHandlers = worker.interceptorsWithHandlers;
        expect(interceptorsWithHandlers).toHaveLength(0);

        const responsePromise = fetch(baseURL, { method });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else if (defaultWorkerOptions.type === 'local') {
          await expectBypassedResponse(responsePromise);
        } else {
          await expectFetchError(responsePromise);
        }

        expect(okSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight * 2);
        expect(noContentSpiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);
      });
    });

    it(`should throw an error if trying to apply a ${method} handler before started`, async () => {
      await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
        const interceptor = createDefaultHttpInterceptor();

        await expect(async () => {
          await worker.use(interceptor.client, method, baseURL, spiedRequestHandler);
        }).rejects.toThrowError(NotRunningHttpInterceptorError);
      });
    });

    it(`should throw an error if trying to use ${method} with an invalid url`, () => {
      const invalidURL = 'invalid';

      return usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor();

        await expect(async () => {
          await worker.use(interceptor.client, method, invalidURL, spiedRequestHandler);
        }).rejects.toThrowError(/Invalid URL/);

        expect(spiedRequestHandler).not.toHaveBeenCalled();
      });
    });
  });
}
