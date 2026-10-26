import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import NotRunningHttpInterceptorError from '@/http/interceptor/errors/NotRunningHttpInterceptorError';
import LocalMSWWorkerStore from '@/interceptor/LocalMSWWorkerStore';
import { usingIgnoredConsole } from '@tests/utils/console';
import { createInternalHttpInterceptor, usingHttpInterceptorWorker } from '@tests/utils/interceptors';

import { createHttpInterceptorWorker } from '../../factory';
import HttpInterceptorWorker from '../../HttpInterceptorWorker';
import LocalHttpInterceptorWorker from '../../LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../../RemoteHttpInterceptorWorker';
import { LocalHttpInterceptorWorkerOptions, RemoteHttpInterceptorWorkerOptions } from '../../types/options';
import { SharedHttpInterceptorWorkerTestOptions } from './types';

const workerClasses = {
  local: LocalHttpInterceptorWorker,
  remote: RemoteHttpInterceptorWorker,
};

interface DefaultHttpInterceptorWorkerTestOptions extends SharedHttpInterceptorWorkerTestOptions {
  numberOfLoggedStartErrors: number;
}

export function declareDefaultHttpInterceptorWorkerTests(options: DefaultHttpInterceptorWorkerTestOptions) {
  const { platform, type, numberOfLoggedStartErrors, startServer, getBaseURL, stopServer } = options;

  let baseURL: string;
  let workerOptions: LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions;

  function createDefaultHttpInterceptor() {
    return createInternalHttpInterceptor<{}>({ type: workerOptions.type, baseURL });
  }

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);

    workerOptions = type === 'local' ? { type } : { type, serverURL: new URL(new URL(baseURL).origin) };
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  it('should initialize using the correct worker and platform', async () => {
    await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      expect(worker.platform).toBe(null);
      expect(worker).toBeInstanceOf(HttpInterceptorWorker);
      expect(worker).toBeInstanceOf(workerClasses[workerOptions.type]);

      await worker.start();

      expect(worker.platform).toBe(platform);
    });
  });

  it('should not throw an error when started multiple times', async () => {
    await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      expect(worker.isRunning).toBe(false);
      await worker.start();
      expect(worker.isRunning).toBe(true);
      await worker.start();
      expect(worker.isRunning).toBe(true);
      await worker.start();
      expect(worker.isRunning).toBe(true);
    });
  });

  it('should not throw an error when started multiple times concurrently', async () => {
    await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      expect(worker.isRunning).toBe(false);

      await Promise.all(
        Array.from({ length: 5 }).map(async () => {
          await worker.start();
          expect(worker.isRunning).toBe(true);
        }),
      );

      expect(worker.isRunning).toBe(true);
    });
  });

  it('should throw an error after failing to start due to an unknown error', async () => {
    await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      const error = new Error('Unknown error');

      if (worker instanceof LocalHttpInterceptorWorker) {
        vi.spyOn(worker, 'getMSWWorkerOrCreate').mockRejectedValueOnce(error);
      } else {
        vi.spyOn(worker.webSocketClient, 'start').mockRejectedValueOnce(error);
      }

      await usingIgnoredConsole(['error'], async (console) => {
        await expect(worker.start()).rejects.toThrow(error);

        expect(console.error.mock.calls).toEqual(Array.from({ length: numberOfLoggedStartErrors }, () => [error]));
      });

      expect(worker.isRunning).toBe(false);
    });
  });

  it('should support retrying after failing to start', async () => {
    await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      const error = new Error('Unknown error');

      const startSpy =
        worker instanceof LocalHttpInterceptorWorker
          ? vi.spyOn(worker, 'getMSWWorkerOrCreate')
          : vi.spyOn(worker.webSocketClient, 'start');

      startSpy.mockRejectedValueOnce(error);

      try {
        await usingIgnoredConsole(['error'], async () => {
          await expect(worker.start()).rejects.toThrow(error);
        });

        expect(worker.isRunning).toBe(false);

        await worker.start();

        expect(worker.isRunning).toBe(true);
      } finally {
        startSpy.mockRestore();
      }
    });
  });

  it('should not throw an error when stopped while not running', async () => {
    await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      expect(worker.isRunning).toBe(false);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
    });
  });

  it('should not throw an error when stopped multiple times while running', async () => {
    await usingHttpInterceptorWorker(workerOptions, async (worker) => {
      expect(worker.isRunning).toBe(true);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
    });
  });

  it('should not throw an error when stopped multiple times concurrently', async () => {
    await usingHttpInterceptorWorker(workerOptions, async (worker) => {
      expect(worker.isRunning).toBe(true);

      await Promise.all(
        Array.from({ length: 5 }).map(async () => {
          await worker.stop();
          expect(worker.isRunning).toBe(false);
        }),
      );

      expect(worker.isRunning).toBe(false);
    });
  });

  it('should support retrying after failing to stop', async () => {
    await usingHttpInterceptorWorker(workerOptions, async (worker) => {
      expect(worker.isRunning).toBe(true);

      const error = new Error('Unknown error');

      // Stopping normally does not fail. To simulate a failure, we need to mock the stop method to throw an error.
      if (worker instanceof LocalHttpInterceptorWorker) {
        vi.spyOn(worker, 'getMSWWorkerOrCreate').mockRejectedValueOnce(error);
      } else {
        vi.spyOn(worker.webSocketClient, 'stop').mockRejectedValueOnce(error);
      }

      await expect(worker.stop()).rejects.toThrow(error);
      await worker.stop();

      expect(worker.isRunning).toBe(false);
    });
  });

  it('should support being started while stopping', async () => {
    await usingHttpInterceptorWorker(workerOptions, async (worker) => {
      await Promise.all([worker.stop(), worker.start()]);

      expect(worker.isRunning).toBe(true);
    });
  });

  it('should throw an error if trying to clear handlers without a running worker', async () => {
    await usingHttpInterceptorWorker(workerOptions, { start: false }, (worker) => {
      expect(worker.isRunning).toBe(false);

      expect(() => {
        worker.clearHandlers();
      }).toThrow(new NotRunningHttpInterceptorError());
    });
  });

  it('should throw an error if trying to clear interceptor handlers without a running worker', async () => {
    await usingHttpInterceptorWorker(workerOptions, { start: false }, (worker) => {
      expect(worker.isRunning).toBe(false);

      const interceptor = createDefaultHttpInterceptor();

      expect(() => {
        worker.clearHandlers({ interceptor: interceptor.implementation });
      }).toThrow(new NotRunningHttpInterceptorError());
    });
  });

  if (type === 'remote') {
    it('should close the web socket client after failing to register with the server while starting', async () => {
      await usingHttpInterceptorWorker(workerOptions, { start: false }, async (rawWorker) => {
        expect(rawWorker).toBeInstanceOf(RemoteHttpInterceptorWorker);

        const worker = rawWorker as RemoteHttpInterceptorWorker;
        const error = new Error('Could not register with the server.');

        // The server accepts every valid registration, so no public path makes it fail. The first request after
        // connecting is the registration.
        vi.spyOn(worker.webSocketClient, 'request').mockRejectedValueOnce(error);

        await usingIgnoredConsole(['error'], async (console) => {
          await expect(worker.start()).rejects.toThrow(error);

          expect(console.error).toHaveBeenCalledTimes(platform === 'node' ? 1 : 0);
        });

        expect(worker.isRunning).toBe(false);
        expect(worker.webSocketClient.isRunning).toBe(false);
      });
    });
  }

  if (type === 'local') {
    it('should keep the shared MSW worker running after one of multiple local workers stops', async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        await usingHttpInterceptorWorker(workerOptions, async (otherWorker) => {
          await worker.stop();

          expect(worker.isRunning).toBe(false);
          expect(otherWorker.isRunning).toBe(true);
          expect(LocalMSWWorkerStore.isMSWWorkerRunning).toBe(true);
        });
      });
    });

    it('should use the internal worker of the current platform', async () => {
      const worker = createHttpInterceptorWorker({ type });

      try {
        await worker.start();

        expect(worker.hasInternalBrowserWorker()).toBe(platform === 'browser');
        expect(worker.hasInternalNodeWorker()).toBe(platform === 'node');
      } finally {
        await worker.stop();
      }
    });
  }
}
