import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createExtendedURL } from '@/utils/fetch';
import { createInternalHttpInterceptor } from '@tests/utils/interceptors';

import NotStartedHttpInterceptorError from '../../../interceptor/errors/NotStartedHttpInterceptorError';
import { createHttpInterceptorWorker } from '../../factory';
import HttpInterceptorWorker from '../../HttpInterceptorWorker';
import LocalHttpInterceptorWorker from '../../LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../../RemoteHttpInterceptorWorker';
import { HttpInterceptorWorkerOptions } from '../../types/options';
import { SharedHttpInterceptorWorkerTestOptions } from './types';

export function declareDefaultHttpInterceptorWorkerTests(options: SharedHttpInterceptorWorkerTestOptions) {
  const { platform, startServer, getBaseURL, stopServer } = options;

  const workerOptionsArray: HttpInterceptorWorkerOptions[] = [
    { type: 'local' },
    { type: 'remote', serverURL: createExtendedURL('http://localhost/temporary') },
  ];

  describe.each(workerOptionsArray)('Shared (type $type)', (workerOptions) => {
    let worker: LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker | undefined;
    let baseURL: URL;

    function createDefaultWorker() {
      return createHttpInterceptorWorker(
        workerOptions.type === 'local'
          ? workerOptions
          : { ...workerOptions, serverURL: createExtendedURL(baseURL.origin) },
      );
    }

    function createDefaultHttpInterceptor() {
      return createInternalHttpInterceptor<{}>({ type: workerOptions.type, baseURL });
    }

    beforeEach(async () => {
      if (workerOptions.type === 'remote') {
        await startServer?.();
      }

      baseURL = await getBaseURL(workerOptions.type);
    });

    afterEach(async () => {
      await worker?.stop();

      if (workerOptions.type === 'remote') {
        await stopServer?.();
      }
    });

    it('should initialize using the correct worker and platform', async () => {
      worker = createDefaultWorker();

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

    it('should not throw an error when started multiple times', async () => {
      worker = createDefaultWorker();

      expect(worker.isRunning()).toBe(false);
      await worker.start();
      expect(worker.isRunning()).toBe(true);
      await worker.start();
      expect(worker.isRunning()).toBe(true);
      await worker.start();
      expect(worker.isRunning()).toBe(true);
    });

    it('should not throw an error when stopped without running', async () => {
      worker = createDefaultWorker();

      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
    });

    it('should not throw an error when stopped multiple times while running', async () => {
      worker = createDefaultWorker();

      expect(worker.isRunning()).toBe(false);
      await worker.start();
      expect(worker.isRunning()).toBe(true);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
    });

    it('should throw an error if trying to clear handler without a started worker', async () => {
      worker = createDefaultWorker();
      expect(worker.isRunning()).toBe(false);

      await expect(async () => {
        await worker?.clearHandlers();
      }).rejects.toThrowError(new NotStartedHttpInterceptorError());
    });

    it('should throw an error if trying to clear interceptor handlers without a started worker', async () => {
      worker = createDefaultWorker();
      expect(worker.isRunning()).toBe(false);

      const interceptor = createDefaultHttpInterceptor();

      await expect(async () => {
        await worker?.clearInterceptorHandlers(interceptor.client());
      }).rejects.toThrowError(new NotStartedHttpInterceptorError());
    });
  });
}
