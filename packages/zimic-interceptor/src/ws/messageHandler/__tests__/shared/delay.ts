import { waitForDelay } from '@zimic/utils/time';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { usingElapsedTime } from '@/utils/time';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { usingDirectWebSocketMessageHandler } from './utils';

const waitForDelaySpy = vi.mocked(waitForDelay);
const DELAY_TIMING_TOLERANCE = 5;

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

  async function handleDelayedMessage(delayDeclaration: (handler: TestHandler) => void) {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL, Handler },
      async ({ handler, sender, handleMessage }) => {
        delayDeclaration(handler);
        handler.respond({ type: 'delete', id: '1' });

        await handleMessage({ type: 'create', body: { text: 'hello' } });

        expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
      },
    );
  }

  describe('Exact delay', () => {
    it('should apply an exact delay before responding', async () => {
      const delay = 100;

      const { elapsedTime } = await usingElapsedTime(() => handleDelayedMessage((handler) => handler.delay(delay)));
      expect(elapsedTime).toBeGreaterThanOrEqual(delay - DELAY_TIMING_TOLERANCE);

      expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
      expect(waitForDelaySpy).toHaveBeenCalledWith(delay);
    });

    it('should not apply delay when set to zero', async () => {
      await handleDelayedMessage((handler) => handler.delay(0));

      expect(waitForDelaySpy).not.toHaveBeenCalled();
    });

    it('should not apply delay when set to negative', async () => {
      await handleDelayedMessage((handler) => handler.delay(-10));

      expect(waitForDelaySpy).not.toHaveBeenCalled();
    });
  });

  describe('Ranged delay', () => {
    it('should apply a random delay within the specified range', async () => {
      const minDelay = 100;
      const maxDelay = 200;

      const { elapsedTime } = await usingElapsedTime(() =>
        handleDelayedMessage((handler) => handler.delay(minDelay, maxDelay)),
      );
      expect(elapsedTime).toBeGreaterThanOrEqual(minDelay - DELAY_TIMING_TOLERANCE);

      expect(waitForDelaySpy).toHaveBeenCalledTimes(1);

      const usedDelay = waitForDelaySpy.mock.calls[0][0];
      expect(usedDelay).toBeGreaterThanOrEqual(minDelay);
      expect(usedDelay).toBeLessThanOrEqual(maxDelay);
    });

    it('should apply an exact delay when the range limits are equal', async () => {
      const delay = 50;

      const { elapsedTime } = await usingElapsedTime(() =>
        handleDelayedMessage((handler) => handler.delay(delay, delay)),
      );
      expect(elapsedTime).toBeGreaterThanOrEqual(delay - DELAY_TIMING_TOLERANCE);

      expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
      expect(waitForDelaySpy).toHaveBeenCalledWith(delay);
    });

    it('should apply the highest delay when the minimum limit is higher than the maximum limit', async () => {
      const minDelay = 100;
      const maxDelay = 50;

      await handleDelayedMessage((handler) => handler.delay(minDelay, maxDelay));

      expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
      expect(waitForDelaySpy).toHaveBeenCalledWith(minDelay);
    });
  });

  describe('Computed delay', () => {
    it('should apply a computed synchronous delay', async () => {
      const delay = 100;

      const { elapsedTime } = await usingElapsedTime(() =>
        handleDelayedMessage((handler) => {
          handler.delay(() => delay);
        }),
      );
      expect(elapsedTime).toBeGreaterThanOrEqual(delay - DELAY_TIMING_TOLERANCE);

      expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
      expect(waitForDelaySpy).toHaveBeenCalledWith(delay);
    });

    it('should apply a computed asynchronous delay', async () => {
      const delayOverhead = 30;
      const delay = 50;

      const { elapsedTime } = await usingElapsedTime(() =>
        handleDelayedMessage((handler) => {
          handler.delay(async () => {
            await waitForDelay(delayOverhead);
            return delay;
          });
        }),
      );
      expect(elapsedTime).toBeGreaterThanOrEqual(delayOverhead + delay - DELAY_TIMING_TOLERANCE);

      expect(waitForDelaySpy).toHaveBeenCalledTimes(2);
      expect(waitForDelaySpy).toHaveBeenNthCalledWith(1, delayOverhead);
      expect(waitForDelaySpy).toHaveBeenNthCalledWith(2, delay);
    });
  });

  it('should reset delay when cleared', async () => {
    await usingDirectWebSocketMessageHandler<Schema>({ type, baseURL, Handler }, async ({ handler, handleMessage }) => {
      handler.delay(100).respond({ type: 'delete', id: '1' });
      handler.clear().respond({ type: 'delete', id: '1' });

      await handleMessage({ type: 'create', body: { text: 'hello' } });

      expect(waitForDelaySpy).not.toHaveBeenCalled();
    });
  });

  it('should consider only the last delay if multiple are declared', async () => {
    const firstDelay = 200;
    const secondDelay = 50;

    const { elapsedTime } = await usingElapsedTime(() =>
      handleDelayedMessage((handler) => handler.delay(firstDelay).delay(secondDelay)),
    );
    expect(elapsedTime).toBeGreaterThanOrEqual(secondDelay - DELAY_TIMING_TOLERANCE);
    expect(elapsedTime).toBeLessThan(firstDelay);

    expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
    expect(waitForDelaySpy).toHaveBeenCalledWith(secondDelay);
  });
}
