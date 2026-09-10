import { afterEach, beforeAll, describe, expect, expectTypeOf, it, vi } from 'vitest';

import HttpInterceptorStore from '@/http/interceptor/HttpInterceptorStore';
import LocalHttpInterceptorWorker from '@/http/interceptorWorker/LocalHttpInterceptorWorker';
import { createInternalHttpInterceptor, usingHttpInterceptor } from '@tests/utils/interceptors';

import NotRunningHttpInterceptorError from '../../errors/NotRunningHttpInterceptorError';
import RunningHttpInterceptorError from '../../errors/RunningHttpInterceptorError';
import UnknownHttpInterceptorTypeError from '../../errors/UnknownHttpInterceptorTypeError';
import { createHttpInterceptor } from '../../factory';
import LocalHttpInterceptor from '../../LocalHttpInterceptor';
import RemoteHttpInterceptor from '../../RemoteHttpInterceptor';
import { RemoteHttpInterceptorOptions } from '../../types/options';
import {
  LocalHttpInterceptor as PublicLocalHttpInterceptor,
  RemoteHttpInterceptor as PublicRemoteHttpInterceptor,
} from '../../types/public';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareDeclareHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const store = new HttpInterceptorStore();

  let baseURL: string;
  let serverURL: URL;

  beforeAll(() => {
    baseURL = getBaseURL();
    serverURL = new URL(baseURL);

    const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
    expect(worker).toBe(undefined);

    expect(store.numberOfRunningLocalInterceptors).toBe(0);
    expect(store.numberOfRunningRemoteInterceptors(serverURL)).toBe(0);
  });

  afterEach(() => {
    const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
    expect(worker).toBe(undefined);

    expect(store.numberOfRunningLocalInterceptors).toBe(0);
    expect(store.numberOfRunningRemoteInterceptors(serverURL)).toBe(0);
  });

  describe('Types', () => {
    if (type === 'local') {
      it.each(['local' as const, undefined])('should create a local interceptor (type: %s)', (type) => {
        const interceptor = createHttpInterceptor<{}>({
          type,
          baseURL,
        });

        expectTypeOf(interceptor).toEqualTypeOf<PublicLocalHttpInterceptor<{}>>();
        expect(interceptor.type).toBe('local');
        expect(interceptor).toBeInstanceOf(LocalHttpInterceptor);
      });
    }

    if (type === 'remote') {
      it.each(['remote' as const])('should create a remote interceptor (type: %s)', (type) => {
        const interceptor = createHttpInterceptor<{}>({
          type,
          baseURL,
        });

        expectTypeOf(interceptor).toEqualTypeOf<PublicRemoteHttpInterceptor<{}>>();
        expect(interceptor.type).toBe('remote');
        expect(interceptor).toBeInstanceOf(RemoteHttpInterceptor);
      });
    }

    it('should throw an error if created with an unknown type', () => {
      // @ts-expect-error Forcing an unknown type.
      const unknownType: HttpInterceptorType = 'unknown';

      expect(() => {
        createInternalHttpInterceptor({
          type: unknownType, // eslint-disable-line @typescript-eslint/no-unsafe-assignment
          baseURL,
        });
      }).toThrow(new UnknownHttpInterceptorTypeError(unknownType));
    });
  });

  it('should initialize with the correct platform', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), (interceptor) => {
      expect(interceptor.platform).toBe(platform);

      const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
      expect(worker!.platform).toBe(platform);
    });
  });

  it('should not throw an error if started multiple times', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (interceptor) => {
      expect(interceptor.isRunning).toBe(false);

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);

      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
    });
  });

  it('should support starting and stopping the same interceptor concurrently', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (interceptor) => {
      await Promise.all([interceptor.start(), interceptor.start()]);
      expect(interceptor.isRunning).toBe(true);

      await Promise.all([interceptor.stop(), interceptor.stop()]);
      expect(interceptor.isRunning).toBe(false);

      const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
      expect(worker).toBe(undefined);
    });
  });

  it('should support stopping while starting', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (interceptor) => {
      await Promise.all([interceptor.start(), interceptor.stop()]);

      expect(interceptor.isRunning).toBe(false);

      const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
      expect(worker).toBe(undefined);
    });
  });

  it('should support starting while stopping', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), async (interceptor) => {
      await Promise.all([interceptor.stop(), interceptor.start()]);

      expect(interceptor.isRunning).toBe(true);

      const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
      expect(worker).toBeDefined();
      expect(worker!.isRunning).toBe(true);
    });
  });

  it('should process lifecycle operations in call order', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), async (interceptor) => {
      await Promise.all([interceptor.stop(), interceptor.start(), interceptor.stop()]);

      expect(interceptor.isRunning).toBe(false);

      const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
      expect(worker).toBe(undefined);
    });
  });

  it('should not throw an error if stopped multiple times', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (interceptor) => {
      expect(interceptor.isRunning).toBe(false);

      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);
      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);

      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);
      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);
      await interceptor.stop();
    });
  });

  it('should start the shared worker when the first interceptor is started', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (interceptor) => {
      expect(interceptor.isRunning).toBe(false);

      await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (otherInterceptor) => {
        expect(otherInterceptor.isRunning).toBe(false);

        await interceptor.start();
        expect(interceptor.isRunning).toBe(true);

        const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
        expect(worker).toBeDefined();
        expect(worker!.isRunning).toBe(true);

        await otherInterceptor.start();
        expect(otherInterceptor.isRunning).toBe(true);

        expect(worker!.isRunning).toBe(true);
      });
    });
  });

  it('should stop the shared worker when the last interceptor is stopped', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (interceptor) => {
      expect(interceptor.isRunning).toBe(false);

      await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (otherInterceptor) => {
        expect(otherInterceptor.isRunning).toBe(false);

        await interceptor.start();
        expect(interceptor.isRunning).toBe(true);

        const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
        expect(worker).toBeDefined();
        expect(worker!.isRunning).toBe(true);

        await otherInterceptor.start();
        expect(otherInterceptor.isRunning).toBe(true);

        expect(worker!.isRunning).toBe(true);

        await interceptor.stop();
        expect(interceptor.isRunning).toBe(false);

        expect(worker!.isRunning).toBe(true);

        await otherInterceptor.stop();
        expect(otherInterceptor.isRunning).toBe(false);

        expect(worker!.isRunning).toBe(false);
      });
    });
  });

  it('should still stop the shared worker when the last interceptor fails to stop once and retries', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), async (interceptor) => {
      const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
      expect(worker).toBeDefined();
      expect(worker!.isRunning).toBe(true);

      const error = new Error('Unknown error');

      // Stopping normally does not fail. To simulate a failure, we need to mock the stop method to throw an error.
      if (worker instanceof LocalHttpInterceptorWorker) {
        vi.spyOn(worker, 'getMSWWorkerOrCreate').mockRejectedValueOnce(error);
      } else {
        vi.spyOn(worker!.webSocketClient, 'stop').mockRejectedValueOnce(error);
      }

      await expect(interceptor.stop()).rejects.toThrow(error);
      await interceptor.stop();

      expect(interceptor.isRunning).toBe(false);
      expect(worker!.isRunning).toBe(false);

      const stoppedWorker =
        type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
      expect(stoppedWorker).toBeUndefined();

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
    });
  });

  it('should support starting interceptors concurrently', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (interceptor) => {
      await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (otherInterceptor) => {
        await Promise.all([interceptor.start(), otherInterceptor.start()]);

        expect(interceptor.isRunning).toBe(true);
        expect(otherInterceptor.isRunning).toBe(true);

        const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
        expect(worker).toBeDefined();
        expect(worker!.isRunning).toBe(true);
      });
    });
  });

  it('should support stopping interceptors concurrently', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), async (interceptor) => {
      await usingHttpInterceptor<{}>(getInterceptorOptions(), async (otherInterceptor) => {
        const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
        expect(worker).toBeDefined();

        await Promise.all([interceptor.stop(), otherInterceptor.stop()]);

        expect(interceptor.isRunning).toBe(false);
        expect(otherInterceptor.isRunning).toBe(false);
        expect(worker!.isRunning).toBe(false);
      });
    });
  });

  it('should support stopping the last interceptor while another starts', async () => {
    await usingHttpInterceptor<{}>(getInterceptorOptions(), async (interceptor) => {
      await usingHttpInterceptor<{}>(getInterceptorOptions(), { start: false }, async (otherInterceptor) => {
        const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
        expect(worker).toBeDefined();

        const originalWorkerStop = worker!.stop.bind(worker);
        const { promise: workerStopStartedPromise, resolve: markWorkerStopAsStarted } = Promise.withResolvers<void>();

        // We need to inspect the worker stop method to be able to start another interceptor right after it is called.
        vi.spyOn(worker!, 'stop').mockImplementationOnce(async () => {
          markWorkerStopAsStarted();
          await originalWorkerStop();
        });

        const stopPromise = interceptor.stop();
        await workerStopStartedPromise;
        await otherInterceptor.start();
        await stopPromise;

        expect(interceptor.isRunning).toBe(false);
        expect(otherInterceptor.isRunning).toBe(true);

        const runningWorker =
          type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
        expect(runningWorker).toBe(worker);
        expect(runningWorker!.isRunning).toBe(true);
      });
    });
  });

  it('should throw an error when trying to be cleared if not running', async () => {
    const interceptor = createHttpInterceptor<{}>(getInterceptorOptions());
    expect(interceptor.isRunning).toBe(false);

    await expect(async () => {
      await interceptor.clear();
    }).rejects.toThrow(new NotRunningHttpInterceptorError());
  });

  if (type === 'remote') {
    describe('Authentication', () => {
      it('should support changing the authentication options after created', () => {
        const interceptor = createHttpInterceptor<{}>({ type, baseURL });
        expect(interceptor.isRunning).toBe(false);

        expect(interceptor.auth).toBe(undefined);

        const auth: RemoteHttpInterceptorOptions['auth'] = { token: 'token' };

        interceptor.auth = auth;
        expect(interceptor.auth).toEqual(auth);

        const otherAuth: RemoteHttpInterceptorOptions['auth'] = { token: 'other-token' };
        expect(otherAuth).not.toEqual(auth);

        interceptor.auth.token = otherAuth.token;
        expect(interceptor.auth).toEqual(otherAuth);

        interceptor.auth = undefined;

        expect(interceptor.auth).toBe(undefined);
      });

      it('should not support changing the authentication options while running', async () => {
        await usingHttpInterceptor<{}>({ type, baseURL }, async (interceptor) => {
          expect(interceptor.isRunning).toBe(true);

          expect(interceptor.auth).toBe(undefined);

          expect(() => {
            interceptor.auth = { token: 'token' };
          }).toThrow(
            new RunningHttpInterceptorError(
              'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
            ),
          );

          expect(interceptor.auth).toBe(undefined);

          await interceptor.stop();
          expect(interceptor.isRunning).toBe(false);

          const auth: RemoteHttpInterceptorOptions['auth'] = { token: 'token' };

          interceptor.auth = auth;
          expect(interceptor.auth).toEqual(auth);

          await interceptor.start();

          const otherAuth: RemoteHttpInterceptorOptions['auth'] = { token: 'other-token' };
          expect(otherAuth).not.toEqual(auth);

          expect(() => {
            interceptor.auth!.token = otherAuth.token;
          }).toThrow(
            new RunningHttpInterceptorError(
              'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
            ),
          );

          expect(interceptor.auth).toEqual(auth);
        });
      });

      it('should guard constructor-provided authentication options while running', async () => {
        const auth: RemoteHttpInterceptorOptions['auth'] = { token: 'token' };

        await usingHttpInterceptor<{}>({ type, baseURL, auth }, (interceptor) => {
          expect(() => {
            interceptor.auth!.token = 'other-token';
          }).toThrow(
            new RunningHttpInterceptorError(
              'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
            ),
          );

          expect(interceptor.auth).toEqual({ token: 'token' });
        });
      });
    });
  }
}
