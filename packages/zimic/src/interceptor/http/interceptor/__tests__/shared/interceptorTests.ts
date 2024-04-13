import { describe } from 'vitest';

import { HttpMethod } from '@/http/types/schema';
import { createHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/factory';
import LocalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/RemoteHttpInterceptorWorker';
import {
  HttpInterceptorWorkerOptions,
  HttpInterceptorWorkerPlatform,
} from '@/interceptor/http/interceptorWorker/types/options';
import { PublicHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/types/public';
import { joinURLPaths } from '@/utils/fetch';

import { HttpInterceptorOptions } from '../../types/options';
import { declareBaseURLHttpInterceptorTests } from './baseURLs';
import { declareDeleteHttpInterceptorTests } from './methods/delete';
import { declareGetHttpInterceptorTests } from './methods/get';
import { declareHeadHttpInterceptorTests } from './methods/head';
import { declareOptionsHttpInterceptorTests } from './methods/options';
import { declarePatchHttpInterceptorTests } from './methods/patch';
import { declarePostHttpInterceptorTests } from './methods/post';
import { declarePutHttpInterceptorTests } from './methods/put';
import { declareTypeHttpInterceptorTests } from './typescript';

export interface SharedHttpInterceptorTestsOptions {
  platform: HttpInterceptorWorkerPlatform;
}

export interface RuntimeSharedHttpInterceptorTestsOptions extends SharedHttpInterceptorTestsOptions {
  worker: LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker;
  baseURL: string;
  interceptorOptions: HttpInterceptorOptions;
}

export function declareSharedHttpInterceptorTests(options: SharedHttpInterceptorTestsOptions) {
  const interceptBaseURL = 'http://localhost:3000';
  const mockServerURL = 'http://localhost:3001';

  const workerOptionsArray: HttpInterceptorWorkerOptions[] = [
    { type: 'local' },
    {
      type: 'remote',
      mockServerURL,
    },
  ];

  function getPathPrefix(workerOptions: HttpInterceptorWorkerOptions) {
    return workerOptions.type === 'local' ? '' : ' /prefix';
  }

  function getBaseURL(workerOptions: HttpInterceptorWorkerOptions) {
    const baseURLWithoutPrefix = workerOptions.type === 'local' ? interceptBaseURL : mockServerURL;
    return joinURLPaths(baseURLWithoutPrefix, getPathPrefix(workerOptions));
  }

  function createWorker(workerOptions: HttpInterceptorWorkerOptions) {
    return createHttpInterceptorWorker(workerOptions) satisfies PublicHttpInterceptorWorker as
      | LocalHttpInterceptorWorker
      | RemoteHttpInterceptorWorker;
  }

  function getInterceptorOptions(
    worker: LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker,
    workerOptions: HttpInterceptorWorkerOptions,
  ): HttpInterceptorOptions {
    return worker.type === 'local'
      ? { worker, baseURL: getBaseURL(workerOptions) }
      : { worker, pathPrefix: getPathPrefix(workerOptions) };
  }

  describe('Types', () => {
    declareTypeHttpInterceptorTests(options);
  });

  describe.each(workerOptionsArray)('Base URLs (type $type)', (workerOptions) => {
    const worker = createWorker(workerOptions);

    declareBaseURLHttpInterceptorTests({
      ...options,
      worker,
      baseURL: getBaseURL(workerOptions),
      interceptorOptions: getInterceptorOptions(worker, workerOptions),
    });
  });

  describe.each(workerOptionsArray)('Methods (type $type)', (workerOptions) => {
    const worker = createWorker(workerOptions);

    const runtimeOptions: RuntimeSharedHttpInterceptorTestsOptions = {
      ...options,
      worker,
      baseURL: getBaseURL(workerOptions),
      interceptorOptions: getInterceptorOptions(worker, workerOptions),
    };

    const methodTestFactories: Record<HttpMethod, () => Promise<void> | void> = {
      GET: declareGetHttpInterceptorTests.bind(null, runtimeOptions),
      POST: declarePostHttpInterceptorTests.bind(null, runtimeOptions),
      PUT: declarePutHttpInterceptorTests.bind(null, runtimeOptions),
      PATCH: declarePatchHttpInterceptorTests.bind(null, runtimeOptions),
      DELETE: declareDeleteHttpInterceptorTests.bind(null, runtimeOptions),
      HEAD: declareHeadHttpInterceptorTests.bind(null, runtimeOptions),
      OPTIONS: declareOptionsHttpInterceptorTests.bind(null, runtimeOptions),
    };

    for (const [method, methodTestFactory] of Object.entries(methodTestFactories)) {
      describe(method, async () => {
        await methodTestFactory();
      });
    }
  });
}
