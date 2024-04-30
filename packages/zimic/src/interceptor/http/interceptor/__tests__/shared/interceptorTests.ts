import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { HttpMethod } from '@/http/types/schema';
import LocalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/RemoteHttpInterceptorWorker';
import {
  HttpInterceptorWorkerOptions,
  HttpInterceptorWorkerPlatform,
  HttpInterceptorWorkerType,
} from '@/interceptor/http/interceptorWorker/types/options';
import { PossiblePromise } from '@/types/utils';
import { createInternalHttpInterceptorWorker } from '@tests/utils/interceptors';
import { AccessResources } from '@tests/utils/workers';

import UnknownHttpInterceptorWorkerError from '../../errors/UnknownHttpInterceptorWorkerError';
import { createHttpInterceptor } from '../../factory';
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
  startServer?: () => PossiblePromise<void>;
  getAccessResources: (type: HttpInterceptorWorkerType) => Promise<AccessResources>;
  stopServer?: () => PossiblePromise<void>;
}

export interface RuntimeSharedHttpInterceptorTestsOptions extends SharedHttpInterceptorTestsOptions {
  getWorker: () => LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker;
  getBaseURL: () => string;
  getPathPrefix: () => string;
  getInterceptorOptions: () => HttpInterceptorOptions;
}

export function declareSharedHttpInterceptorTests(options: SharedHttpInterceptorTestsOptions) {
  const { platform, startServer, getAccessResources, stopServer } = options;

  describe('Default', () => {
    it('should throw an error if the worker is not known', () => {
      const unknownWorker = new (class UnknownWorker {})();

      expect(() => {
        // @ts-expect-error Forcing an invalid worker
        createHttpInterceptor({ worker: unknownWorker });
      }).toThrowError(new UnknownHttpInterceptorWorkerError(unknownWorker));
    });
  });

  describe('Types', () => {
    declareTypeHttpInterceptorTests(options);
  });

  const workerOptionsArray: HttpInterceptorWorkerOptions[] = [
    { type: 'local' },
    { type: 'remote', serverURL: '<temporary>' },
  ];

  describe.each(workerOptionsArray)('type $type', (workerOptions) => {
    let serverURL: string;
    let baseURL: string;
    let pathPrefix: string;

    let worker: LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker;

    beforeAll(async () => {
      if (workerOptions.type === 'remote') {
        await startServer?.();
      }

      ({
        serverURL,
        clientBaseURL: baseURL,
        clientPathPrefix: pathPrefix,
      } = await getAccessResources(workerOptions.type));

      worker = createInternalHttpInterceptorWorker(
        workerOptions.type === 'local' ? workerOptions : { ...workerOptions, serverURL },
      );

      await worker.start();
      expect(worker.platform()).toBe(platform);
    });

    afterEach(() => {
      expect(worker.interceptorsWithHandlers()).toHaveLength(0);
    });

    afterAll(async () => {
      await worker.stop();

      if (workerOptions.type === 'remote') {
        await stopServer?.();
      }
    });

    const runtimeOptions: RuntimeSharedHttpInterceptorTestsOptions = {
      ...options,
      getWorker() {
        return worker;
      },
      getBaseURL() {
        return baseURL;
      },
      getPathPrefix() {
        return pathPrefix;
      },
      getInterceptorOptions() {
        return worker instanceof LocalHttpInterceptorWorker ? { worker, baseURL } : { worker, pathPrefix };
      },
    };

    describe('Base URLs', () => {
      declareBaseURLHttpInterceptorTests(runtimeOptions);
    });

    describe('Methods', () => {
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
  });
}
