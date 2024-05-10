import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { HttpMethod } from '@/http/types/schema';
import { PossiblePromise } from '@/types/utils';
import { ExtendedURL, createExtendedURL } from '@/utils/fetch';
import { createInternalHttpInterceptor, usingHttpInterceptor } from '@tests/utils/interceptors';

import NotStartedHttpInterceptorError from '../../errors/NotStartedHttpInterceptorError';
import UnknownHttpInterceptorTypeError from '../../errors/UnknownHttpInterceptorTypeError';
import HttpInterceptorStore from '../../HttpInterceptorStore';
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

function getSingletonWorkerByType(store: HttpInterceptorStore, type: HttpInterceptorType, serverURL: ExtendedURL) {
  return type === 'local' ? store.localWorker() : store.remoteWorker(serverURL);
}

export function declareSharedHttpInterceptorTests(options: SharedHttpInterceptorTestsOptions) {
  const { platform, startServer, getBaseURL, stopServer } = options;

  const store = new HttpInterceptorStore();

  beforeAll(() => {
    store.clear();
  });

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

      expect(store.numberOfRunningLocalInterceptors()).toBe(0);
      expect(store.numberOfRunningRemoteInterceptors(baseURL)).toBe(0);
    });

    afterEach(() => {
      const worker = getSingletonWorkerByType(store, type, serverURL);
      expect(worker).toBeDefined();
      expect(worker!.isRunning()).toBe(false);
      expect(worker!.interceptorsWithHandlers()).toHaveLength(0);

      expect(store.numberOfRunningLocalInterceptors()).toBe(0);
      expect(store.numberOfRunningRemoteInterceptors(baseURL)).toBe(0);
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

          const worker = getSingletonWorkerByType(store, type, serverURL);
          expect(worker!.platform()).toBe(platform);
        });
      });

      it('should now throw an error if started multiple times', async () => {
        const interceptor = createInternalHttpInterceptor(runtimeOptions.getInterceptorOptions());
        expect(interceptor.isRunning()).toBe(false);

        try {
          await interceptor.start();
          expect(interceptor.isRunning()).toBe(true);
          await interceptor.start();
          expect(interceptor.isRunning()).toBe(true);

          await interceptor.stop();
          expect(interceptor.isRunning()).toBe(false);

          await interceptor.start();
          expect(interceptor.isRunning()).toBe(true);
          await interceptor.start();
          expect(interceptor.isRunning()).toBe(true);
        } finally {
          await interceptor.stop();
        }
      });

      it('should not throw an error if stopped multiple times', async () => {
        const interceptor = createInternalHttpInterceptor(runtimeOptions.getInterceptorOptions());
        expect(interceptor.isRunning()).toBe(false);

        await interceptor.stop();
        expect(interceptor.isRunning()).toBe(false);
        await interceptor.stop();
        expect(interceptor.isRunning()).toBe(false);

        try {
          await interceptor.start();
          expect(interceptor.isRunning()).toBe(true);

          await interceptor.stop();
          expect(interceptor.isRunning()).toBe(false);
          await interceptor.stop();
          expect(interceptor.isRunning()).toBe(false);
          await interceptor.stop();
        } finally {
          await interceptor.stop();
        }
      });

      it('should start the shared worker when the first interceptor is started', async () => {
        const interceptor = createInternalHttpInterceptor(runtimeOptions.getInterceptorOptions());
        expect(interceptor.isRunning()).toBe(false);

        const otherInterceptor = createInternalHttpInterceptor(runtimeOptions.getInterceptorOptions());
        expect(otherInterceptor.isRunning()).toBe(false);

        try {
          await interceptor.start();
          expect(interceptor.isRunning()).toBe(true);

          const worker = getSingletonWorkerByType(store, type, serverURL);
          expect(worker).toBeDefined();
          expect(worker!.isRunning()).toBe(true);

          await otherInterceptor.start();
          expect(otherInterceptor.isRunning()).toBe(true);

          expect(worker!.isRunning()).toBe(true);
        } finally {
          await interceptor.stop();
          await otherInterceptor.stop();
        }
      });

      it('should stop the shared worker when the last interceptor is stopped', async () => {
        const interceptor = createInternalHttpInterceptor(runtimeOptions.getInterceptorOptions());
        expect(interceptor.isRunning()).toBe(false);

        const otherInterceptor = createInternalHttpInterceptor(runtimeOptions.getInterceptorOptions());
        expect(otherInterceptor.isRunning()).toBe(false);

        try {
          await interceptor.start();
          expect(interceptor.isRunning()).toBe(true);

          const worker = getSingletonWorkerByType(store, type, serverURL);
          expect(worker).toBeDefined();
          expect(worker!.isRunning()).toBe(true);

          await otherInterceptor.start();
          expect(otherInterceptor.isRunning()).toBe(true);

          expect(worker!.isRunning()).toBe(true);

          await interceptor.stop();
          expect(interceptor.isRunning()).toBe(false);

          expect(worker!.isRunning()).toBe(true);

          await otherInterceptor.stop();
          expect(otherInterceptor.isRunning()).toBe(false);

          expect(worker!.isRunning()).toBe(false);
        } finally {
          await interceptor.stop();
          await otherInterceptor.stop();
        }
      });

      it('should support starting interceptors concurrently', async () => {
        const interceptor = createInternalHttpInterceptor(runtimeOptions.getInterceptorOptions());
        expect(interceptor.isRunning()).toBe(false);

        const otherInterceptor = createInternalHttpInterceptor(runtimeOptions.getInterceptorOptions());
        expect(otherInterceptor.isRunning()).toBe(false);

        try {
          await Promise.all(
            [interceptor, otherInterceptor].map(async (interceptor) => {
              await interceptor.start();
              expect(interceptor.isRunning()).toBe(true);
            }),
          );

          expect(interceptor.isRunning()).toBe(true);
          expect(otherInterceptor.isRunning()).toBe(true);

          const worker = getSingletonWorkerByType(store, type, serverURL);
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

          const worker = getSingletonWorkerByType(store, type, serverURL);
          expect(worker).toBeDefined();
          expect(worker!.isRunning()).toBe(true);

          await otherInterceptor.start();
          expect(otherInterceptor.isRunning()).toBe(true);

          expect(worker!.isRunning()).toBe(true);

          await Promise.all(
            [interceptor, otherInterceptor].map(async (interceptor) => {
              await interceptor.stop();
              expect(interceptor.isRunning()).toBe(false);
            }),
          );

          expect(interceptor.isRunning()).toBe(false);
          expect(otherInterceptor.isRunning()).toBe(false);

          expect(worker!.isRunning()).toBe(false);
        } finally {
          await interceptor.stop();
          await otherInterceptor.stop();
        }
      });

      it('should throw an error when trying to be cleared if not running', async () => {
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
