import { waitForDelay } from '@zimic/utils/time';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { usingDirectWebSocketMessageHandler } from './utils';

export function declareDelayWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & { type: WebSocketInterceptorType },
) {
  const { type, startServer, stopServer, getBaseURL } = options;

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

  describe('Exact delay', () => {
    it('should apply an exact delay before responding', async () => {
      const delay = 100;

      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL },
        async ({ handler, sender, handleMessage }) => {
          handler.delay(delay).respond({ type: 'delete', id: '1' });

          vi.useFakeTimers();
          try {
            const dispatch = handleMessage({ type: 'create', body: { text: 'hello' } });

            await vi.advanceTimersByTimeAsync(0);
            expect(sender.sentMessages).toEqual([]);

            await vi.advanceTimersByTimeAsync(delay - 1);
            expect(sender.sentMessages).toEqual([]);

            await vi.advanceTimersByTimeAsync(1);
            await dispatch;
            expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
          } finally {
            vi.useRealTimers();
          }
        },
      );
    });

    it('should not apply delay when set to zero', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL },
        async ({ handler, sender, handleMessage }) => {
          handler.delay(0).respond({ type: 'delete', id: '1' });

          vi.useFakeTimers();
          try {
            const dispatch = handleMessage({ type: 'create', body: { text: 'hello' } });
            await vi.advanceTimersByTimeAsync(0);
            await dispatch;
            expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
          } finally {
            vi.useRealTimers();
          }
        },
      );
    });

    it('should not apply delay when set to negative', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL },
        async ({ handler, sender, handleMessage }) => {
          handler.delay(-10).respond({ type: 'delete', id: '1' });

          vi.useFakeTimers();
          try {
            const dispatch = handleMessage({ type: 'create', body: { text: 'hello' } });
            await vi.advanceTimersByTimeAsync(0);
            await dispatch;
            expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
          } finally {
            vi.useRealTimers();
          }
        },
      );
    });
  });

  describe('Ranged delay', () => {
    it('should apply a random delay within the specified range', async () => {
      const minDelay = 100;
      const maxDelay = 200;

      const delay = 150;

      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL },
        async ({ handler, sender, handleMessage }) => {
          handler.delay(minDelay, maxDelay).respond({ type: 'delete', id: '1' });

          const randomSpy = vi.spyOn(Math, 'random').mockReturnValue((delay - minDelay) / (maxDelay - minDelay));
          vi.useFakeTimers();
          try {
            const dispatch = handleMessage({ type: 'create', body: { text: 'hello' } });

            await vi.advanceTimersByTimeAsync(0);
            expect(sender.sentMessages).toEqual([]);

            await vi.advanceTimersByTimeAsync(delay - 1);
            expect(sender.sentMessages).toEqual([]);

            await vi.advanceTimersByTimeAsync(1);
            await dispatch;
            expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
          } finally {
            vi.useRealTimers();
            randomSpy.mockRestore();
          }
        },
      );
    });

    it('should apply an exact delay when the range limits are equal', async () => {
      const delay = 50;

      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL },
        async ({ handler, sender, handleMessage }) => {
          handler.delay(delay, delay).respond({ type: 'delete', id: '1' });

          vi.useFakeTimers();
          try {
            const dispatch = handleMessage({ type: 'create', body: { text: 'hello' } });

            await vi.advanceTimersByTimeAsync(0);
            expect(sender.sentMessages).toEqual([]);

            await vi.advanceTimersByTimeAsync(delay - 1);
            expect(sender.sentMessages).toEqual([]);

            await vi.advanceTimersByTimeAsync(1);
            await dispatch;
            expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
          } finally {
            vi.useRealTimers();
          }
        },
      );
    });

    it('should apply the highest delay when the minimum limit is higher than the maximum limit', async () => {
      const minDelay = 100;
      const maxDelay = 50;

      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL },
        async ({ handler, sender, handleMessage }) => {
          handler.delay(minDelay, maxDelay).respond({ type: 'delete', id: '1' });

          vi.useFakeTimers();
          try {
            const dispatch = handleMessage({ type: 'create', body: { text: 'hello' } });
            await vi.advanceTimersByTimeAsync(0);
            expect(sender.sentMessages).toEqual([]);

            await vi.advanceTimersByTimeAsync(minDelay);
            await dispatch;
            expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
          } finally {
            vi.useRealTimers();
          }
        },
      );
    });
  });

  describe('Computed delay', () => {
    it('should apply a computed synchronous delay', async () => {
      const delay = 100;

      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL },
        async ({ handler, sender, handleMessage }) => {
          handler.delay(() => delay).respond({ type: 'delete', id: '1' });

          vi.useFakeTimers();
          try {
            const dispatch = handleMessage({ type: 'create', body: { text: 'hello' } });

            await vi.advanceTimersByTimeAsync(0);
            expect(sender.sentMessages).toEqual([]);

            await vi.advanceTimersByTimeAsync(delay - 1);
            expect(sender.sentMessages).toEqual([]);

            await vi.advanceTimersByTimeAsync(1);
            await dispatch;
            expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
          } finally {
            vi.useRealTimers();
          }
        },
      );
    });

    it('should apply a computed asynchronous delay', async () => {
      const delayOverhead = 30;
      const delay = 50;

      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL },
        async ({ handler, sender, handleMessage }) => {
          handler
            .delay(async () => {
              await waitForDelay(delayOverhead);
              return delay;
            })
            .respond({ type: 'delete', id: '1' });

          vi.useFakeTimers();
          try {
            const dispatch = handleMessage({ type: 'create', body: { text: 'hello' } });

            await vi.advanceTimersByTimeAsync(0);
            expect(sender.sentMessages).toEqual([]);

            await vi.advanceTimersByTimeAsync(delayOverhead);
            expect(sender.sentMessages).toEqual([]);

            await vi.advanceTimersByTimeAsync(delay - 1);
            expect(sender.sentMessages).toEqual([]);

            await vi.advanceTimersByTimeAsync(1);
            await dispatch;
            expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
          } finally {
            vi.useRealTimers();
          }
        },
      );
    });
  });

  it('should reset delay when cleared', async () => {
    await usingDirectWebSocketMessageHandler<Schema>({ type, baseURL }, async ({ handler, sender, handleMessage }) => {
      handler.delay(100).respond({ type: 'delete', id: '1' });
      handler.clear().respond({ type: 'delete', id: '1' });

      vi.useFakeTimers();
      try {
        const dispatch = handleMessage({ type: 'create', body: { text: 'hello' } });
        await vi.advanceTimersByTimeAsync(0);
        await dispatch;
        expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('should consider only the last delay if multiple are declared', async () => {
    const firstDelay = 200;
    const secondDelay = 50;

    await usingDirectWebSocketMessageHandler<Schema>({ type, baseURL }, async ({ handler, sender, handleMessage }) => {
      handler.delay(firstDelay).delay(secondDelay).respond({ type: 'delete', id: '1' });

      vi.useFakeTimers();
      try {
        const dispatch = handleMessage({ type: 'create', body: { text: 'hello' } });

        await vi.advanceTimersByTimeAsync(0);
        expect(sender.sentMessages).toEqual([]);

        await vi.advanceTimersByTimeAsync(secondDelay - 1);
        expect(sender.sentMessages).toEqual([]);

        await vi.advanceTimersByTimeAsync(1);
        await dispatch;
        expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
      } finally {
        vi.useRealTimers();
      }
    });
  });
}
