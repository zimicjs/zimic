import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketClient } from '@zimic/ws';
import { expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import type { Schema } from '../../../messageHandler/__tests__/shared/types';
import NotRunningWebSocketInterceptorError from '../../errors/NotRunningWebSocketInterceptorError';
import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorPlatform, WebSocketInterceptorType } from '../../types/options';
import WebSocketInterceptorStore from '../../WebSocketInterceptorStore';

interface SharedWebSocketInterceptorLifeCycleTestOptions {
  platform: WebSocketInterceptorPlatform;
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
}

export function declareLifeCycleWebSocketInterceptorTests(options: SharedWebSocketInterceptorLifeCycleTestOptions) {
  const { platform, type, getBaseURL } = options;

  it('should stop when called while starting', async () => {
    const interceptor = createWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() });

    try {
      await Promise.all([interceptor.start(), interceptor.stop()]);

      expect(interceptor.isRunning).toBe(false);
      expect(interceptor.platform).toBe(null);
    } finally {
      await interceptor.stop();
    }
  });

  it('should start when called after stopping while starting', async () => {
    const interceptor = createWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() });

    try {
      await Promise.all([interceptor.start(), interceptor.stop(), interceptor.start()]);

      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe(platform);
    } finally {
      await interceptor.stop();
    }
  });

  it('should not support changing the base URL while starting', async () => {
    const interceptor = createWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() });
    const baseURL = interceptor.baseURL;

    let startPromise: Promise<void> | undefined;

    try {
      startPromise = interceptor.start();

      expect(() => {
        interceptor.baseURL = new URL('new', baseURL).toString();
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      await startPromise;
      expect(interceptor.baseURL).toBe(baseURL);
    } finally {
      await Promise.allSettled(startPromise ? [startPromise] : []);
      await interceptor.stop();
    }
  });

  it('should not support changing the base URL while stopping during startup', async () => {
    const interceptor = createWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() });
    const baseURL = interceptor.baseURL;
    const otherBaseURL = new URL('new', baseURL).toString();

    const startPromise = interceptor.start();
    const stopPromise = interceptor.stop();

    try {
      expect(() => {
        interceptor.baseURL = otherBaseURL;
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      await Promise.all([startPromise, stopPromise]);
      expect(interceptor.baseURL).toBe(baseURL);
    } finally {
      await Promise.allSettled([startPromise, stopPromise]);
      await interceptor.stop();
    }
  });

  it('should throw an error when trying to be cleared if not running', async () => {
    const interceptor = createWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() });

    expect(interceptor.isRunning).toBe(false);

    await expect(async () => {
      await interceptor.clear();
    }).rejects.toThrow(new NotRunningWebSocketInterceptorError());
  });

  it('should throw an error when trying to be cleared after stopped', async () => {
    const interceptor = createWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() });

    await interceptor.start();
    expect(interceptor.isRunning).toBe(true);

    await interceptor.stop();
    expect(interceptor.isRunning).toBe(false);

    await expect(async () => {
      await interceptor.clear();
    }).rejects.toThrow(new NotRunningWebSocketInterceptorError());
  });

  if (type === 'local') {
    it('should keep the shared worker running if the last interceptor is stopping at the same time as another is starting', async () => {
      const store = new WebSocketInterceptorStore();
      const otherBaseURL = `${getBaseURL()}/other`;

      await usingWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() }, async (interceptor) => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL: otherBaseURL },
          { start: false },
          async (otherInterceptor) => {
            const worker = store.localWorker;
            expect(worker).toBeDefined();
            expect(worker!.numberOfRunningInterceptors).toBe(1);

            const originalGetMSWWorkerOrCreate = worker!.getMSWWorkerOrCreate.bind(worker);
            const workerStopStartedPromise = createPromiseWithResolvers<void>();
            const workerStopGatePromise = createPromiseWithResolvers<void>();

            // The shutdown dependency is held so that the other interceptor starts while the worker stop is pending.
            vi.spyOn(worker!, 'getMSWWorkerOrCreate').mockImplementationOnce(async () => {
              workerStopStartedPromise.resolve();
              await workerStopGatePromise;
              return originalGetMSWWorkerOrCreate();
            });

            const workerStartSpy = vi.spyOn(worker!, 'start');

            const stopPromise = interceptor.stop();
            let startPromise: Promise<void> | undefined;

            try {
              await workerStopStartedPromise;
              startPromise = otherInterceptor.start();

              const startResolutionListener = vi.fn();
              void startPromise.then(startResolutionListener);

              await waitFor(() => {
                expect(workerStartSpy).toHaveBeenCalledTimes(1);
              });
              await waitForNot(() => {
                expect(startResolutionListener).toHaveBeenCalled();
              });

              workerStopGatePromise.resolve();
              await Promise.all([stopPromise, startPromise]);
            } finally {
              workerStopGatePromise.resolve();
              await Promise.allSettled([stopPromise, startPromise]);
            }

            expect(interceptor.isRunning).toBe(false);
            expect(otherInterceptor.isRunning).toBe(true);

            expect(store.localWorker).toBe(worker);
            expect(worker!.isRunning).toBe(true);

            const reply: Schema = { type: 'delete', id: '1' };
            otherInterceptor.message().respond(reply);

            const client = new WebSocketClient<Schema>(otherBaseURL);
            const messagePromise = waitForWebSocketClientMessage(client);

            try {
              await client.open();
              client.send(JSON.stringify({ type: 'create', body: { text: 'one' } } satisfies Schema));

              const messageData = await messagePromise;
              expect(JSON.parse(messageData as string)).toEqual(reply);
            } finally {
              await client.close();
            }
          },
        );
      });
    });
  }
}
