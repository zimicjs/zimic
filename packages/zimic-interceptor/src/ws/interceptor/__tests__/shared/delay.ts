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

  // The socket and the remote RPCs depend on real I/O, so only `setTimeout` is faked, after the client connects.
  // The pending delay timer is awaited with a timer captured before the fake, because `vi.waitFor` would advance the
  // fake clock.
  async function usingFakeDelayTimers(
    client: WebSocketClient<MessageSchema>,
    callback: (utils: { sendAndWaitForDelayTimer: () => Promise<void> }) => Promise<void>,
  ) {
    expect(client.readyState).toBe(WebSocketClient.OPEN);

    const realSetTimeout = globalThis.setTimeout;

    vi.useFakeTimers({ toFake: ['setTimeout'] });

    try {
      await callback({
        sendAndWaitForDelayTimer: async () => {
          // Other timers may already be pending, so only a timer created after the message is sent is the delay.
          const timerCountBeforeSend = vi.getTimerCount();

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          while (vi.getTimerCount() <= timerCountBeforeSend) {
            await new Promise<void>((resolve) => {
              realSetTimeout(resolve, 1);
            });
          }
        },
      });
    } finally {
      vi.useRealTimers();
    }
  }

  async function expectDelayedResponse(
    declareDelay: (handler: TestHandler) => unknown,
    deadline: number,
    randomValue?: number,
  ) {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const handler = interceptor.message();
      declareDelay(handler);
      await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }), interceptor);

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        await usingFakeDelayTimers(client, async ({ sendAndWaitForDelayTimer }) => {
          const randomSpy = randomValue === undefined ? undefined : vi.spyOn(Math, 'random').mockReturnValue(randomValue);

          try {
            const messagePromise = waitForWebSocketMessage(client);
            let hasReplied = false;
            void messagePromise.then(() => {
              hasReplied = true;
            });

            if (deadline > 0) {
              await sendAndWaitForDelayTimer();

              await vi.advanceTimersByTimeAsync(deadline - 1);
              expect(hasReplied).toBe(false);

              await vi.advanceTimersByTimeAsync(1);
            } else {
              client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
            }

            await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });
          } finally {
            randomSpy?.mockRestore();
          }
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
      await expectDelayedResponse((message) => message.delay(0), 0);
    });

    it('should not apply delay when set to negative', async () => {
      await expectDelayedResponse((message) => message.delay(-10), 0);
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
          await usingFakeDelayTimers(client, async ({ sendAndWaitForDelayTimer }) => {
            const randomSpy = vi.spyOn(Math, 'random');

            try {
              for (const [index, expectedDelay] of expectedDelays.entries()) {
                randomSpy.mockReturnValue(randomValues[index]);

                const messagePromise = waitForWebSocketMessage(client);
                let hasReplied = false;
                void messagePromise.then(() => {
                  hasReplied = true;
                });

                await sendAndWaitForDelayTimer();

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
        delayOverhead + delay,
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
        await usingFakeDelayTimers(client, async () => {
          const messagePromise = waitForWebSocketMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

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
          await usingFakeDelayTimers(client, async ({ sendAndWaitForDelayTimer }) => {
            await sendAndWaitForDelayTimer();

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
