import { waitForDelay } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingElapsedTime } from '@/utils/time';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions, usingWebSocketClient, waitForWebSocketMessage } from './utils';

const waitForDelaySpy = vi.mocked(waitForDelay);

type MessageSchema = WebSocketSchema<{ type: 'create'; body: { text: string } } | { type: 'delete'; id: string }>;

export function declareDelayWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  async function sendAndWaitForResponse() {
    await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
      const messagePromise = waitForWebSocketMessage(client);

      client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

      await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });
    });
  }

  describe('Exact delay', () => {
    it('should apply an exact delay before responding', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const delay = 100;

        await promiseIfRemote(interceptor.message().delay(delay).respond({ type: 'delete', id: '1' }), interceptor);

        const { elapsedTime } = await usingElapsedTime(sendAndWaitForResponse);
        expect(elapsedTime).toBeGreaterThanOrEqual(delay);

        expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
        expect(waitForDelaySpy).toHaveBeenCalledWith(delay);
      });
    });

    it('should not apply delay when set to zero', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().delay(0).respond({ type: 'delete', id: '1' }), interceptor);

        await sendAndWaitForResponse();

        expect(waitForDelaySpy).not.toHaveBeenCalled();
      });
    });

    it('should not apply delay when set to negative', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().delay(-10).respond({ type: 'delete', id: '1' }), interceptor);

        await sendAndWaitForResponse();

        expect(waitForDelaySpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Ranged delay', () => {
    it('should apply a random delay within the specified range', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const minDelay = 100;
        const maxDelay = 200;

        await promiseIfRemote(
          interceptor.message().delay(minDelay, maxDelay).respond({ type: 'delete', id: '1' }),
          interceptor,
        );

        const { elapsedTime } = await usingElapsedTime(sendAndWaitForResponse);
        expect(elapsedTime).toBeGreaterThanOrEqual(minDelay);

        expect(waitForDelaySpy).toHaveBeenCalledTimes(1);

        const usedDelay = waitForDelaySpy.mock.calls[0][0];
        expect(usedDelay).toBeGreaterThanOrEqual(minDelay);
        expect(usedDelay).toBeLessThanOrEqual(maxDelay);
      });
    });

    it('should apply an exact delay when the range limits are equal', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const delay = 50;

        await promiseIfRemote(
          interceptor.message().delay(delay, delay).respond({ type: 'delete', id: '1' }),
          interceptor,
        );

        const { elapsedTime } = await usingElapsedTime(sendAndWaitForResponse);
        expect(elapsedTime).toBeGreaterThanOrEqual(delay);

        expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
        expect(waitForDelaySpy).toHaveBeenCalledWith(delay);
      });
    });

    it('should apply the highest delay when the minimum limit is higher than the maximum limit', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const minDelay = 100;
        const maxDelay = 50;

        await promiseIfRemote(
          interceptor.message().delay(minDelay, maxDelay).respond({ type: 'delete', id: '1' }),
          interceptor,
        );

        await sendAndWaitForResponse();

        expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
        expect(waitForDelaySpy).toHaveBeenCalledWith(minDelay);
      });
    });
  });

  describe('Computed delay', () => {
    it('should apply a computed synchronous delay', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const delay = 100;

        await promiseIfRemote(
          interceptor
            .message()
            .delay(() => delay)
            .respond({ type: 'delete', id: '1' }),
          interceptor,
        );

        const { elapsedTime } = await usingElapsedTime(sendAndWaitForResponse);
        expect(elapsedTime).toBeGreaterThanOrEqual(delay);

        expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
        expect(waitForDelaySpy).toHaveBeenCalledWith(delay);
      });
    });

    it('should apply a computed asynchronous delay', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const delayOverhead = 30;
        const delay = 50;

        await promiseIfRemote(
          interceptor
            .message()
            .delay(async () => {
              await waitForDelay(delayOverhead);
              return delay;
            })
            .respond({ type: 'delete', id: '1' }),
          interceptor,
        );

        const { elapsedTime } = await usingElapsedTime(sendAndWaitForResponse);
        expect(elapsedTime).toBeGreaterThanOrEqual(delayOverhead + delay);

        expect(waitForDelaySpy).toHaveBeenCalledTimes(2);
        expect(waitForDelaySpy).toHaveBeenNthCalledWith(1, delayOverhead);
        expect(waitForDelaySpy).toHaveBeenNthCalledWith(2, delay);
      });
    });
  });

  it('should reset delay when cleared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.message().delay(100).respond({ type: 'delete', id: '1' }),
        interceptor,
      );

      await promiseIfRemote(handler.clear().respond({ type: 'delete', id: '1' }), interceptor);

      await sendAndWaitForResponse();

      expect(waitForDelaySpy).not.toHaveBeenCalled();
    });
  });

  it('should consider only the last delay if multiple are declared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const firstDelay = 200;
      const secondDelay = 50;

      await promiseIfRemote(
        interceptor.message().delay(firstDelay).delay(secondDelay).respond({ type: 'delete', id: '1' }),
        interceptor,
      );

      const { elapsedTime } = await usingElapsedTime(sendAndWaitForResponse);
      expect(elapsedTime).toBeGreaterThanOrEqual(secondDelay);
      expect(elapsedTime).toBeLessThan(firstDelay);

      expect(waitForDelaySpy).toHaveBeenCalledTimes(1);
      expect(waitForDelaySpy).toHaveBeenCalledWith(secondDelay);
    });
  });
}
