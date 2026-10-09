import { PossiblePromise } from '@zimic/utils/types';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptorWorker } from '@tests/utils/interceptors';

import { WebSocketInterceptorPlatform, WebSocketInterceptorType } from '../../../interceptor/types/options';
import LocalWebSocketInterceptorWorker from '../../LocalWebSocketInterceptorWorker';
import { WebSocketInterceptorWorkerOptions } from '../../types/options';

interface SharedWebSocketInterceptorWorkerLifeCycleTestOptions {
  platform: WebSocketInterceptorPlatform;
  defaultWorkerOptions: WebSocketInterceptorWorkerOptions;
  getBaseURL: (type: WebSocketInterceptorType) => PossiblePromise<string>;
  startServer?: () => PossiblePromise<void>;
  stopServer?: () => PossiblePromise<void>;
}

export function declareLifeCycleWebSocketInterceptorWorkerTests(
  options: SharedWebSocketInterceptorWorkerLifeCycleTestOptions,
) {
  const { platform, defaultWorkerOptions, getBaseURL, startServer, stopServer } = options;
  let workerOptions: WebSocketInterceptorWorkerOptions;

  beforeAll(async () => {
    if (defaultWorkerOptions.type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    const baseURL = await getBaseURL(defaultWorkerOptions.type);
    workerOptions =
      defaultWorkerOptions.type === 'local'
        ? defaultWorkerOptions
        : { ...defaultWorkerOptions, serverURL: new URL(new URL(baseURL).origin) };
  });

  afterAll(async () => {
    if (defaultWorkerOptions.type === 'remote') {
      await stopServer?.();
    }
  });

  it('should wait for a concrete worker to finish stopping before restarting', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, async (worker) => {
      const shutdownGate = Promise.withResolvers<void>();
      const shutdownStarted = Promise.withResolvers<void>();
      let restoreShutdownSpy: () => void;

      // Hold a real shutdown dependency so restart encounters the worker's pending stop.
      if (worker instanceof LocalWebSocketInterceptorWorker) {
        const getMSWWorkerOrCreate = worker.getMSWWorkerOrCreate.bind(worker);
        const shutdownSpy = vi.spyOn(worker, 'getMSWWorkerOrCreate').mockImplementationOnce(async () => {
          shutdownStarted.resolve();
          await shutdownGate.promise;
          return getMSWWorkerOrCreate();
        });
        restoreShutdownSpy = () => shutdownSpy.mockRestore();
      } else {
        const stopClient = worker.webSocketClient.stop.bind(worker.webSocketClient);
        const shutdownSpy = vi.spyOn(worker.webSocketClient, 'stop').mockImplementationOnce(async () => {
          shutdownStarted.resolve();
          await shutdownGate.promise;
          await stopClient();
        });
        restoreShutdownSpy = () => shutdownSpy.mockRestore();
      }

      let stopPromise: Promise<void> | undefined;
      let startPromise: Promise<void> | undefined;
      let didRestart = false;

      try {
        stopPromise = worker.stop();
        await shutdownStarted.promise;
        startPromise = worker.start().then(() => {
          didRestart = true;
        });
        await Promise.resolve();
        expect(didRestart).toBe(false);
        shutdownGate.resolve();
        await Promise.all([stopPromise, startPromise]);
      } finally {
        shutdownGate.resolve();
        await Promise.allSettled([stopPromise, startPromise]);
        restoreShutdownSpy();
      }

      expect(worker.isRunning).toBe(true);
      expect(worker.platform).toBe(platform);
      expect(didRestart).toBe(true);
    });
  });
}
