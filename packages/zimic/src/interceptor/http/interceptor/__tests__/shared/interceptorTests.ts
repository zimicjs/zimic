import { afterAll, afterEach, beforeAll, describe, expect } from 'vitest';

import { HttpMethod } from '@/http/types/schema';
import LocalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/RemoteHttpInterceptorWorker';
import {
  HttpInterceptorWorkerOptions,
  HttpInterceptorWorkerPlatform,
} from '@/interceptor/http/interceptorWorker/types/options';
import {
  createInternalHttpInterceptorWorker,
  getDefaultBaseURL,
  createDefaultInterceptorOptions,
} from '@tests/utils/interceptors';

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

  describe('Types', () => {
    declareTypeHttpInterceptorTests(options);
  });

  describe.each(workerOptionsArray)('Base URLs (type $type)', (workerOptions) => {
    const worker = createInternalHttpInterceptorWorker(workerOptions);

    beforeAll(async () => {
      await worker.start();
      expect(worker.platform()).toBe(options.platform);
    });

    afterAll(async () => {
      await worker.stop();
    });

    declareBaseURLHttpInterceptorTests({
      ...options,
      worker,
      baseURL: getDefaultBaseURL(workerOptions, { interceptBaseURL, mockServerURL }),
      interceptorOptions: createDefaultInterceptorOptions(worker, workerOptions, { interceptBaseURL, mockServerURL }),
    });
  });

  describe.each(workerOptionsArray)('Methods (type $type)', (workerOptions) => {
    const worker = createInternalHttpInterceptorWorker(workerOptions);

    const runtimeOptions: RuntimeSharedHttpInterceptorTestsOptions = {
      ...options,
      worker,
      baseURL: getDefaultBaseURL(workerOptions, { interceptBaseURL, mockServerURL }),
      interceptorOptions: createDefaultInterceptorOptions(worker, workerOptions, { interceptBaseURL, mockServerURL }),
    };

    beforeAll(async () => {
      await worker.start();
      expect(worker.platform()).toBe(options.platform);
    });

    afterEach(() => {
      expect(worker.interceptorsWithHandlers()).toHaveLength(0);
    });

    afterAll(async () => {
      await worker.stop();
    });

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
