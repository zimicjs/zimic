import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { HttpMethod } from '@/http/types/schema';
import { PossiblePromise } from '@/types/utils';
import { ExtendedURL } from '@/utils/fetch';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import LocalHttpInterceptorStore from '../../LocalHttpInterceptorStore';
import HttpInterceptorStore from '../../RemoteHttpInterceptorStore';
import { HttpInterceptorType } from '../../types/options';
import { declareBaseURLHttpInterceptorTests } from './baseURLs';
import { declareDeleteHttpInterceptorTests } from './methods/delete';
import { declareGetHttpInterceptorTests } from './methods/get';
import { declareHeadHttpInterceptorTests } from './methods/head';
import { declareOptionsHttpInterceptorTests } from './methods/options';
import { declarePatchHttpInterceptorTests } from './methods/patch';
import { declarePostHttpInterceptorTests } from './methods/post';
import { declarePutHttpInterceptorTests } from './methods/put';
import { SharedHttpInterceptorTestsOptions, RuntimeSharedHttpInterceptorTestsOptions } from './types';
import { declareTypeHttpInterceptorTests } from './typescript';

export function declareSharedHttpInterceptorTests(options: SharedHttpInterceptorTestsOptions) {
  const { platform, startServer, getBaseURL, stopServer } = options;

  const interceptorTypes: HttpInterceptorType[] = ['local', 'remote'];

  describe.each(interceptorTypes)("Type '%s'", (type) => {
    let baseURL: ExtendedURL;

    beforeAll(async () => {
      if (type === 'remote') {
        await startServer?.();
      }

      baseURL = await getBaseURL(type);
    });

    afterEach(() => {
      const worker = type === 'local' ? LocalHttpInterceptorStore.worker() : HttpInterceptorStore.worker(baseURL);
      if (worker) {
        expect(worker.interceptorsWithHandlers()).toHaveLength(0);
      }
    });

    afterAll(async () => {
      const worker = type === 'local' ? LocalHttpInterceptorStore.worker() : HttpInterceptorStore.worker(baseURL);
      if (worker) {
        expect(worker.isRunning()).toBe(false);
      }

      if (type === 'remote') {
        await stopServer?.();
      }
    });

    const runtimeOptions: RuntimeSharedHttpInterceptorTestsOptions = {
      ...options,
      type,
      getBaseURL() {
        return baseURL;
      },
      getInterceptorOptions() {
        return { type, baseURL };
      },
    };

    describe('Default', () => {
      it('should initialize with the correct platform', async () => {
        const interceptorOptions = runtimeOptions.getInterceptorOptions();

        await usingHttpInterceptor<{}>(interceptorOptions, (interceptor) => {
          expect(interceptor.platform()).toBe(platform);
        });
      });
    });

    describe('Types', () => {
      declareTypeHttpInterceptorTests(runtimeOptions);
    });

    describe('Base URLs', () => {
      declareBaseURLHttpInterceptorTests(runtimeOptions);
    });

    describe('Methods', () => {
      const methodTestFactories: Record<HttpMethod, () => PossiblePromise<void>> = {
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
