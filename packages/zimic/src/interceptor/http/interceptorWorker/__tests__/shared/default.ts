import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createExtendedURL } from '@/utils/fetch';
import { createInternalHttpInterceptor, usingHttpInterceptorWorker } from '@tests/utils/interceptors';

import NotStartedHttpInterceptorError from '../../../interceptor/errors/NotStartedHttpInterceptorError';
import HttpInterceptorWorker from '../../HttpInterceptorWorker';
import LocalHttpInterceptorWorker from '../../LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../../RemoteHttpInterceptorWorker';
import {
  HttpInterceptorWorkerOptions,
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from '../../types/options';
import { SharedHttpInterceptorWorkerTestOptions } from './types';

export function declareDefaultHttpInterceptorWorkerTests(options: SharedHttpInterceptorWorkerTestOptions) {
  const { platform, startServer, getBaseURL, stopServer } = options;

  const workerOptionsArray: HttpInterceptorWorkerOptions[] = [
    { type: 'local' },
    { type: 'remote', serverURL: createExtendedURL('http://localhost/temporary') },
  ];

  describe.each(workerOptionsArray)('Shared (type $type)', (defaultWorkerOptions) => {
    let baseURL: URL;
    let workerOptions: LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions;

    function createDefaultHttpInterceptor() {
      return createInternalHttpInterceptor<{}>({ type: workerOptions.type, baseURL });
    }

    beforeEach(async () => {
      if (defaultWorkerOptions.type === 'remote') {
        await startServer?.();
      }

      baseURL = await getBaseURL(defaultWorkerOptions.type);

      workerOptions =
        defaultWorkerOptions.type === 'local'
          ? defaultWorkerOptions
          : { ...defaultWorkerOptions, serverURL: createExtendedURL(baseURL.origin) };
    });

    afterEach(async () => {
      if (defaultWorkerOptions.type === 'remote') {
        await stopServer?.();
      }
    });

    it('should initialize using the correct worker and platform', async () => {
      await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
        expect(worker.platform()).toBe(null);
        expect(worker).toBeInstanceOf(HttpInterceptorWorker);
        expect(worker).toBeInstanceOf(
          workerOptions.type === 'remote' ? RemoteHttpInterceptorWorker : LocalHttpInterceptorWorker,
        );

        await worker.start();

        expect(worker.platform()).toBe(platform);

        if (worker instanceof LocalHttpInterceptorWorker) {
          expect(worker.hasInternalBrowserWorker()).toBe(platform === 'browser');
          expect(worker.hasInternalNodeWorker()).toBe(platform === 'node');
        }
      });
    });

    it('should not throw an error when started multiple times', async () => {
      await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
        expect(worker.isRunning()).toBe(false);
        await worker.start();
        expect(worker.isRunning()).toBe(true);
        await worker.start();
        expect(worker.isRunning()).toBe(true);
        await worker.start();
        expect(worker.isRunning()).toBe(true);
      });
    });

    it('should not throw an error when started multiple times concurrently', async () => {
      await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
        expect(worker.isRunning()).toBe(false);

        await Promise.all(
          Array.from({ length: 5 }).map(async () => {
            await worker.start();
            expect(worker.isRunning()).toBe(true);
          }),
        );

        expect(worker.isRunning()).toBe(true);
      });
    });

    it('should not throw an error when stopped while not running', async () => {
      await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
        expect(worker.isRunning()).toBe(false);
        await worker.stop();
        expect(worker.isRunning()).toBe(false);
        await worker.stop();
        expect(worker.isRunning()).toBe(false);
        await worker.stop();
        expect(worker.isRunning()).toBe(false);
      });
    });

    it('should not throw an error when stopped multiple times while running', async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        expect(worker.isRunning()).toBe(true);
        await worker.stop();
        expect(worker.isRunning()).toBe(false);
        await worker.stop();
        expect(worker.isRunning()).toBe(false);
        await worker.stop();
        expect(worker.isRunning()).toBe(false);
      });
    });

    it('should not throw an error when stopped multiple times concurrently', async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        expect(worker.isRunning()).toBe(true);

        await Promise.all(
          Array.from({ length: 5 }).map(async () => {
            await worker.stop();
            expect(worker.isRunning()).toBe(false);
          }),
        );

        expect(worker.isRunning()).toBe(false);
      });
    });

    it('should throw an error if trying to clear handler without a started worker', async () => {
      await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
        expect(worker.isRunning()).toBe(false);

        await expect(async () => {
          await worker.clearHandlers();
        }).rejects.toThrowError(new NotStartedHttpInterceptorError());
      });
    });

    it('should throw an error if trying to clear interceptor handlers without a started worker', async () => {
      await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
        expect(worker.isRunning()).toBe(false);

        const interceptor = createDefaultHttpInterceptor();

        await expect(async () => {
          await worker.clearInterceptorHandlers(interceptor.client());
        }).rejects.toThrowError(new NotStartedHttpInterceptorError());
      });
    });
  });
}
