import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { HttpMethod } from '@/http/types/schema';
import { PossiblePromise } from '@/types/utils';
import { ExtendedURL, createExtendedURL } from '@/utils/fetch';
import { createInternalHttpInterceptor, usingHttpInterceptor } from '@tests/utils/interceptors';

import NotStartedHttpInterceptorError from '../../errors/NotStartedHttpInterceptorError';
import UnknownHttpInterceptorTypeError from '../../errors/UnknownHttpInterceptorTypeError';
import LocalHttpInterceptorStore from '../../LocalHttpInterceptorStore';
import RemoteHttpInterceptorStore from '../../RemoteHttpInterceptorStore';
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

function getWorkerSingletonByType(type: HttpInterceptorType, serverURL: ExtendedURL) {
  if (type === 'local') {
    return LocalHttpInterceptorStore.worker();
  }
  return RemoteHttpInterceptorStore.worker(serverURL);
}

export function declareSharedHttpInterceptorTests(options: SharedHttpInterceptorTestsOptions) {
  const { platform, startServer, getBaseURL, stopServer } = options;

  it('should throw an error if created with an unknown type', () => {
    // @ts-expect-error Forcing an unknown type.
    const unknownType: HttpInterceptorType = 'unknown';

    expect(() => {
      // @ts-expect-error
      createInternalHttpInterceptor({ type: unknownType });
    }).toThrowError(new UnknownHttpInterceptorTypeError(unknownType));
  });

  const interceptorTypes: HttpInterceptorType[] = ['local', 'remote'];

  describe.each(interceptorTypes)("Type '%s'", (type) => {
    let baseURL: ExtendedURL;
    let serverURL: ExtendedURL;

    beforeAll(async () => {
      if (type === 'remote') {
        await startServer?.();
      }

      baseURL = await getBaseURL(type);
      serverURL = createExtendedURL(baseURL.origin);
    });

    afterEach(() => {
      const worker = getWorkerSingletonByType(type, serverURL);
      if (worker) {
        expect(worker.isRunning()).toBe(false);
        expect(worker.interceptorsWithHandlers()).toHaveLength(0);
      }
    });

    afterAll(async () => {
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
        await usingHttpInterceptor<{}>({ type, baseURL }, (interceptor) => {
          expect(interceptor.platform()).toBe(platform);

          const worker = getWorkerSingletonByType(type, serverURL);
          expect(worker!.platform()).toBe(platform);
        });
      });

      it('should support starting interceptors concurrently', async () => {
        const interceptor = createInternalHttpInterceptor(runtimeOptions.getInterceptorOptions());
        expect(interceptor.isRunning()).toBe(false);

        const otherInterceptor = createInternalHttpInterceptor(runtimeOptions.getInterceptorOptions());
        expect(otherInterceptor.isRunning()).toBe(false);

        try {
          await Promise.all([interceptor.start(), otherInterceptor.start()]);

          expect(interceptor.isRunning()).toBe(true);
          expect(otherInterceptor.isRunning()).toBe(true);

          const worker = getWorkerSingletonByType(type, serverURL);
          expect(worker).toBeDefined();
          expect(worker!.isRunning()).toBe(true);
        } finally {
          await interceptor.stop();
          await otherInterceptor.stop();
        }
      });

      it('should support stopping interceptors concurrently', async () => {
        const interceptor = createInternalHttpInterceptor(runtimeOptions.getInterceptorOptions());
        expect(interceptor.isRunning()).toBe(false);

        const otherInterceptor = createInternalHttpInterceptor(runtimeOptions.getInterceptorOptions());
        expect(otherInterceptor.isRunning()).toBe(false);

        try {
          await interceptor.start();
          expect(interceptor.isRunning()).toBe(true);

          await otherInterceptor.start();
          expect(otherInterceptor.isRunning()).toBe(true);

          await Promise.all([interceptor.stop(), otherInterceptor.stop()]);

          expect(interceptor.isRunning()).toBe(false);
          expect(otherInterceptor.isRunning()).toBe(false);
        } finally {
          await interceptor.stop();
          await otherInterceptor.stop();
        }
      });

      it('should throw an error if trying to create a request tracker if not running', async () => {
        const interceptor = createInternalHttpInterceptor(runtimeOptions.getInterceptorOptions());
        expect(interceptor.isRunning()).toBe(false);

        await expect(async () => {
          await interceptor.get('/');
        }).rejects.toThrowError(new NotStartedHttpInterceptorError());
      });

      it('should throw an error if trying to be cleared if not running', async () => {
        const interceptor = createInternalHttpInterceptor(runtimeOptions.getInterceptorOptions());
        expect(interceptor.isRunning()).toBe(false);

        await expect(async () => {
          await interceptor.clear();
        }).rejects.toThrowError(new NotStartedHttpInterceptorError());
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
