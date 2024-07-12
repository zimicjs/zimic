import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import NotStartedHttpInterceptorError from '@/interceptor/http/interceptor/errors/NotStartedHttpInterceptorError';
import { createURL } from '@/utils/urls';
import { createInternalHttpInterceptor, usingHttpInterceptorWorker } from '@tests/utils/interceptors';

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
    { type: 'remote', serverURL: createURL('http://localhost/temporary') },
  ];

  describe.each(workerOptionsArray)('Shared (type $type)', (defaultWorkerOptions) => {
    let baseURL: URL;
    let workerOptions: LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions;

    function createDefaultHttpInterceptor() {
      return createInternalHttpInterceptor<{}>({ type: workerOptions.type, baseURL });
    }

    beforeAll(async () => {
      if (defaultWorkerOptions.type === 'remote') {
        await startServer?.();
      }

      baseURL = await getBaseURL(defaultWorkerOptions.type);

      workerOptions =
        defaultWorkerOptions.type === 'local'
          ? defaultWorkerOptions
          : { ...defaultWorkerOptions, serverURL: createURL(baseURL.origin) };
    });

    afterAll(async () => {
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

    it('should throw an error if trying to clear handlers without a running worker', async () => {
      await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
        expect(worker.isRunning()).toBe(false);

        await expect(async () => {
          await worker.clearHandlers();
        }).rejects.toThrowError(new NotStartedHttpInterceptorError());
      });
    });

    it('should throw an error if trying to clear interceptor handlers without a running worker', async () => {
      await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
        expect(worker.isRunning()).toBe(false);

        const interceptor = createDefaultHttpInterceptor();

        await expect(async () => {
          await worker.clearInterceptorHandlers(interceptor.client());
        }).rejects.toThrowError(new NotStartedHttpInterceptorError());
      });
    });

    if (defaultWorkerOptions.type === 'remote') {
      it('should not throw an error if trying to clear handlers without a running web socket client', async () => {
        await usingHttpInterceptorWorker(workerOptions, async (rawWorker) => {
          expect(rawWorker).toBeInstanceOf(RemoteHttpInterceptorWorker);

          const worker = rawWorker as RemoteHttpInterceptorWorker;
          expect(worker.isRunning()).toBe(true);
          expect(worker.webSocketClient().isRunning()).toBe(true);

          // The websocket client automatically stops running if the interceptor server is closed.
          // Let's stop the client manually to simulate that.
          await worker.webSocketClient().stop();

          expect(worker.isRunning()).toBe(true);
          expect(worker.webSocketClient().isRunning()).toBe(false);

          const clearPromise = worker.clearHandlers();
          await expect(clearPromise).resolves.not.toThrowError();
        });
      });

      it('should not throw an error if trying to clear interceptor handlers without a running web socket client', async () => {
        await usingHttpInterceptorWorker(workerOptions, async (rawWorker) => {
          expect(rawWorker).toBeInstanceOf(RemoteHttpInterceptorWorker);

          const worker = rawWorker as RemoteHttpInterceptorWorker;
          expect(worker.isRunning()).toBe(true);
          expect(worker.webSocketClient().isRunning()).toBe(true);

          // The websocket client automatically stops running if the interceptor server is closed.
          // Let's stop the client manually to simulate that.
          await worker.webSocketClient().stop();

          expect(worker.isRunning()).toBe(true);
          expect(worker.webSocketClient().isRunning()).toBe(false);

          const interceptor = createDefaultHttpInterceptor();

          const clearPromise = worker.clearInterceptorHandlers(interceptor.client());
          await expect(clearPromise).resolves.not.toThrowError();
        });
      });
    }
  });
}
