import { HttpResponse, HttpHeaders, HTTP_METHODS } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import waitForDelay from '@zimic/utils/time/waitForDelay';
import { PossiblePromise } from '@zimic/utils/types';
import createPathRegExp from '@zimic/utils/url/createPathRegExp';
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
import { HttpResponseFactoryContext } from '../../types/http';
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

    function requestHandler(_context: HttpResponseFactoryContext): PossiblePromise<HttpResponse | null> {
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

        await promiseIfRemote(worker.use(interceptor.client, method, '', spiedRequestHandler), worker);

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

    type PathTestCase =
      | {
          path: string;
          input: string;
          matches: false;
        }
      | {
          path: string;
          input: string;
          matches: true;
          params?: Record<string, string>;
        };

    it.each<PathTestCase>([
      // Empty paths
      { path: '', input: '', matches: true },
      { path: '', input: '/', matches: true },
      { path: '', input: 'other', matches: false },
      { path: '', input: '/other', matches: false },

      // Root paths
      { path: '/', input: '', matches: true },
      { path: '/', input: '/', matches: true },
      { path: '/', input: 'other', matches: false },
      { path: '/', input: '/other', matches: false },

      // Paths not starting or ending with a slash
      { path: 'path', input: 'path', matches: true },
      { path: 'path', input: '/path', matches: true },
      { path: 'path', input: 'other', matches: false },
      { path: 'path', input: '/other', matches: false },

      // Paths starting with a slash
      { path: '/path', input: 'path', matches: true },
      { path: '/path', input: '/path', matches: true },
      { path: '/path', input: 'other', matches: false },
      { path: '/path', input: '/other', matches: false },

      // Paths ending with a slash
      { path: 'path/', input: 'path', matches: true },
      { path: 'path/', input: '/path', matches: true },
      { path: 'path/', input: 'other', matches: false },
      { path: 'path/', input: '/other', matches: false },

      // Paths starting and ending with a slash
      { path: '/path/', input: 'path', matches: true },
      { path: '/path/', input: '/path', matches: true },
      { path: '/path/', input: 'other', matches: false },
      { path: '/path/', input: '/other', matches: false },

      // Path with one param
      { path: ':p1', input: '', matches: false },
      { path: ':p1', input: '/', matches: false },
      { path: ':p1', input: 'v1', matches: true, params: { p1: 'v1' } },
      { path: ':p1', input: 'v1/', matches: true, params: { p1: 'v1' } },
      { path: ':p1', input: '/v1', matches: true, params: { p1: 'v1' } },
      { path: ':p1', input: '/v1/', matches: true, params: { p1: 'v1' } },
      { path: ':p1', input: ':p1', matches: true, params: { p1: ':p1' } },
      { path: ':p1', input: ':p1/', matches: true, params: { p1: ':p1' } },
      { path: ':p1', input: '/:p1', matches: true, params: { p1: ':p1' } },
      { path: ':p1', input: '/:p1/', matches: true, params: { p1: ':p1' } },
      { path: ':p1', input: 'v1/other', matches: false },
      { path: ':p1', input: '/v1/other', matches: false },

      // Path with one param starting with a slash
      { path: '/:p1', input: '', matches: false },
      { path: '/:p1', input: '/', matches: false },
      { path: '/:p1', input: 'v1', matches: true, params: { p1: 'v1' } },
      { path: '/:p1', input: 'v1/', matches: true, params: { p1: 'v1' } },
      { path: '/:p1', input: '/v1', matches: true, params: { p1: 'v1' } },
      { path: '/:p1', input: '/v1/', matches: true, params: { p1: 'v1' } },
      { path: '/:p1', input: 'v1/other', matches: false },
      { path: '/:p1', input: '/v1/other', matches: false },

      // Path with one param ending with a slash
      { path: ':p1/', input: '', matches: false },
      { path: ':p1/', input: '/', matches: false },
      { path: ':p1/', input: 'v1', matches: true, params: { p1: 'v1' } },
      { path: ':p1/', input: 'v1/', matches: true, params: { p1: 'v1' } },
      { path: ':p1/', input: '/v1', matches: true, params: { p1: 'v1' } },
      { path: ':p1/', input: '/v1/', matches: true, params: { p1: 'v1' } },
      { path: ':p1/', input: 'v1/other', matches: false },
      { path: ':p1/', input: '/v1/other', matches: false },

      // Path with one param starting and ending with a slash
      { path: '/:p1/', input: '', matches: false },
      { path: '/:p1/', input: '/', matches: false },
      { path: '/:p1/', input: 'v1', matches: true, params: { p1: 'v1' } },
      { path: '/:p1/', input: 'v1/', matches: true, params: { p1: 'v1' } },
      { path: '/:p1/', input: '/v1', matches: true, params: { p1: 'v1' } },
      { path: '/:p1/', input: '/v1/', matches: true, params: { p1: 'v1' } },
      { path: '/:p1/', input: 'v1/other', matches: false },
      { path: '/:p1/', input: '/v1/other', matches: false },

      // Paths with one static segment and one param
      { path: '/path/:p1', input: '/path', matches: false },
      { path: '/path/:p1', input: '/other', matches: false },
      { path: '/path/:p1', input: '/path/v1', matches: true, params: { p1: 'v1' } },
      { path: '/path/:p1', input: '/path/v1/other', matches: false },

      // Paths with multiple static segment and one param
      { path: '/path/other/:p1', input: '/path/other', matches: false },
      { path: '/path/other/:p1', input: '/path/other/v1', matches: true, params: { p1: 'v1' } },
      { path: '/path/other/:p1', input: '/path/other/v1/other', matches: false },

      // Paths with one static segment, one param and another static segment
      { path: '/path/:p1/other', input: '/path/other', matches: false },
      { path: '/path/:p1/other', input: '/path/v1/other', matches: true, params: { p1: 'v1' } },
      { path: '/path/:p1/other', input: '/path/v1/other/other', matches: false },

      // Paths with one param and one static segment
      { path: '/:p1/path', input: '/path', matches: false },
      { path: '/:p1/path', input: '/v1/path', matches: true, params: { p1: 'v1' } },
      { path: '/:p1/path', input: '/v1/path/other', matches: false },

      // Paths with multiple params separated by slashes
      { path: ':p1/:p2', input: 'v1', matches: false },
      { path: ':p1/:p2', input: 'v1/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1/:p2', input: 'v1/v2/other', matches: false },
      { path: ':p1/:p2', input: '/v1/v2/other', matches: false },

      // Paths with multiple params separated by non-slash characters
      { path: ':p1-:p2', input: 'v1', matches: false },
      { path: ':p1-:p2', input: 'v1-', matches: false },
      { path: ':p1-:p2', input: 'v1-v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1-:p2', input: 'v1-v2/other', matches: false },
      { path: ':p1-:p2', input: '/v1-v2/other', matches: false },

      // Paths with multiple params separated by no characters
      { path: ':p1:p2', input: 'v1', matches: true, params: { p1: 'v', p2: '1' } },
      { path: ':p1:p2', input: 'v1v2', matches: true, params: { p1: 'v', p2: '1v2' } },
      { path: ':p1:p2', input: 'v1-v2', matches: true, params: { p1: 'v', p2: '1-v2' } },
      { path: ':p1:p2', input: 'v1-v2/other', matches: false },
      { path: ':p1:p2', input: '/v1-v2/other', matches: false },

      // Paths with multiple params separated by segments
      { path: ':p1/other/:p2', input: 'v1/other', matches: false },
      { path: ':p1/other/:p2', input: 'v1/other/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1/other/:p2', input: 'v1/other/v2/other', matches: false },
      { path: ':p1/other/:p2', input: '/v1/other/v2/other', matches: false },

      // Paths with escaped colons
      { path: '\\:p1', input: '', matches: false },
      { path: '\\:p1', input: '/', matches: false },
      { path: '\\:p1', input: 'v1', matches: false },
      { path: '\\:p1', input: 'v1/other', matches: false },
      { path: '\\:p1', input: ':p1', matches: true },
      { path: '\\:p1', input: '\\:p1', matches: false },
      { path: '\\:p1', input: ':p1/other', matches: false },
      { path: '\\:p1/other', input: ':p1/other', matches: true },
      { path: '\\:p1/other/:p2', input: ':p1/other/v2', matches: true, params: { p2: 'v2' } },
      { path: '\\:p1/other/\\:p2', input: ':p1/other/v2', matches: false },
      { path: '\\:p1/other/\\:p2', input: ':p1/other/:p2', matches: true },

      // Paths with one optional param
      { path: ':p1?', input: '', matches: true },
      { path: ':p1?', input: '/', matches: true },
      { path: ':p1', input: 'v1', matches: true, params: { p1: 'v1' } },
      { path: ':p1?', input: 'v1/', matches: true, params: { p1: 'v1' } },
      { path: ':p1?', input: '/v1', matches: true, params: { p1: 'v1' } },
      { path: ':p1?', input: '/v1/', matches: true, params: { p1: 'v1' } },
      { path: ':p1?', input: 'v1/other', matches: false },
      { path: ':p1?', input: 'other/v1', matches: false },

      // Paths with multiple optional params separated by slashes
      { path: ':p1?/:p2?', input: '', matches: true },
      { path: ':p1?/:p2?', input: '/', matches: true },
      { path: ':p1?/:p2?', input: 'v1', matches: true, params: { p1: 'v', p2: '1' } },
      { path: ':p1?/:p2?', input: 'v1/', matches: true, params: { p1: 'v', p2: '1' } },
      { path: ':p1?/:p2?', input: 'v1/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?/:p2?', input: 'v1/v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?/:p2?', input: '/v1/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?/:p2?', input: '/v1/v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?/:p2?', input: 'v1/v2/other', matches: false },
      { path: ':p1?/:p2?', input: 'other/v1/v2', matches: false },

      // Paths with multiple optional params separated by non-slash characters
      { path: ':p1?-:p2?', input: '', matches: false },
      { path: ':p1?-:p2?', input: '-', matches: true },
      { path: ':p1?-:p2?', input: 'v1', matches: false },
      { path: ':p1?-:p2?', input: 'v1-', matches: true, params: { p1: 'v1' } },
      { path: ':p1?-:p2?', input: '/v1-', matches: true, params: { p1: 'v1' } },
      { path: ':p1?-:p2?', input: 'v1-/', matches: true, params: { p1: 'v1' } },
      { path: ':p1?-:p2?', input: '/v1-/', matches: true, params: { p1: 'v1' } },
      { path: ':p1?-:p2?', input: '-v2', matches: true, params: { p2: 'v2' } },
      { path: ':p1?-:p2?', input: '/-v2', matches: true, params: { p2: 'v2' } },
      { path: ':p1?-:p2?', input: '-v2/', matches: true, params: { p2: 'v2' } },
      { path: ':p1?-:p2?', input: '/-v2/', matches: true, params: { p2: 'v2' } },
      { path: ':p1?-:p2?', input: 'v1-v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?-:p2?', input: '/v1-v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?-:p2?', input: 'v1-v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?-:p2?', input: '/v1-v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?-:p2?', input: 'v1-v2/other', matches: false },
      { path: ':p1?-:p2?', input: 'other/v1-v2', matches: false },

      // // Paths with multiple optional params separated by no characters
      { path: ':p1?:p2?', input: '', matches: true },
      { path: ':p1?:p2?', input: '-', matches: true, params: { p1: '-' } },
      { path: ':p1?:p2?', input: 'v1', matches: true, params: { p1: 'v', p2: '1' } },
      { path: ':p1?:p2?', input: 'v1-', matches: true, params: { p1: 'v', p2: '1-' } },
      { path: ':p1?:p2?', input: '/v1-', matches: true, params: { p1: 'v', p2: '1-' } },
      { path: ':p1?:p2?', input: '/v1-/', matches: true, params: { p1: 'v', p2: '1-' } },
      { path: ':p1?:p2?', input: '-v2', matches: true, params: { p1: '-', p2: 'v2' } },
      { path: ':p1?:p2?', input: '/-v2', matches: true, params: { p1: '-', p2: 'v2' } },
      { path: ':p1?:p2?', input: '-v2/', matches: true, params: { p1: '-', p2: 'v2' } },
      { path: ':p1?:p2?', input: '/-v2/', matches: true, params: { p1: '-', p2: 'v2' } },
      { path: ':p1?:p2?', input: 'v1-v2', matches: true, params: { p1: 'v', p2: '1-v2' } },
      { path: ':p1?:p2?', input: '/v1-v2', matches: true, params: { p1: 'v', p2: '1-v2' } },
      { path: ':p1?:p2?', input: 'v1-v2/', matches: true, params: { p1: 'v', p2: '1-v2' } },
      { path: ':p1?:p2?', input: '/v1-v2/', matches: true, params: { p1: 'v', p2: '1-v2' } },
      { path: ':p1?:p2?', input: 'v1-v2/other', matches: false },
      { path: ':p1?:p2?', input: 'other/v1-v2', matches: false },

      // // Paths with multiple optional params separated by segments
      { path: ':p1?/other/:p2?', input: '', matches: false },
      { path: ':p1?/other/:p2?', input: 'other', matches: true },
      { path: ':p1?/other/:p2?', input: 'other/', matches: true },
      { path: ':p1?/other/:p2?', input: '/other', matches: true },
      { path: ':p1?/other/:p2?', input: '/other/', matches: true },
      { path: ':p1?/other/:p2?', input: 'v1', matches: false },
      { path: ':p1?/other/:p2?', input: 'v1/other/', matches: true, params: { p1: 'v1' } },
      { path: ':p1?/other/:p2?', input: '/v1/other/', matches: true, params: { p1: 'v1' } },
      { path: ':p1?/other/:p2?', input: 'v1/other/', matches: true, params: { p1: 'v1' } },
      { path: ':p1?/other/:p2?', input: '/v1/other/', matches: true, params: { p1: 'v1' } },
      { path: ':p1?/other/:p2?', input: '/other/v2', matches: true, params: { p2: 'v2' } },
      { path: ':p1?/other/:p2?', input: '/other/v2', matches: true, params: { p2: 'v2' } },
      { path: ':p1?/other/:p2?', input: '/other/v2/', matches: true, params: { p2: 'v2' } },
      { path: ':p1?/other/:p2?', input: '/other/v2/', matches: true, params: { p2: 'v2' } },
      { path: ':p1?/other/:p2?', input: 'v1/other/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?/other/:p2?', input: '/v1/other/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?/other/:p2?', input: 'v1/other/v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?/other/:p2?', input: '/v1/other/v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?/other/:p2?', input: 'v1/other/v2/other', matches: false },
      { path: ':p1?/other/:p2?', input: 'other/v1-v2', matches: true, params: { p2: 'v1-v2' } },

      // Paths with one required and one optional param
      { path: ':p1/other/:p2?', input: '', matches: false },
      { path: ':p1/other/:p2?', input: 'other', matches: false },
      { path: ':p1/other/:p2?', input: 'other/', matches: false },
      { path: ':p1/other/:p2?', input: '/other', matches: false },
      { path: ':p1/other/:p2?', input: '/other/', matches: false },
      { path: ':p1/other/:p2?', input: 'v1', matches: false },
      { path: ':p1/other/:p2?', input: 'v1/other/', matches: true, params: { p1: 'v1' } },
      { path: ':p1/other/:p2?', input: '/v1/other/', matches: true, params: { p1: 'v1' } },
      { path: ':p1/other/:p2?', input: 'v1/other/', matches: true, params: { p1: 'v1' } },
      { path: ':p1/other/:p2?', input: '/v1/other/', matches: true, params: { p1: 'v1' } },
      { path: ':p1/other/:p2?', input: '/other/v2', matches: false },
      { path: ':p1/other/:p2?', input: '/other/v2', matches: false },
      { path: ':p1/other/:p2?', input: '/other/v2/', matches: false },
      { path: ':p1/other/:p2?', input: '/other/v2/', matches: false },
      { path: ':p1/other/:p2?', input: 'v1/other/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1/other/:p2?', input: '/v1/other/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1/other/:p2?', input: 'v1/other/v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1/other/:p2?', input: '/v1/other/v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1/other/:p2?', input: 'v1/other/v2/other', matches: false },
      { path: ':p1/other/:p2?', input: 'other/v1-v2', matches: false },

      // Paths with one optional and one required param
      { path: ':p1?/other/:p2', input: '', matches: false },
      { path: ':p1?/other/:p2', input: 'other', matches: false },
      { path: ':p1?/other/:p2', input: 'other/', matches: false },
      { path: ':p1?/other/:p2', input: '/other', matches: false },
      { path: ':p1?/other/:p2', input: '/other/', matches: false },
      { path: ':p1?/other/:p2', input: 'v1', matches: false },
      { path: ':p1?/other/:p2', input: 'v1/other/', matches: false },
      { path: ':p1?/other/:p2', input: '/v1/other/', matches: false },
      { path: ':p1?/other/:p2', input: 'v1/other/', matches: false },
      { path: ':p1?/other/:p2', input: '/v1/other/', matches: false },
      { path: ':p1?/other/:p2', input: '/other/v2', matches: true, params: { p2: 'v2' } },
      { path: ':p1?/other/:p2', input: '/other/v2', matches: true, params: { p2: 'v2' } },
      { path: ':p1?/other/:p2', input: '/other/v2/', matches: true, params: { p2: 'v2' } },
      { path: ':p1?/other/:p2', input: '/other/v2/', matches: true, params: { p2: 'v2' } },
      { path: ':p1?/other/:p2', input: 'v1/other/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?/other/:p2', input: '/v1/other/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?/other/:p2', input: 'v1/other/v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?/other/:p2', input: '/v1/other/v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?/other/:p2', input: 'v1/other/v2/other', matches: false },
      { path: ':p1?/other/:p2', input: 'other/v1-v2', matches: true, params: { p2: 'v1-v2' } },

      // Path with one param with repeating
      { path: ':p1+', input: '', matches: false },
      { path: ':p1+', input: '/', matches: false },
      { path: ':p1+', input: 'v1', matches: true, params: { p1: 'v1' } },
      { path: ':p1+', input: 'v1/', matches: true, params: { p1: 'v1/' } },
      { path: ':p1+', input: '/v1', matches: true, params: { p1: 'v1' } },
      { path: ':p1+', input: '/v1/', matches: true, params: { p1: 'v1/' } },
      { path: ':p1+', input: 'v1/other', matches: true, params: { p1: 'v1/other' } },
      { path: ':p1+', input: '/v1/other', matches: true, params: { p1: 'v1/other' } },
      { path: ':p1+', input: 'v1/other/', matches: true, params: { p1: 'v1/other/' } },
      { path: ':p1+', input: '/v1/other/', matches: true, params: { p1: 'v1/other/' } },
      { path: ':p1+', input: 'other/v1', matches: true, params: { p1: 'other/v1' } },
      { path: ':p1+', input: '/other/v1', matches: true, params: { p1: 'other/v1' } },
      { path: ':p1+', input: 'other/v1/', matches: true, params: { p1: 'other/v1/' } },
      { path: ':p1+', input: '/other/v1/', matches: true, params: { p1: 'other/v1/' } },
      { path: ':p1+', input: 'other/v1/other', matches: true, params: { p1: 'other/v1/other' } },
      { path: ':p1+', input: '/other/v1/other', matches: true, params: { p1: 'other/v1/other' } },
      { path: ':p1+', input: 'other/v1/other/', matches: true, params: { p1: 'other/v1/other/' } },
      { path: ':p1+', input: '/other/v1/other/', matches: true, params: { p1: 'other/v1/other/' } },

      // Path with multiple params with repeating separated by slashes
      { path: ':p1+/:p2+', input: '', matches: false },
      { path: ':p1+/:p2+', input: '/', matches: false },
      { path: ':p1+/:p2+', input: 'v1', matches: false },
      { path: ':p1+/:p2+', input: 'v1/', matches: false },
      { path: ':p1+/:p2+', input: 'v1/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1+/:p2+', input: 'v1/v2/', matches: true, params: { p1: 'v1', p2: 'v2/' } },
      { path: ':p1+/:p2+', input: '/v1/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1+/:p2+', input: '/v1/v2/', matches: true, params: { p1: 'v1', p2: 'v2/' } },
      { path: ':p1+/:p2+', input: 'v1/v2/other', matches: true, params: { p1: 'v1/v2', p2: 'other' } },
      { path: ':p1+/:p2+', input: 'other/v1/v2', matches: true, params: { p1: 'other/v1', p2: 'v2' } },
      { path: ':p1+/:p2+', input: 'other/v1/other', matches: true, params: { p1: 'other/v1', p2: 'other' } },
      { path: ':p1+/:p2+', input: '/other/v1/other', matches: true, params: { p1: 'other/v1', p2: 'other' } },
      { path: ':p1+/:p2+', input: 'other/v1/other/', matches: true, params: { p1: 'other/v1', p2: 'other/' } },
      { path: ':p1+/:p2+', input: '/other/v1/other/', matches: true, params: { p1: 'other/v1', p2: 'other/' } },

      // Path with multiple params with repeating separated by non-slash characters
      { path: ':p1+-:p2+', input: '', matches: false },
      { path: ':p1+-:p2+', input: '/', matches: false },
      { path: ':p1+-:p2+', input: 'v1', matches: false },
      { path: ':p1+-:p2+', input: 'v1-', matches: false },
      { path: ':p1+-:p2+', input: 'v1-v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1+-:p2+', input: 'v1-v2/', matches: true, params: { p1: 'v1', p2: 'v2/' } },
      { path: ':p1+-:p2+', input: '/v1-v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1+-:p2+', input: '/v1-v2/', matches: true, params: { p1: 'v1', p2: 'v2/' } },
      { path: ':p1+-:p2+', input: 'v1-v2/other', matches: true, params: { p1: 'v1', p2: 'v2/other' } },
      { path: ':p1+-:p2+', input: 'other/v1-v2', matches: true, params: { p1: 'other/v1', p2: 'v2' } },
      { path: ':p1+-:p2+', input: 'other/v1-other', matches: true, params: { p1: 'other/v1', p2: 'other' } },
      { path: ':p1+-:p2+', input: '/other/v1-other', matches: true, params: { p1: 'other/v1', p2: 'other' } },
      { path: ':p1+-:p2+', input: 'other/v1-other/', matches: true, params: { p1: 'other/v1', p2: 'other/' } },
      { path: ':p1+-:p2+', input: '/other/v1-other/', matches: true, params: { p1: 'other/v1', p2: 'other/' } },

      // Path with multiple params with repeating separated by no characters
      { path: ':p1+:p2+', input: '', matches: false },
      { path: ':p1+:p2+', input: '/', matches: false },
      { path: ':p1+:p2+', input: 'v1', matches: true, params: { p1: 'v', p2: '1' } },
      { path: ':p1+:p2+', input: 'v1/', matches: true, params: { p1: 'v1', p2: '/' } },
      { path: ':p1+:p2+', input: 'v1/v2', matches: true, params: { p1: 'v1/v', p2: '2' } },
      { path: ':p1+:p2+', input: 'v1/v2/', matches: true, params: { p1: 'v1/v2', p2: '/' } },
      { path: ':p1+:p2+', input: '/v1/v2', matches: true, params: { p1: 'v1/v', p2: '2' } },
      { path: ':p1+:p2+', input: '/v1/v2/', matches: true, params: { p1: 'v1/v2', p2: '/' } },
      { path: ':p1+:p2+', input: 'v1/v2/other', matches: true, params: { p1: 'v1/v2/othe', p2: 'r' } },
      { path: ':p1+:p2+', input: 'other/v1/v2', matches: true, params: { p1: 'other/v1/v', p2: '2' } },
      { path: ':p1+:p2+', input: 'other/v1/other', matches: true, params: { p1: 'other/v1/othe', p2: 'r' } },
      { path: ':p1+:p2+', input: '/other/v1/other', matches: true, params: { p1: 'other/v1/othe', p2: 'r' } },
      { path: ':p1+:p2+', input: 'other/v1/other/', matches: true, params: { p1: 'other/v1/other', p2: '/' } },
      { path: ':p1+:p2+', input: '/other/v1/other/', matches: true, params: { p1: 'other/v1/other', p2: '/' } },

      // Paths with one optional repeating param
      { path: ':p1*', input: '', matches: true },
      { path: ':p1*', input: '/', matches: true },
      { path: ':p1', input: 'v1', matches: true, params: { p1: 'v1' } },
      { path: ':p1*', input: 'v1/', matches: true, params: { p1: 'v1' } },
      { path: ':p1*', input: '/v1', matches: true, params: { p1: 'v1' } },
      { path: ':p1*', input: '/v1/', matches: true, params: { p1: 'v1' } },
      { path: ':p1*', input: 'v1/other', matches: true, params: { p1: 'v1/other' } },
      { path: ':p1*', input: 'other/v1', matches: true, params: { p1: 'other/v1' } },

      // Paths with multiple optional repeating params separated by slashes
      { path: ':p1*/:p2*', input: '', matches: true },
      { path: ':p1*/:p2*', input: '/', matches: true },
      { path: ':p1*/:p2*', input: 'v1', matches: true, params: { p1: 'v', p2: '1' } },
      { path: ':p1*/:p2*', input: 'v1/', matches: true, params: { p1: 'v', p2: '1' } },
      { path: ':p1*/:p2*', input: 'v1/v2', matches: true, params: { p1: 'v', p2: '1/v2' } },
      { path: ':p1*/:p2*', input: 'v1/v2/', matches: true, params: { p1: 'v', p2: '1/v2' } },
      { path: ':p1*/:p2*', input: '/v1/v2', matches: true, params: { p1: 'v', p2: '1/v2' } },
      { path: ':p1*/:p2*', input: '/v1/v2/', matches: true, params: { p1: 'v', p2: '1/v2' } },
      { path: ':p1*/:p2*', input: 'v1/v2/other', matches: true, params: { p1: 'v', p2: '1/v2/other' } },
      { path: ':p1*/:p2*', input: 'other/v1/v2', matches: true, params: { p1: 'o', p2: 'ther/v1/v2' } },

      // Paths with multiple optional repeating params separated by non-slash characters
      { path: ':p1*-:p2*', input: '', matches: false },
      { path: ':p1*-:p2*', input: '-', matches: true },
      { path: ':p1*-:p2*', input: 'v1', matches: false },
      { path: ':p1*-:p2*', input: 'v1-', matches: true, params: { p1: 'v1' } },
      { path: ':p1*-:p2*', input: '/v1-', matches: true, params: { p1: 'v1' } },
      { path: ':p1*-:p2*', input: 'v1-/', matches: true, params: { p1: 'v1', p2: '/' } },
      { path: ':p1*-:p2*', input: '/v1-/', matches: true, params: { p1: 'v1', p2: '/' } },
      { path: ':p1*-:p2*', input: '-v2', matches: true, params: { p2: 'v2' } },
      { path: ':p1*-:p2*', input: '/-v2', matches: true, params: { p2: 'v2' } },
      { path: ':p1*-:p2*', input: '-v2/', matches: true, params: { p2: 'v2' } },
      { path: ':p1*-:p2*', input: '/-v2/', matches: true, params: { p2: 'v2' } },
      { path: ':p1*-:p2*', input: 'v1-v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1*-:p2*', input: '/v1-v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1*-:p2*', input: 'v1-v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1*-:p2*', input: '/v1-v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1*-:p2*', input: 'v1-v2/other', matches: true, params: { p1: 'v1', p2: 'v2/other' } },
      { path: ':p1*-:p2*', input: 'other/v1-v2', matches: true, params: { p1: 'other/v1', p2: 'v2' } },

      // Paths with multiple optional repeating params separated by no characters
      { path: ':p1*:p2*', input: '', matches: true },
      { path: ':p1*:p2*', input: '-', matches: true, params: { p1: '-' } },
      { path: ':p1*:p2*', input: 'v1', matches: true, params: { p1: 'v', p2: '1' } },
      { path: ':p1*:p2*', input: 'v1-', matches: true, params: { p1: 'v', p2: '1-' } },
      { path: ':p1*:p2*', input: '/v1-', matches: true, params: { p1: 'v', p2: '1-' } },
      { path: ':p1*:p2*', input: '/v1-/', matches: true, params: { p1: 'v', p2: '1-' } },
      { path: ':p1*:p2*', input: '-v2', matches: true, params: { p1: '-', p2: 'v2' } },
      { path: ':p1*:p2*', input: '/-v2', matches: true, params: { p1: '-', p2: 'v2' } },
      { path: ':p1*:p2*', input: '-v2/', matches: true, params: { p1: '-', p2: 'v2' } },
      { path: ':p1*:p2*', input: '/-v2/', matches: true, params: { p1: '-', p2: 'v2' } },
      { path: ':p1*:p2*', input: 'v1-v2', matches: true, params: { p1: 'v', p2: '1-v2' } },
      { path: ':p1*:p2*', input: '/v1-v2', matches: true, params: { p1: 'v', p2: '1-v2' } },
      { path: ':p1*:p2*', input: 'v1-v2/', matches: true, params: { p1: 'v', p2: '1-v2' } },
      { path: ':p1*:p2*', input: '/v1-v2/', matches: true, params: { p1: 'v', p2: '1-v2' } },
      { path: ':p1*:p2*', input: 'v1-v2/other', matches: true, params: { p1: 'v', p2: '1-v2/other' } },
      { path: ':p1*:p2*', input: 'other/v1-v2', matches: true, params: { p1: 'o', p2: 'ther/v1-v2' } },

      // // Paths with multiple optional repeating params separated by segments
      { path: ':p1*/other/:p2*', input: '', matches: false },
      { path: ':p1*/other/:p2*', input: 'other', matches: true },
      { path: ':p1*/other/:p2*', input: 'other/', matches: true, params: { p2: '/' } },
      { path: ':p1*/other/:p2*', input: '/other', matches: true },
      { path: ':p1*/other/:p2*', input: '/other/', matches: true, params: { p2: '/' } },
      { path: ':p1*/other/:p2*', input: 'v1', matches: false },
      { path: ':p1*/other/:p2*', input: 'v1/other/', matches: true, params: { p1: 'v1', p2: '/' } },
      { path: ':p1*/other/:p2*', input: '/v1/other/', matches: true, params: { p1: 'v1', p2: '/' } },
      { path: ':p1*/other/:p2*', input: 'v1/other/', matches: true, params: { p1: 'v1', p2: '/' } },
      { path: ':p1*/other/:p2*', input: '/v1/other/', matches: true, params: { p1: 'v1', p2: '/' } },
      { path: ':p1*/other/:p2*', input: '/other/v2', matches: true, params: { p2: 'v2' } },
      { path: ':p1*/other/:p2*', input: '/other/v2', matches: true, params: { p2: 'v2' } },
      { path: ':p1*/other/:p2*', input: '/other/v2/', matches: true, params: { p2: 'v2' } },
      { path: ':p1*/other/:p2*', input: '/other/v2/', matches: true, params: { p2: 'v2' } },
      { path: ':p1*/other/:p2*', input: 'v1/other/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1*/other/:p2*', input: '/v1/other/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1*/other/:p2*', input: 'v1/other/v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1*/other/:p2*', input: '/v1/other/v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1*/other/:p2*', input: 'v1/other/v2/other', matches: true, params: { p1: 'v1', p2: 'v2/other' } },
      { path: ':p1*/other/:p2*', input: 'other/v1-v2', matches: true, params: { p2: 'v1-v2' } },

      // Paths with one required and one optional repeating param
      { path: ':p1/other/:p2*', input: '', matches: false },
      { path: ':p1/other/:p2*', input: 'other', matches: false },
      { path: ':p1/other/:p2*', input: 'other/', matches: false },
      { path: ':p1/other/:p2*', input: '/other', matches: false },
      { path: ':p1/other/:p2*', input: '/other/', matches: false },
      { path: ':p1/other/:p2*', input: 'v1', matches: false },
      { path: ':p1/other/:p2*', input: 'v1/other/', matches: true, params: { p1: 'v1', p2: '/' } },
      { path: ':p1/other/:p2*', input: '/v1/other/', matches: true, params: { p1: 'v1', p2: '/' } },
      { path: ':p1/other/:p2*', input: 'v1/other/', matches: true, params: { p1: 'v1', p2: '/' } },
      { path: ':p1/other/:p2*', input: '/v1/other/', matches: true, params: { p1: 'v1', p2: '/' } },
      { path: ':p1/other/:p2*', input: '/other/v2', matches: false },
      { path: ':p1/other/:p2*', input: '/other/v2', matches: false },
      { path: ':p1/other/:p2*', input: '/other/v2/', matches: false },
      { path: ':p1/other/:p2*', input: '/other/v2/', matches: false },
      { path: ':p1/other/:p2*', input: 'v1/other/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1/other/:p2*', input: '/v1/other/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1/other/:p2*', input: 'v1/other/v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1/other/:p2*', input: '/v1/other/v2/', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1/other/:p2*', input: 'v1/other/v2/other', matches: true, params: { p1: 'v1', p2: 'v2/other' } },
      { path: ':p1/other/:p2*', input: 'other/v1-v2', matches: false },

      // Paths with one optional and one required repeating param
      { path: ':p1?/other/:p2+', input: '', matches: false },
      { path: ':p1?/other/:p2+', input: 'other', matches: false },
      { path: ':p1?/other/:p2+', input: 'other/', matches: false },
      { path: ':p1?/other/:p2+', input: '/other', matches: false },
      { path: ':p1?/other/:p2+', input: '/other/', matches: false },
      { path: ':p1?/other/:p2+', input: 'v1', matches: false },
      { path: ':p1?/other/:p2+', input: 'v1/other/', matches: false },
      { path: ':p1?/other/:p2+', input: '/v1/other/', matches: false },
      { path: ':p1?/other/:p2+', input: 'v1/other/', matches: false },
      { path: ':p1?/other/:p2+', input: '/v1/other/', matches: false },
      { path: ':p1?/other/:p2+', input: '/other/v2', matches: true, params: { p2: 'v2' } },
      { path: ':p1?/other/:p2+', input: '/other/v2', matches: true, params: { p2: 'v2' } },
      { path: ':p1?/other/:p2+', input: '/other/v2/', matches: true, params: { p2: 'v2/' } },
      { path: ':p1?/other/:p2+', input: '/other/v2/', matches: true, params: { p2: 'v2/' } },
      { path: ':p1?/other/:p2+', input: 'v1/other/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?/other/:p2+', input: '/v1/other/v2', matches: true, params: { p1: 'v1', p2: 'v2' } },
      { path: ':p1?/other/:p2+', input: 'v1/other/v2/', matches: true, params: { p1: 'v1', p2: 'v2/' } },
      { path: ':p1?/other/:p2+', input: '/v1/other/v2/', matches: true, params: { p1: 'v1', p2: 'v2/' } },
      { path: ':p1?/other/:p2+', input: 'v1/other/v2/other', matches: true, params: { p1: 'v1', p2: 'v2/other' } },
      { path: ':p1?/other/:p2+', input: 'other/v1-v2', matches: true, params: { p2: 'v1-v2' } },

      // Paths with wildcards
      { path: '*', input: '', matches: true },
      { path: '*', input: '/', matches: true },
      { path: '*', input: 'v1', matches: true },
      { path: '*', input: '/v1', matches: true },
      { path: '*', input: 'v1/', matches: true },
      { path: '*', input: '/v1/', matches: true },
      { path: '*', input: 'v1/other', matches: false },
      { path: '*', input: '/v1/other', matches: false },
      { path: '*', input: 'v1/other/', matches: false },
      { path: '*', input: '/v1/other/', matches: false },
      { path: '*', input: 'other/v1/other', matches: false },

      // Paths with wildcards starting with a slash
      { path: '/*', input: '', matches: true },
      { path: '/*', input: '/', matches: true },
      { path: '/*', input: 'v1', matches: true },
      { path: '/*', input: '/v1', matches: true },
      { path: '/*', input: 'v1/', matches: true },
      { path: '/*', input: '/v1/', matches: true },
      { path: '/*', input: 'v1/other', matches: false },
      { path: '/*', input: '/v1/other', matches: false },
      { path: '/*', input: 'v1/other/', matches: false },
      { path: '/*', input: '/v1/other/', matches: false },
      { path: '/*', input: 'other/v1/other', matches: false },

      // Paths with wildcards ending with a slash
      { path: '*/', input: '', matches: true },
      { path: '*/', input: '/', matches: true },
      { path: '*/', input: 'v1', matches: true },
      { path: '*/', input: '/v1', matches: true },
      { path: '*/', input: 'v1/', matches: true },
      { path: '*/', input: '/v1/', matches: true },
      { path: '*/', input: 'v1/other', matches: false },
      { path: '*/', input: '/v1/other', matches: false },
      { path: '*/', input: 'v1/other/', matches: false },
      { path: '*/', input: '/v1/other/', matches: false },
      { path: '*/', input: 'other/v1/other', matches: false },

      // Paths with wildcards starting and ending with a slash
      { path: '/*/', input: '', matches: true },
      { path: '/*/', input: '/', matches: true },
      { path: '/*/', input: 'v1', matches: true },
      { path: '/*/', input: '/v1', matches: true },
      { path: '/*/', input: 'v1/', matches: true },
      { path: '/*/', input: '/v1/', matches: true },
      { path: '/*/', input: 'v1/other', matches: false },
      { path: '/*/', input: '/v1/other', matches: false },
      { path: '/*/', input: 'v1/other/', matches: false },
      { path: '/*/', input: '/v1/other/', matches: false },
      { path: '/*/', input: 'other/v1/other', matches: false },

      // Paths with one static segment and a wildcard
      { path: '/path/*', input: '', matches: false },
      { path: '/path/*', input: '/', matches: false },
      { path: '/path/*', input: 'path', matches: false },
      { path: '/path/*', input: '/path', matches: false },
      { path: '/path/*', input: 'path/', matches: true },
      { path: '/path/*', input: '/path/', matches: true },
      { path: '/path/*', input: 'path/other', matches: true },
      { path: '/path/*', input: 'path/other/other', matches: false },
      { path: '/path/*', input: 'other/path/other', matches: false },

      // Paths with a wildcard expecting a segment prefix
      { path: '/path*', input: '', matches: false },
      { path: '/path*', input: '/', matches: false },
      { path: '/path*', input: 'path', matches: true },
      { path: '/path*', input: '/path', matches: true },
      { path: '/path*', input: 'path/', matches: true },
      { path: '/path*', input: '/path/', matches: true },
      { path: '/path*', input: 'path-other', matches: true },
      { path: '/path*', input: '/path-other', matches: true },
      { path: '/path*', input: 'path-other/', matches: true },
      { path: '/path*', input: '/path-other/', matches: true },
      { path: '/path*', input: 'other-path', matches: false },
      { path: '/path*', input: '/other-path', matches: false },
      { path: '/path*', input: 'other-path/', matches: false },
      { path: '/path*', input: '/other-path/', matches: false },
      { path: '/path*', input: 'other-path-other', matches: false },
      { path: '/path*', input: '/other-path-other', matches: false },
      { path: '/path*', input: 'other-path-other/', matches: false },
      { path: '/path*', input: '/other-path-other/', matches: false },
      { path: '/path*', input: 'path/other', matches: false },
      { path: '/path*', input: 'path/other/other', matches: false },
      { path: '/path*', input: 'other/path/other', matches: false },

      // Paths with a wildcard expecting a segment containment
      { path: '/*path*', input: '', matches: false },
      { path: '/*path*', input: '/', matches: false },
      { path: '/*path*', input: 'path', matches: true },
      { path: '/*path*', input: '/path', matches: true },
      { path: '/*path*', input: 'path/', matches: true },
      { path: '/*path*', input: '/path/', matches: true },
      { path: '/*path*', input: 'path-other', matches: true },
      { path: '/*path*', input: '/path-other', matches: true },
      { path: '/*path*', input: 'path-other/', matches: true },
      { path: '/*path*', input: '/path-other/', matches: true },
      { path: '/*path*', input: 'other-path', matches: true },
      { path: '/*path*', input: '/other-path', matches: true },
      { path: '/*path*', input: 'other-path/', matches: true },
      { path: '/*path*', input: '/other-path/', matches: true },
      { path: '/*path*', input: 'other-path-other', matches: true },
      { path: '/*path*', input: '/other-path-other', matches: true },
      { path: '/*path*', input: 'other-path-other/', matches: true },
      { path: '/*path*', input: '/other-path-other/', matches: true },
      { path: '/*path*', input: 'path/other', matches: false },
      { path: '/*path*', input: 'path/other/other', matches: false },
      { path: '/*path*', input: 'other/path/other', matches: false },

      // Paths with a wildcard expecting a segment suffix
      { path: '/*path', input: '', matches: false },
      { path: '/*path', input: '/', matches: false },
      { path: '/*path', input: 'path', matches: true },
      { path: '/*path', input: '/path', matches: true },
      { path: '/*path', input: 'path/', matches: true },
      { path: '/*path', input: '/path/', matches: true },
      { path: '/*path', input: 'path-other', matches: false },
      { path: '/*path', input: '/path-other', matches: false },
      { path: '/*path', input: 'path-other/', matches: false },
      { path: '/*path', input: '/path-other/', matches: false },
      { path: '/*path', input: 'other-path', matches: true },
      { path: '/*path', input: '/other-path', matches: true },
      { path: '/*path', input: 'other-path/', matches: true },
      { path: '/*path', input: '/other-path/', matches: true },
      { path: '/*path', input: 'other-path-other', matches: false },
      { path: '/*path', input: '/other-path-other', matches: false },
      { path: '/*path', input: 'other-path-other/', matches: false },
      { path: '/*path', input: '/other-path-other/', matches: false },
      { path: '/*path', input: 'path/other', matches: false },
      { path: '/*path', input: 'path/other/other', matches: false },
      { path: '/*path', input: 'other/path/other', matches: false },

      // Paths with multiple static segments and a wildcard
      { path: '/path/*/other', input: '', matches: false },
      { path: '/path/*/other', input: '/', matches: false },
      { path: '/path/*/other', input: 'path', matches: false },
      { path: '/path/*/other', input: '/path', matches: false },
      { path: '/path/*/other', input: 'path/', matches: false },
      { path: '/path/*/other', input: '/path/', matches: false },
      { path: '/path/*/other', input: 'path/other', matches: false },
      { path: '/path/*/other', input: 'path/other/other', matches: true },
      { path: '/path/*/other', input: 'other/path/other', matches: false },

      // Paths with multiple static segments and wildcards
      { path: '/path/*/other/*', input: '', matches: false },
      { path: '/path/*/other/*', input: '/', matches: false },
      { path: '/path/*/other/*', input: 'path', matches: false },
      { path: '/path/*/other/*', input: '/path', matches: false },
      { path: '/path/*/other/*', input: 'path/', matches: false },
      { path: '/path/*/other/*', input: '/path/', matches: false },
      { path: '/path/*/other/*', input: 'path/other', matches: false },
      { path: '/path/*/other/*', input: 'path/other/other', matches: false },
      { path: '/path/*/other/*', input: 'other/path/other', matches: false },
      { path: '/path/*/other/*', input: 'path/other/other/other', matches: true },
      { path: '/path/*/other/*', input: 'path/other/other/other/other', matches: false },

      // Paths with catch-all wildcards
      { path: '**', input: '', matches: true },
      { path: '**', input: '/', matches: true },
      { path: '**', input: 'v1', matches: true },
      { path: '**', input: '/v1', matches: true },
      { path: '**', input: 'v1/', matches: true },
      { path: '**', input: '/v1/', matches: true },
      { path: '**', input: 'v1/other', matches: true },
      { path: '**', input: '/v1/other', matches: true },
      { path: '**', input: 'v1/other/', matches: true },
      { path: '**', input: '/v1/other/', matches: true },
      { path: '**', input: 'other/v1/other', matches: true },

      // Paths with catch-all wildcards starting with a slash
      { path: '/**', input: '', matches: true },
      { path: '/**', input: '/', matches: true },
      { path: '/**', input: 'v1', matches: true },
      { path: '/**', input: '/v1', matches: true },
      { path: '/**', input: 'v1/', matches: true },
      { path: '/**', input: '/v1/', matches: true },
      { path: '/**', input: 'v1/other', matches: true },
      { path: '/**', input: '/v1/other', matches: true },
      { path: '/**', input: 'v1/other/', matches: true },
      { path: '/**', input: '/v1/other/', matches: true },
      { path: '/**', input: 'other/v1/other', matches: true },

      // Paths with catch-all wildcards ending with a slash
      { path: '**/', input: '', matches: true },
      { path: '**/', input: '/', matches: true },
      { path: '**/', input: 'v1', matches: true },
      { path: '**/', input: '/v1', matches: true },
      { path: '**/', input: 'v1/', matches: true },
      { path: '**/', input: '/v1/', matches: true },
      { path: '**/', input: 'v1/other', matches: true },
      { path: '**/', input: '/v1/other', matches: true },
      { path: '**/', input: 'v1/other/', matches: true },
      { path: '**/', input: '/v1/other/', matches: true },
      { path: '**/', input: 'other/v1/other', matches: true },

      // Paths with catch-all wildcards starting and ending with a slash
      { path: '/**/', input: '', matches: true },
      { path: '/**/', input: '/', matches: true },
      { path: '/**/', input: 'v1', matches: true },
      { path: '/**/', input: '/v1', matches: true },
      { path: '/**/', input: 'v1/', matches: true },
      { path: '/**/', input: '/v1/', matches: true },
      { path: '/**/', input: 'v1/other', matches: true },
      { path: '/**/', input: '/v1/other', matches: true },
      { path: '/**/', input: 'v1/other/', matches: true },
      { path: '/**/', input: '/v1/other/', matches: true },
      { path: '/**/', input: 'other/v1/other', matches: true },

      // Paths with catch-all wildcards following by a segment wildcard
      { path: '**/*', input: '', matches: true },
      { path: '**/*', input: '/', matches: true },
      { path: '**/*', input: 'v1', matches: true },
      { path: '**/*', input: '/v1', matches: true },
      { path: '**/*', input: 'v1/', matches: true },
      { path: '**/*', input: '/v1/', matches: true },
      { path: '**/*', input: 'v1/other', matches: true },
      { path: '**/*', input: '/v1/other', matches: true },
      { path: '**/*', input: 'v1/other/', matches: true },
      { path: '**/*', input: '/v1/other/', matches: true },
      { path: '**/*', input: 'other/v1/other', matches: true },

      // Paths with one static segment and a catch-all wildcard
      { path: '/path/**', input: '', matches: false },
      { path: '/path/**', input: '/', matches: false },
      { path: '/path/**', input: 'path', matches: false },
      { path: '/path/**', input: '/path', matches: false },
      { path: '/path/**', input: 'path/', matches: true },
      { path: '/path/**', input: '/path/', matches: true },
      { path: '/path/**', input: 'path/other', matches: true },
      { path: '/path/**', input: 'path/other/other', matches: true },
      { path: '/path/**', input: 'other/path/other', matches: false },

      // Paths with a wildcard expecting a segment prefix
      { path: '/path**', input: '', matches: false },
      { path: '/path**', input: '/', matches: false },
      { path: '/path**', input: 'path', matches: true },
      { path: '/path**', input: '/path', matches: true },
      { path: '/path**', input: 'path/', matches: true },
      { path: '/path**', input: '/path/', matches: true },
      { path: '/path**', input: 'path-other', matches: true },
      { path: '/path**', input: '/path-other', matches: true },
      { path: '/path**', input: 'path-other/', matches: true },
      { path: '/path**', input: '/path-other/', matches: true },
      { path: '/path**', input: 'other-path', matches: false },
      { path: '/path**', input: '/other-path', matches: false },
      { path: '/path**', input: 'other-path/', matches: false },
      { path: '/path**', input: '/other-path/', matches: false },
      { path: '/path**', input: 'other-path-other', matches: false },
      { path: '/path**', input: '/other-path-other', matches: false },
      { path: '/path**', input: 'other-path-other/', matches: false },
      { path: '/path**', input: '/other-path-other/', matches: false },
      { path: '/path**', input: 'path/other', matches: true },
      { path: '/path**', input: 'other/path', matches: false },
      { path: '/path**', input: 'path/other/other', matches: true },
      { path: '/path**', input: 'other/path/other', matches: false },

      // Paths with a wildcard expecting a segment containment
      { path: '/**path**', input: '', matches: false },
      { path: '/**path**', input: '/', matches: false },
      { path: '/**path**', input: 'path', matches: true },
      { path: '/**path**', input: '/path', matches: true },
      { path: '/**path**', input: 'path/', matches: true },
      { path: '/**path**', input: '/path/', matches: true },
      { path: '/**path**', input: 'path-other', matches: true },
      { path: '/**path**', input: '/path-other', matches: true },
      { path: '/**path**', input: 'path-other/', matches: true },
      { path: '/**path**', input: '/path-other/', matches: true },
      { path: '/**path**', input: 'other-path', matches: true },
      { path: '/**path**', input: '/other-path', matches: true },
      { path: '/**path**', input: 'other-path/', matches: true },
      { path: '/**path**', input: '/other-path/', matches: true },
      { path: '/**path**', input: 'other-path-other', matches: true },
      { path: '/**path**', input: '/other-path-other', matches: true },
      { path: '/**path**', input: 'other-path-other/', matches: true },
      { path: '/**path**', input: '/other-path-other/', matches: true },
      { path: '/**path**', input: 'path/other', matches: true },
      { path: '/**path**', input: 'other/path', matches: true },
      { path: '/**path**', input: 'path/other/other', matches: true },
      { path: '/**path**', input: 'other/path/other', matches: true },

      // Paths with a wildcard expecting a segment suffix
      { path: '/**path', input: '', matches: false },
      { path: '/**path', input: '/', matches: false },
      { path: '/**path', input: 'path', matches: true },
      { path: '/**path', input: '/path', matches: true },
      { path: '/**path', input: 'path/', matches: true },
      { path: '/**path', input: '/path/', matches: true },
      { path: '/**path', input: 'path-other', matches: false },
      { path: '/**path', input: '/path-other', matches: false },
      { path: '/**path', input: 'path-other/', matches: false },
      { path: '/**path', input: '/path-other/', matches: false },
      { path: '/**path', input: 'other-path', matches: true },
      { path: '/**path', input: '/other-path', matches: true },
      { path: '/**path', input: 'other-path/', matches: true },
      { path: '/**path', input: '/other-path/', matches: true },
      { path: '/**path', input: 'other-path-other', matches: false },
      { path: '/**path', input: '/other-path-other', matches: false },
      { path: '/**path', input: 'other-path-other/', matches: false },
      { path: '/**path', input: '/other-path-other/', matches: false },
      { path: '/**path', input: 'path/other', matches: false },
      { path: '/**path', input: 'other/path', matches: true },
      { path: '/**path', input: 'path/other/other', matches: false },
      { path: '/**path', input: 'other/path/other', matches: false },

      // Paths with multiple static segments and a catch-all wildcard
      { path: '/path/**/other', input: '', matches: false },
      { path: '/path/**/other', input: '/', matches: false },
      { path: '/path/**/other', input: 'path', matches: false },
      { path: '/path/**/other', input: '/path', matches: false },
      { path: '/path/**/other', input: 'path/', matches: false },
      { path: '/path/**/other', input: '/path/', matches: false },
      { path: '/path/**/other', input: 'path/other', matches: false },
      { path: '/path/**/other', input: 'path/other/other', matches: true },
      { path: '/path/**/other', input: 'other/path/other', matches: false },

      // Paths with multiple static segments and catch-all wildcards
      { path: '/path/**/other/**', input: '', matches: false },
      { path: '/path/**/other/**', input: '/', matches: false },
      { path: '/path/**/other/**', input: 'path', matches: false },
      { path: '/path/**/other/**', input: '/path', matches: false },
      { path: '/path/**/other/**', input: 'path/', matches: false },
      { path: '/path/**/other/**', input: '/path/', matches: false },
      { path: '/path/**/other/**', input: 'path/other', matches: false },
      { path: '/path/**/other/**', input: 'path/other/other', matches: false },
      { path: '/path/**/other/**', input: 'other/path/other', matches: false },
      { path: '/path/**/other/**', input: 'path/other/other/other', matches: true },
      { path: '/path/**/other/**', input: 'path/other/other/other/other', matches: true },
    ])(`should intercept ${method} requests with dynamic paths (path $path, input $input)`, async (testCase) => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor();
        await promiseIfRemote(worker.use(interceptor.client, method, testCase.path, spiedRequestHandler), worker);

        expect(spiedRequestHandler).not.toHaveBeenCalled();

        const responsePromise = fetch(joinURL(baseURL, testCase.input), { method });

        if (testCase.matches) {
          const response = await responsePromise;

          expect(spiedRequestHandler).toHaveBeenCalledTimes(numberOfRequestsIncludingPreflight);

          const [handlerContext] = spiedRequestHandler.mock.calls[numberOfRequestsIncludingPreflight - 1];
          expect(handlerContext.request).toBeInstanceOf(Request);
          expect(handlerContext.request.method).toBe(method);

          const parsedRequest = await HttpInterceptorWorker.parseRawRequest(handlerContext.request, {
            baseURL,
            pathPattern: createPathRegExp(testCase.path),
          });
          expect(parsedRequest.pathParams).toEqual(testCase.params ?? {});

          expect(response.status).toBe(200);
          await expectMatchedBodyIfNotHead(response);
        } else {
          if (overridesPreflightResponse) {
            await expectPreflightResponse(responsePromise);
          } else if (defaultWorkerOptions.type === 'local') {
            await expectBypassedResponse(responsePromise);
          } else {
            await expectFetchError(responsePromise);
          }

          expect(spiedRequestHandler).not.toHaveBeenCalled();
        }
      });
    });

    it.each([
      { path: '/:p1/:p1', input: '/1/1', duplicatedParameter: 'p1' },
      { path: '/:p1/:p1/:p1', input: '/1/1/1', duplicatedParameter: 'p1' },
      { path: '/:p1/:p2/:p1', input: '/1/1/1', duplicatedParameter: 'p1' },
      { path: '/:p1/:p2/:p1/:p2', input: '/1/1/1/1', duplicatedParameter: 'p1' },
      { path: '/some/:p2/path/:p2', input: '/some/1/path/1', duplicatedParameter: 'p2' },
      { path: '/some/path/:p2/:p2', input: '/some/path/1/1', duplicatedParameter: 'p2' },
    ])(
      `should throw an error if trying to use a ${method} url with duplicate dynamic path params (path $path, input $input)`,
      async (testCase) => {
        await usingHttpInterceptorWorker(workerOptions, async (worker) => {
          const interceptor = createDefaultHttpInterceptor();

          await expect(async () => {
            await worker.use(interceptor.client, method, testCase.path, spiedRequestHandler);
          }).rejects.toThrowError(new DuplicatedPathParamError(testCase.path, testCase.duplicatedParameter));

          expect(spiedRequestHandler).not.toHaveBeenCalled();

          const urlExpectedToFail = joinURL(baseURL, testCase.input);

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

        await promiseIfRemote(worker.use(interceptor.client, method, '', emptySpiedRequestHandler), worker);

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

        await promiseIfRemote(worker.use(interceptor.client, method, '', delayedSpiedRequestHandler), worker);

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
          await worker.use(interceptor.client, method, '', spiedRequestHandler);
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
        await promiseIfRemote(worker.use(interceptor.client, method, '', spiedRequestHandler), worker);

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
        await promiseIfRemote(worker.use(interceptor.client, method, '', spiedRequestHandler), worker);

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
        await promiseIfRemote(worker.use(interceptor.client, method, '', spiedRequestHandler), worker);

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

        await promiseIfRemote(worker.use(interceptor.client, method, '', spiedRequestHandler), worker);

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
        await promiseIfRemote(worker.use(interceptor.client, method, '', okSpiedRequestHandler), worker);

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
        await promiseIfRemote(worker.use(otherInterceptor.client, method, '', noContentSpiedRequestHandler), worker);

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
          await worker.use(interceptor.client, method, '', spiedRequestHandler);
        }).rejects.toThrowError(NotRunningHttpInterceptorError);
      });
    });
  });
}
