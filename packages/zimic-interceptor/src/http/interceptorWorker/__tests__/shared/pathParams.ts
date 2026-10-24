import { HttpSchema } from '@zimic/http';
import { expectFetchError } from '@zimic/utils/fetch';
import { joinURL, DuplicatedPathParamError } from '@zimic/utils/url';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import HttpInterceptorImplementation, {
  SharedHttpInterceptorImplementation,
} from '@/http/interceptor/HttpInterceptorImplementation';
import HttpInterceptorStore from '@/http/interceptor/HttpInterceptorStore';
import LocalHttpRequestHandler from '@/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/http/requestHandler/RemoteHttpRequestHandler';
import { HttpInterceptorRequest } from '@/http/requestHandler/types/requests';
import { usingHttpInterceptorWorker } from '@tests/utils/interceptors';

import HttpInterceptorWorker from '../../HttpInterceptorWorker';
import { LocalHttpInterceptorWorkerOptions, RemoteHttpInterceptorWorkerOptions } from '../../types/options';
import { SharedHttpInterceptorWorkerTestOptions } from './types';

export function declarePathParamsHttpInterceptorWorkerTests(options: SharedHttpInterceptorWorkerTestOptions) {
  const { type, startServer, getBaseURL, stopServer } = options;

  const Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;

  type MethodSchema = HttpSchema.Method<{
    response: { 200: { body: { success: boolean } } };
  }>;

  type Schema = HttpSchema<{
    [path: string]: { GET: MethodSchema };
  }>;

  let baseURL: string;
  let workerOptions: LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions;

  function createDefaultHttpInterceptor(worker: HttpInterceptorWorker) {
    const interceptor = new HttpInterceptorImplementation<Schema>({
      store: new HttpInterceptorStore(),
      baseURL: new URL(baseURL),
      // The interceptor registers its handlers in the worker under test instead of the worker shared by its store.
      createWorker: () => worker,
      deleteWorker: vi.fn(),
      Handler,
      onUnhandledRequest: { action: 'reject', log: false },
    });

    return interceptor as SharedHttpInterceptorImplementation<Schema>;
  }

  const responseBody = { success: true };

  function createResponseDeclaration(_request: HttpInterceptorRequest<string, MethodSchema>) {
    return { status: 200, body: responseBody } as const;
  }

  const spiedResponseDeclarationFactory = vi.fn(createResponseDeclaration);

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);

    workerOptions = type === 'local' ? { type } : { type, serverURL: new URL(new URL(baseURL).origin) };
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  type PathTestCase =
    | { path: string; input: string; matches: false }
    | { path: string; input: string; matches: true; params?: Record<string, string> };

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

    // Paths with multiple optional params separated by no characters
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

    // Paths with multiple optional params separated by segments
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

    // Paths with multiple optional repeating params separated by segments
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
  ])('should intercept requests with dynamic paths (path $path, input $input)', async (testCase) => {
    await usingHttpInterceptorWorker(workerOptions, async (worker) => {
      const interceptor = createDefaultHttpInterceptor(worker);
      await interceptor.start();

      await new Handler(interceptor, 'GET', testCase.path).respond(spiedResponseDeclarationFactory);

      expect(spiedResponseDeclarationFactory).not.toHaveBeenCalled();

      const responsePromise = fetch(joinURL(baseURL, testCase.input), { method: 'GET' });

      if (testCase.matches) {
        const response = await responsePromise;

        expect(spiedResponseDeclarationFactory).toHaveBeenCalledTimes(1);

        const [request] = spiedResponseDeclarationFactory.mock.calls[0];
        expect(request).toBeInstanceOf(Request);
        expect(request.method).toBe('GET');
        expect(request.pathParams).toEqual(testCase.params ?? {});

        expect(response.status).toBe(200);

        const matchedBody = (await response.json()) as typeof responseBody;
        expect(matchedBody).toEqual(responseBody);
      } else {
        await expectFetchError(responsePromise);
        expect(spiedResponseDeclarationFactory).not.toHaveBeenCalled();
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
    'should throw an error if trying to use a url with duplicate dynamic path params (path $path, input $input)',
    async (testCase) => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor(worker);
        await interceptor.start();

        const handler = new Handler(interceptor, 'GET', testCase.path);

        expect(() => {
          worker.use(interceptor, handler.implementation);
        }).toThrow(new DuplicatedPathParamError(testCase.path, testCase.duplicatedParameter));

        const urlExpectedToFail = joinURL(baseURL, testCase.input);

        const responsePromise = fetch(urlExpectedToFail, { method: 'GET' });
        await expectFetchError(responsePromise);
      });
    },
  );
}
