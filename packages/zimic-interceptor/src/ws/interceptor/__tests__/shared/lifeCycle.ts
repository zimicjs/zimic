import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import LocalWebSocketInterceptorWorker from '../../../interceptorWorker/LocalWebSocketInterceptorWorker';
import type { Schema } from '../../../messageHandler/__tests__/shared/types';
import { LocalWebSocketMessageHandler } from '../../../messageHandler/LocalWebSocketMessageHandler';
import NotRunningWebSocketInterceptorError from '../../errors/NotRunningWebSocketInterceptorError';
import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorPlatform, WebSocketInterceptorType } from '../../types/options';
import WebSocketInterceptorImplementation from '../../WebSocketInterceptorImplementation';

type ClientMessage = WebSocketSchema<{ type: 'client'; text: string } | { type: 'server'; text: string }>;

interface SharedWebSocketInterceptorLifeCycleTestOptions {
  platform: WebSocketInterceptorPlatform;
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
}

export function declareLifeCycleWebSocketInterceptorTests(options: SharedWebSocketInterceptorLifeCycleTestOptions) {
  const { platform, type, getBaseURL } = options;

  it('should reject message declarations while stopped', async () => {
    const interceptor = createWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() });

    try {
      expect(() => interceptor.message()).toThrow(NotRunningWebSocketInterceptorError);

      await interceptor.start();
      await interceptor.stop();

      expect(() => interceptor.message()).toThrow(NotRunningWebSocketInterceptorError);
    } finally {
      await interceptor.stop();
    }
  });

  if (type === 'local') {
    it('should release a worker after startup fails', async () => {
      const worker = new LocalWebSocketInterceptorWorker({ type: 'local' });
      const error = new Error('worker startup failed');
      const startWorker = vi.spyOn(worker, 'start').mockRejectedValue(error);
      const stopWorker = vi.spyOn(worker, 'stop');
      const releaseWorker = vi.fn();
      const interceptor = new WebSocketInterceptorImplementation({
        baseURL: new URL('ws://localhost'),
        Handler: LocalWebSocketMessageHandler,
        createWorker: () => worker,
        releaseWorker,
      });

      await expect(interceptor.start()).rejects.toBe(error);

      expect(startWorker).toHaveBeenCalledOnce();
      expect(stopWorker).toHaveBeenCalledOnce();
      expect(releaseWorker).toHaveBeenCalledOnce();
      expect(releaseWorker).toHaveBeenCalledWith(worker);
      expect(interceptor.isRunning).toBe(false);
    });

    it('should propagate a worker factory failure without cleaning up a worker', async () => {
      const error = new Error('worker factory failed');
      const releaseWorker = vi.fn();
      const interceptor = new WebSocketInterceptorImplementation({
        baseURL: new URL('ws://localhost'),
        Handler: LocalWebSocketMessageHandler,
        createWorker: () => {
          throw error;
        },
        releaseWorker,
      });

      await expect(interceptor.start()).rejects.toBe(error);

      expect(releaseWorker).not.toHaveBeenCalled();
      expect(interceptor.isRunning).toBe(false);
    });
  }

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

  if (type === 'local') {
    it('should handle messages when the next interceptor starts during the previous worker stop', async () => {
      const firstBaseURL = `${getBaseURL()}/first`;
      const secondBaseURL = `${getBaseURL()}/second`;

      await usingWebSocketInterceptor<ClientMessage>(
        { type: 'local', baseURL: firstBaseURL, messageSaving: { enabled: true } },
        async (firstInterceptor) => {
          const shutdownGate = Promise.withResolvers<void>();
          const shutdownStarted = Promise.withResolvers<void>();
          const nextWorkerStartRequested = Promise.withResolvers<void>();
          const getMSWWorkerOrCreate = LocalWebSocketInterceptorWorker.prototype.getMSWWorkerOrCreate;
          const startWorker = LocalWebSocketInterceptorWorker.prototype.start;
          const shutdownSpy = vi
            .spyOn(LocalWebSocketInterceptorWorker.prototype, 'getMSWWorkerOrCreate')
            .mockImplementationOnce(async function (this: LocalWebSocketInterceptorWorker) {
              shutdownStarted.resolve();
              await shutdownGate.promise;
              return getMSWWorkerOrCreate.call(this);
            });
          const startSpy = vi.spyOn(LocalWebSocketInterceptorWorker.prototype, 'start').mockImplementation(function (
            this: LocalWebSocketInterceptorWorker,
          ) {
            nextWorkerStartRequested.resolve();
            return startWorker.call(this);
          });

          let stopPromise: Promise<void> | undefined;
          let nextInterceptorPromise: Promise<void> | undefined;
          let nextInterceptorStarted = false;

          try {
            stopPromise = firstInterceptor.stop();
            await shutdownStarted.promise;

            nextInterceptorPromise = usingWebSocketInterceptor<ClientMessage>(
              { type: 'local', baseURL: secondBaseURL, messageSaving: { enabled: true } },
              async (secondInterceptor) => {
                nextInterceptorStarted = true;
                const handler = secondInterceptor
                  .message()
                  .with({ type: 'client' })
                  .respond((message) => ({ type: 'server', text: `received ${message.text}` }));

                expect(secondInterceptor.isRunning).toBe(true);

                const client = new WebSocketClient<ClientMessage>(secondBaseURL);

                try {
                  await client.open();

                  let response: unknown;
                  client.addEventListener(
                    'message',
                    ({ data }) => {
                      response = typeof data === 'string' ? JSON.parse(data) : data;
                    },
                    { once: true },
                  );

                  client.send(JSON.stringify({ type: 'client', text: 'during restart' }));

                  await waitFor(() => {
                    expect(response).toEqual({ type: 'server', text: 'received during restart' });
                  });

                  expect(handler.messages).toHaveLength(1);
                  expect(handler.messages[0].data).toEqual({ type: 'client', text: 'during restart' });
                } finally {
                  await client.close();
                }
              },
            );

            await nextWorkerStartRequested.promise;
            expect(nextInterceptorStarted).toBe(false);
            shutdownGate.resolve();
            await stopPromise;
            await nextInterceptorPromise;

            expect(shutdownSpy).toHaveBeenCalled();
            expect(startSpy).toHaveBeenCalledTimes(1);
            expect(firstInterceptor.isRunning).toBe(false);
          } finally {
            shutdownGate.resolve();
            await Promise.allSettled([stopPromise, nextInterceptorPromise]);
            shutdownSpy.mockRestore();
            startSpy.mockRestore();
          }
        },
      );
    });
  }
}
