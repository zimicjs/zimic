import { waitForDelay } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';

import { WebSocketInterceptorOptions } from '../../types/options';
import type { LocalWebSocketInterceptor, RemoteWebSocketInterceptor } from '../../types/public';
import { RuntimeSharedWebSocketInterceptorTestsOptions, usingWebSocketClient, waitForWebSocketMessage } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'create'; body: { text: string } } | { type: 'delete'; id: string }>;

type TestInterceptor = LocalWebSocketInterceptor<MessageSchema> | RemoteWebSocketInterceptor<MessageSchema>;
type TestHandler = ReturnType<TestInterceptor['message']>;

export function declareDelayWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  // The socket and the remote RPCs depend on real I/O, so only `setTimeout` is faked, after the client connects. Those
  // paths may schedule their own timeouts, so the delay timer is identified by its duration, observed through the
  // faked `setTimeout`.
  async function usingFakeDelayTimers(
    client: WebSocketClient<MessageSchema>,
    callback: (utils: {
      sendMessage: () => void;
      waitForDelayTimer: (delay: number) => Promise<void>;
    }) => Promise<void>,
  ) {
    expect(client.readyState).toBe(WebSocketClient.OPEN);

    vi.useFakeTimers({ toFake: ['setTimeout'] });

    const fakeSetTimeout = globalThis.setTimeout;
    const scheduledDelays: unknown[] = [];
    const delayListeners = new Set<() => void>();

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      ...args: Parameters<typeof setTimeout>
    ) => {
      scheduledDelays.push(args[1]);
      delayListeners.forEach((listener) => {
        listener();
      });
      return fakeSetTimeout(...args);
    }) as typeof setTimeout);

    try {
      await callback({
        sendMessage: () => {
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        },

        waitForDelayTimer: async (delay) => {
          await new Promise<void>((resolve) => {
            function resolveIfScheduled() {
              const index = scheduledDelays.indexOf(delay);

              if (index !== -1) {
                scheduledDelays.splice(index, 1);
                delayListeners.delete(resolveIfScheduled);
                resolve();
              }
            }

            delayListeners.add(resolveIfScheduled);
            resolveIfScheduled();
          });
        },
      });
    } finally {
      setTimeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  }

  async function expectDelayedResponse(
    declareDelay: (handler: TestHandler) => unknown,
    delay: number,
    randomValue?: number,
    computationDelay = 0,
  ) {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const handler = interceptor.message();
      declareDelay(handler);
      await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }), interceptor);

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        await usingFakeDelayTimers(client, async ({ sendMessage, waitForDelayTimer }) => {
          const randomSpy = randomValue === undefined ? undefined : vi.spyOn(Math, 'random').mockReturnValue(randomValue);

          try {
            const messagePromise = waitForWebSocketMessage(client);
            let hasReplied = false;
            void messagePromise.then(() => {
              hasReplied = true;
            });

            sendMessage();

            if (computationDelay > 0) {
              await waitForDelayTimer(computationDelay);
              await vi.advanceTimersByTimeAsync(computationDelay);
            }

            await waitForDelayTimer(delay);

            await vi.advanceTimersByTimeAsync(delay - 1);
            expect(hasReplied).toBe(false);

            await vi.advanceTimersByTimeAsync(1);

            await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });
          } finally {
            randomSpy?.mockRestore();
          }
        });
      });
    });
  }

  async function expectImmediateResponse(declareDelay: (handler: TestHandler) => unknown) {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const handler = interceptor.message();
      declareDelay(handler);
      await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }), interceptor);

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        await usingFakeDelayTimers(client, async ({ sendMessage }) => {
          const messagePromise = waitForWebSocketMessage(client);

          sendMessage();

          // No timer is advanced, so the response is only delivered if no delay applies.
          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });
        });
      });
    });
  }

  describe('Exact delay', () => {
    it('should apply an exact delay before responding', async () => {
      const delay = 100;
      await expectDelayedResponse((message) => message.delay(delay), delay);
    });

    it('should not apply delay when set to zero', async () => {
      await expectImmediateResponse((message) => message.delay(0));
    });

    it('should not apply delay when set to negative', async () => {
      await expectImmediateResponse((message) => message.delay(-10));
    });
  });

  describe('Ranged delay', () => {
    it('should apply a random delay within the specified range', async () => {
      const minDelay = 100;
      const maxDelay = 200;
      const randomValue = 0.5;

      // Halfway through the range.
      const expectedDelay = 150;

      await expectDelayedResponse((message) => message.delay(minDelay, maxDelay), expectedDelay, randomValue);
    });

    it('should apply random delays for multiple responses within the specified range', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const minDelay = 50;
        const maxDelay = 150;

        const randomValues = [0, 0.5, 1];
        const expectedDelays = [50, 100, 150];

        await promiseIfRemote(
          interceptor.message().delay(minDelay, maxDelay).respond({ type: 'delete', id: '1' }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await usingFakeDelayTimers(client, async ({ sendMessage, waitForDelayTimer }) => {
            const randomSpy = vi.spyOn(Math, 'random');

            try {
              for (const [index, expectedDelay] of expectedDelays.entries()) {
                randomSpy.mockReturnValue(randomValues[index]);

                const messagePromise = waitForWebSocketMessage(client);
                let hasReplied = false;
                void messagePromise.then(() => {
                  hasReplied = true;
                });

                sendMessage();
                await waitForDelayTimer(expectedDelay);

                await vi.advanceTimersByTimeAsync(expectedDelay - 1);
                expect(hasReplied).toBe(false);

                await vi.advanceTimersByTimeAsync(1);

                await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });
              }
            } finally {
              randomSpy.mockRestore();
            }
          });
        });
      });
    });

    it('should apply an exact delay when the range limits are equal', async () => {
      const delay = 50;
      await expectDelayedResponse((message) => message.delay(delay, delay), delay);
    });

    it('should apply the highest delay when the minimum limit is higher than the maximum limit', async () => {
      const minDelay = 100;
      const maxDelay = 50;
      await expectDelayedResponse((message) => message.delay(minDelay, maxDelay), minDelay);
    });
  });

  describe('Computed delay', () => {
    it('should apply a computed synchronous delay', async () => {
      const delay = 100;
      await expectDelayedResponse((message) => message.delay(() => delay), delay);
    });

    it('should apply a computed asynchronous delay', async () => {
      const delayOverhead = 30;
      const delay = 50;

      await expectDelayedResponse(
        (message) =>
          message.delay(async () => {
            await waitForDelay(delayOverhead);
            return delay;
          }),
        delay,
        undefined,
        delayOverhead,
      );
    });
  });

  it('should reset delay when cleared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.message().delay(100).respond({ type: 'delete', id: '1' }),
        interceptor,
      );

      await promiseIfRemote(handler.clear().respond({ type: 'delete', id: '1' }), interceptor);

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        await usingFakeDelayTimers(client, async ({ sendMessage }) => {
          const messagePromise = waitForWebSocketMessage(client);

          sendMessage();

          // No timer is advanced, so the response is only delivered if no delay remains.
          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });
        });
      });
    });
  });

  it('should consider only the last delay if multiple are declared', async () => {
    const firstDelay = 200;
    const secondDelay = 50;

    await expectDelayedResponse((message) => message.delay(firstDelay).delay(secondDelay), secondDelay);
  });

  it('should not throw an error if the handler is cleared while the delay is being awaited', async () => {
    const realSetTimeout = globalThis.setTimeout;

    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const delay = 200;

      const handler = await promiseIfRemote(
        interceptor.message().delay(delay).respond({ type: 'delete', id: '1' }),
        interceptor,
      );

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const messageListener = vi.fn();
        client.addEventListener('message', messageListener);

        await usingIgnoredConsole(['error'], async (console) => {
          await usingFakeDelayTimers(client, async ({ sendMessage, waitForDelayTimer }) => {
            sendMessage();
            await waitForDelayTimer(delay);

            await promiseIfRemote(handler.clear(), interceptor);

            await vi.advanceTimersByTimeAsync(delay);

            // Gives a response, if any was sent, the chance to arrive through the real socket.
            await new Promise<void>((resolve) => {
              realSetTimeout(resolve, 1);
            });
          });

          expect(messageListener).not.toHaveBeenCalled();
          expect(console.error).not.toHaveBeenCalled();
        });
      });
    });
  });
}
