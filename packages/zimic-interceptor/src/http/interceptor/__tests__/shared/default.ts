import { afterEach, beforeAll, expect, it } from 'vitest';

import { ExtendedURL, createURL } from '@/utils/urls';
import {
  createInternalHttpInterceptor,
  getSingletonWorkerByType,
  usingHttpInterceptor,
} from '@tests/utils/interceptors';

import NotStartedHttpInterceptorError from '../../errors/NotStartedHttpInterceptorError';
import UnknownHttpInterceptorTypeError from '../../errors/UnknownHttpInterceptorTypeError';
import HttpInterceptorStore from '../../HttpInterceptorStore';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareDeclareHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const store = new HttpInterceptorStore();

  let baseURL: ExtendedURL;
  let serverURL: ExtendedURL;

  beforeAll(() => {
    store.clear();

    baseURL = getBaseURL();
    serverURL = createURL(baseURL.origin);

    expect(store.numberOfRunningLocalInterceptors()).toBe(0);
    expect(store.numberOfRunningRemoteInterceptors(baseURL)).toBe(0);
  });

  afterEach(() => {
    const worker = getSingletonWorkerByType(store, type, serverURL);

    if (worker) {
      expect(worker.isRunning()).toBe(false);
      expect(worker.interceptorsWithHandlers()).toHaveLength(0);
    }

    expect(store.numberOfRunningLocalInterceptors()).toBe(0);
    expect(store.numberOfRunningRemoteInterceptors(baseURL)).toBe(0);
  });

  it('should throw an error if created with an unknown type', () => {
    // @ts-expect-error Forcing an unknown type.
    const unknownType: HttpInterceptorType = 'unknown';

    expect(() => {
      createInternalHttpInterceptor({
        type: unknownType, // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        baseURL: 'http://localhost:3000',
      });
    }).toThrowError(new UnknownHttpInterceptorTypeError(unknownType));
  });

  it('should initialize with the correct platform', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), (interceptor) => {
      expect(interceptor.platform()).toBe(platform);

      const worker = getSingletonWorkerByType(store, type, serverURL);
      expect(worker!.platform()).toBe(platform);
    });
  });

  it('should now throw an error if started multiple times', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (interceptor) => {
      expect(interceptor.isRunning()).toBe(false);

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
    });
  });

  it('should not throw an error if stopped multiple times', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (interceptor) => {
      expect(interceptor.isRunning()).toBe(false);

      await interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
      await interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);

      await interceptor.start();
      expect(interceptor.isRunning()).toBe(true);

      await interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
      await interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
      await interceptor.stop();
    });
  });

  it('should start the shared worker when the first interceptor is started', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (interceptor) => {
      expect(interceptor.isRunning()).toBe(false);

      await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (otherInterceptor) => {
        expect(otherInterceptor.isRunning()).toBe(false);

        await interceptor.start();
        expect(interceptor.isRunning()).toBe(true);

        const worker = getSingletonWorkerByType(store, type, serverURL);
        expect(worker).toBeDefined();
        expect(worker!.isRunning()).toBe(true);

        await otherInterceptor.start();
        expect(otherInterceptor.isRunning()).toBe(true);

        expect(worker!.isRunning()).toBe(true);
      });
    });
  });

  it('should stop the shared worker when the last interceptor is stopped', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (interceptor) => {
      expect(interceptor.isRunning()).toBe(false);

      await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (otherInterceptor) => {
        expect(otherInterceptor.isRunning()).toBe(false);

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
      });
    });
  });

  it('should support starting interceptors concurrently', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (interceptor) => {
      expect(interceptor.isRunning()).toBe(false);

      await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (otherInterceptor) => {
        expect(otherInterceptor.isRunning()).toBe(false);

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
      });
    });
  });

  it('should support stopping interceptors concurrently', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), async (interceptor) => {
      expect(interceptor.isRunning()).toBe(true);

      await usingHttpInterceptor<{}>(getInterceptorOptions(), async (otherInterceptor) => {
        expect(otherInterceptor.isRunning()).toBe(true);

        const worker = getSingletonWorkerByType(store, type, serverURL);
        expect(worker).toBeDefined();
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
      });
    });
  });

  it('should throw an error when trying to be cleared if not running', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (interceptor) => {
      expect(interceptor.isRunning()).toBe(false);

      await expect(async () => {
        await interceptor.clear();
      }).rejects.toThrowError(new NotStartedHttpInterceptorError());
    });
  });
}
