import { waitForDelay } from '@zimic/utils/time';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { usingDirectWebSocketMessageHandler } from './utils';

type TestHandler = LocalWebSocketMessageHandler<Schema> | RemoteWebSocketMessageHandler<Schema>;

export function declareDelayWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
  },
) {
  const { type, Handler, startServer, stopServer, getBaseURL } = options;

  let baseURL: string;

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  async function handleDelayedMessage(
    delayDeclaration: (handler: TestHandler) => void,
    deadline: number,
    randomValue?: number,
  ) {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL, Handler },
      async ({ handler, sender, handleMessage }) => {
        // The clock is faked only after the fixture is set up, which relies on real timers.
        vi.useFakeTimers();
        const randomSpy = randomValue === undefined ? undefined : vi.spyOn(Math, 'random').mockReturnValue(randomValue);

        try {
          delayDeclaration(handler);
          handler.respond({ type: 'delete', id: '1' });

          const handling = handleMessage({ type: 'create', body: { text: 'hello' } });

          // Lets the asynchronous matching and declaration steps schedule their timers.
          await vi.advanceTimersByTimeAsync(0);

          if (deadline > 0) {
            await vi.advanceTimersByTimeAsync(deadline - 1);
            expect(sender.sentMessages).toEqual([]);

            await vi.advanceTimersByTimeAsync(1);
          }

          await handling;

          expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
        } finally {
          randomSpy?.mockRestore();
          vi.useRealTimers();
        }
      },
    );
  }

  describe('Exact delay', () => {
    it('should apply an exact delay before responding', async () => {
      const delay = 100;
      await handleDelayedMessage((handler) => handler.delay(delay), delay);
    });

    it('should not apply delay when set to zero', async () => {
      await handleDelayedMessage((handler) => handler.delay(0), 0);
    });

    it('should not apply delay when set to negative', async () => {
      await handleDelayedMessage((handler) => handler.delay(-10), 0);
    });
  });

  describe('Ranged delay', () => {
    it('should apply a random delay within the specified range', async () => {
      const minDelay = 100;
      const maxDelay = 200;
      const randomValue = 0.5;

      // Halfway through the range.
      const expectedDelay = 150;

      await handleDelayedMessage((handler) => handler.delay(minDelay, maxDelay), expectedDelay, randomValue);
    });

    it('should apply an exact delay when the range limits are equal', async () => {
      const delay = 50;
      await handleDelayedMessage((handler) => handler.delay(delay, delay), delay);
    });

    it('should apply the highest delay when the minimum limit is higher than the maximum limit', async () => {
      const minDelay = 100;
      const maxDelay = 50;
      await handleDelayedMessage((handler) => handler.delay(minDelay, maxDelay), minDelay);
    });
  });

  describe('Computed delay', () => {
    it('should apply a computed synchronous delay', async () => {
      const delay = 100;

      await handleDelayedMessage((handler) => {
        handler.delay(() => delay);
      }, delay);
    });

    it('should apply a computed asynchronous delay', async () => {
      const delayOverhead = 30;
      const delay = 50;

      await handleDelayedMessage((handler) => {
        handler.delay(async () => {
          await waitForDelay(delayOverhead);
          return delay;
        });
      }, delayOverhead + delay);
    });
  });

  it('should reset delay when cleared', async () => {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL, Handler },
      async ({ handler, sender, handleMessage }) => {
        vi.useFakeTimers();

        try {
          handler.delay(100).respond({ type: 'delete', id: '1' });
          handler.clear().respond({ type: 'delete', id: '1' });

          // No timer is advanced, so the response is only delivered if no delay remains.
          await handleMessage({ type: 'create', body: { text: 'hello' } });

          expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
        } finally {
          vi.useRealTimers();
        }
      },
    );
  });

  it('should consider only the last delay if multiple are declared', async () => {
    const firstDelay = 200;
    const secondDelay = 50;

    await handleDelayedMessage((handler) => handler.delay(firstDelay).delay(secondDelay), secondDelay);
  });
}
