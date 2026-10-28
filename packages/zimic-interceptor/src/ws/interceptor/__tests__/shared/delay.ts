import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitForDelay } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { describe, expect, it, Mock, MockInstance, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import {
  collectWebSocketClientMessages,
  expectWebSocketTimesCheckError,
  usingWebSocketClient,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import type {
  LocalWebSocketMessageHandler,
  PendingRemoteWebSocketMessageHandler,
} from '../../../messageHandler/types/public';
import type { UnhandledMessageStrategy, WebSocketInterceptorType } from '../../types/options';

type MessageSchema = WebSocketSchema<{ type: 'create'; body: { text: string } } | { type: 'delete'; id: string }>;

type DelayableHandler =
  LocalWebSocketMessageHandler<MessageSchema> | PendingRemoteWebSocketMessageHandler<MessageSchema>;

interface SharedWebSocketInterceptorDelayTestOptions {
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
}

export function declareDelayWebSocketInterceptorTests(options: SharedWebSocketInterceptorDelayTestOptions) {
  const { type, getBaseURL } = options;

  async function usingDelayedHandler(
    declareDelay: (handler: DelayableHandler) => DelayableHandler,
    callback: (context: {
      effect: Mock;
      randomSpy: MockInstance<typeof Math.random>;
      sendMessage: () => Promise<{ response: ReturnType<typeof waitForWebSocketClientMessage<MessageSchema>> }>;
    }) => Promise<void>,
  ) {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<MessageSchema>({ type, baseURL }, async (interceptor) => {
      let dispatchStartedPromise = createPromiseWithResolvers<void>();
      const effect = vi.fn();

      await declareDelay(
        interceptor.message().with(() => {
          dispatchStartedPromise.resolve();
          return true;
        }),
      )
        .effect(effect)
        .respond({ type: 'delete', id: '1' });

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        // The timers are faked only after the interceptor and the client are set up, which relies on real timers.
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

        // Math.random is a platform boundary. Other internals may also read it, so tests set its value per message.
        const randomSpy = vi.spyOn(Math, 'random');

        try {
          await callback({
            effect,
            randomSpy,
            sendMessage: async () => {
              dispatchStartedPromise = createPromiseWithResolvers<void>();

              const response = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

              await dispatchStartedPromise;

              // Lets the pending asynchronous steps schedule the delay timer.
              await vi.advanceTimersByTimeAsync(0);

              return { response };
            },
          });
        } finally {
          randomSpy.mockRestore();
          vi.useRealTimers();
        }
      });
    });
  }

  async function advanceThroughDelay(effect: Mock, delay: number) {
    const numberOfCalls = effect.mock.calls.length;

    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(effect).toHaveBeenCalledTimes(numberOfCalls);

    await vi.advanceTimersByTimeAsync(1);
    expect(effect).toHaveBeenCalledTimes(numberOfCalls + 1);
  }

  async function expectDelayedResponse(
    declareDelay: (handler: DelayableHandler) => DelayableHandler,
    delay: number,
    delayOptions: { randomValue?: number; delayOverhead?: number } = {},
  ) {
    await usingDelayedHandler(declareDelay, async ({ effect, randomSpy, sendMessage }) => {
      if (delayOptions.randomValue !== undefined) {
        randomSpy.mockReturnValue(delayOptions.randomValue);
      }

      const { response } = await sendMessage();

      if (delayOptions.delayOverhead !== undefined) {
        await vi.advanceTimersByTimeAsync(delayOptions.delayOverhead);
      }

      await advanceThroughDelay(effect, delay);

      await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));
    });
  }

  async function expectUndelayedResponse(declareDelay: (handler: DelayableHandler) => DelayableHandler) {
    await usingDelayedHandler(declareDelay, async ({ effect, sendMessage }) => {
      // Only a zero-millisecond flush runs before the effect is checked, so no delay is applied.
      const { response } = await sendMessage();
      expect(effect).toHaveBeenCalledTimes(1);

      await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));
    });
  }

  describe('Exact delay', () => {
    it('should apply an exact delay before responding', async () => {
      const delay = 100;

      await expectDelayedResponse((handler) => handler.delay(delay), delay);
    });

    it('should not apply delay when set to zero', async () => {
      await expectUndelayedResponse((handler) => handler.delay(0));
    });

    it('should not apply delay when set to negative', async () => {
      await expectUndelayedResponse((handler) => handler.delay(-10));
    });
  });

  describe('Ranged delay', () => {
    it('should apply a random delay within the specified range', async () => {
      const minDelay = 100;
      const maxDelay = 200;

      // Halfway through the range.
      const expectedDelay = 150;

      await expectDelayedResponse((handler) => handler.delay(minDelay, maxDelay), expectedDelay, {
        randomValue: 0.5,
      });
    });

    it('should apply random delays for multiple responses within the specified range', async () => {
      const minDelay = 50;
      const maxDelay = 150;

      const randomValues = [0, 0.5, 1];
      const expectedDelays = [minDelay, 100, maxDelay];

      await usingDelayedHandler(
        (handler) => handler.delay(minDelay, maxDelay),
        async ({ effect, randomSpy, sendMessage }) => {
          for (const [index, expectedDelay] of expectedDelays.entries()) {
            randomSpy.mockReturnValue(randomValues[index]);

            const { response } = await sendMessage();

            await advanceThroughDelay(effect, expectedDelay);

            await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));
          }
        },
      );
    });

    it('should apply an exact delay when the range limits are equal', async () => {
      const delay = 50;

      await expectDelayedResponse((handler) => handler.delay(delay, delay), delay);
    });

    it('should apply the highest delay when the minimum limit is higher than the maximum limit', async () => {
      const minDelay = 100;
      const maxDelay = 50;

      expect(minDelay).toBeGreaterThan(maxDelay);

      await expectDelayedResponse((handler) => handler.delay(minDelay, maxDelay), minDelay);
    });
  });

  describe('Computed delay', () => {
    it('should apply a computed synchronous delay', async () => {
      const delay = 100;

      await expectDelayedResponse((handler) => handler.delay(() => delay), delay);
    });

    it('should apply a computed asynchronous delay', async () => {
      const delayOverhead = 30;
      const delay = 50;

      await expectDelayedResponse(
        (handler) =>
          handler.delay(async () => {
            await waitForDelay(delayOverhead);
            return delay;
          }),
        delay,
        { delayOverhead },
      );
    });
  });

  it('should reset delay when cleared', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<MessageSchema>({ type, baseURL }, async (interceptor) => {
      const handler = await interceptor.message().delay(100).respond({ type: 'delete', id: '1' });
      await handler.clear().respond({ type: 'delete', id: '1' });

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        // No timer is advanced, so the response is only delivered if no delay remains.
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

        try {
          const response = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));
        } finally {
          vi.useRealTimers();
        }
      });
    });
  });

  it('should consider only the last delay if multiple are declared', async () => {
    const firstDelay = 200;
    const secondDelay = 50;

    await expectDelayedResponse((handler) => handler.delay(firstDelay).delay(secondDelay), secondDelay);
  });

  it('should not handle messages after cleared during their delay', async () => {
    const baseURL = getBaseURL();
    const delay = 200;

    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

    await usingWebSocketInterceptor<MessageSchema>(
      { type, baseURL, messageSaving: { enabled: true }, onUnhandledMessage },
      async (interceptor) => {
        const delayStartedPromise = createPromiseWithResolvers<void>();
        const effect = vi.fn();

        const handler = await interceptor
          .message()
          .delay(() => {
            delayStartedPromise.resolve();
            return delay;
          })
          .effect(effect)
          .respond({ type: 'delete', id: '1' });

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const receivedMessages = collectWebSocketClientMessages(client);

          // The timers are faked only after the interceptor and the client are set up, which relies on real timers.
          vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

          try {
            await usingIgnoredConsole(['error'], async (console) => {
              client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

              await delayStartedPromise;

              // Lets the pending asynchronous steps schedule the delay timer.
              await vi.advanceTimersByTimeAsync(0);

              await handler.clear();

              await vi.advanceTimersByTimeAsync(delay);

              // A newer handler answers the probe message, because the cleared handler still matches every message.
              await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

              // Messages on a socket are delivered in order, so the probe response being the next message means that
              // no response was sent for the cleared handler.
              const probeResponse = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'delete', id: '1' }));

              await expect(probeResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));
              expect(receivedMessages).toEqual([JSON.stringify({ type: 'delete', id: 'probe' })]);

              expect(effect).not.toHaveBeenCalled();
              expect(handler.messages).toHaveLength(0);
              expect(onUnhandledMessage).toHaveBeenCalledTimes(1);

              expect(console.error).toHaveBeenCalledTimes(0);
            });
          } finally {
            vi.useRealTimers();
          }
        });
      },
    );
  });

  it('should not handle messages after cleared and redeclared during their delay', async () => {
    const baseURL = getBaseURL();
    const delay = 200;

    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

    await usingWebSocketInterceptor<MessageSchema>(
      { type, baseURL, messageSaving: { enabled: true }, onUnhandledMessage },
      async (interceptor) => {
        const delayStartedPromise = createPromiseWithResolvers<void>();
        const effect = vi.fn();

        const handler = await interceptor
          .message()
          .delay(() => {
            delayStartedPromise.resolve();
            return delay;
          })
          .effect(effect)
          .respond({ type: 'delete', id: '1' });

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const receivedMessages = collectWebSocketClientMessages(client);

          // The timers are faked only after the interceptor and the client are set up, which relies on real timers.
          vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

          try {
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await delayStartedPromise;

            // Lets the pending asynchronous steps schedule the delay timer.
            await vi.advanceTimersByTimeAsync(0);

            await handler.clear();

            // Redeclaring the cleared handler would apply its new declarations to the message in its delay.
            const redeclaredEffect = vi.fn();
            await handler.effect(redeclaredEffect).respond({ type: 'delete', id: 'redeclared' }).times(1);

            await vi.advanceTimersByTimeAsync(delay);

            // A newer handler answers the probe message, because the redeclared handler matches every message.
            await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

            // Messages on a socket are delivered in order, so the probe response being the next message means that no
            // response was sent for the cleared handler.
            const probeResponse = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify({ type: 'delete', id: '1' }));

            await expect(probeResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));
            expect(receivedMessages).toEqual([JSON.stringify({ type: 'delete', id: 'probe' })]);

            expect(effect).not.toHaveBeenCalled();
            expect(redeclaredEffect).not.toHaveBeenCalled();
            expect(handler.messages).toHaveLength(0);
            expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
          } finally {
            vi.useRealTimers();
          }
        });

        await expectWebSocketTimesCheckError(() => interceptor.checkTimes(), {
          message: 'Expected exactly 1 message, but got 0.',
          expectedNumberOfMessages: 1,
        });
      },
    );
  });
}
