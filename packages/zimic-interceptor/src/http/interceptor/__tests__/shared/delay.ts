import { HttpSchema } from '@zimic/http';
import { createPromiseWithResolvers } from '@zimic/utils/data';
import { expectFetchError } from '@zimic/utils/fetch';
import { waitForDelay } from '@zimic/utils/time';
import { joinURL } from '@zimic/utils/url';
import { beforeEach, describe, expect, it, Mock, MockInstance, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import type { LocalHttpRequestHandler, PendingRemoteHttpRequestHandler } from '../../../requestHandler/types/public';
import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export function declareDelayHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  type MethodSchema = HttpSchema.Method<{
    response: {
      204: {};
    };
  }>;

  type Schema = HttpSchema<{
    '/users': { GET: MethodSchema };
  }>;

  type DelayableHandler =
    LocalHttpRequestHandler<Schema, 'GET', '/users'> | PendingRemoteHttpRequestHandler<Schema, 'GET', '/users'>;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  async function usingDelayedHandler(
    declareDelay: (handler: DelayableHandler) => DelayableHandler,
    callback: (context: {
      handler: { clear: () => PromiseLike<unknown> | unknown; requests: readonly unknown[] };
      respond: Mock;
      randomSpy: MockInstance<typeof Math.random>;
      sendRequest: () => Promise<{ response: Promise<Response> }>;
      interceptor: { type: 'local' | 'remote' };
    }) => Promise<void>,
  ) {
    await usingHttpInterceptor<Schema>(interceptorOptions, async (interceptor) => {
      let dispatchStartedPromise = createPromiseWithResolvers<void>();
      const respond = vi.fn(() => ({ status: 204 as const }));

      const handler = await promiseIfRemote(
        declareDelay(
          interceptor.get('/users').with(() => {
            dispatchStartedPromise.resolve();
            return true;
          }),
        ).respond(respond),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      // The timers are faked only after the interceptor is set up, which relies on real timers.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      // Math.random is a platform boundary. Other internals also read it, so tests set its value per request.
      const randomSpy = vi.spyOn(Math, 'random');

      try {
        await callback({
          handler,
          respond,
          randomSpy,
          interceptor,
          sendRequest: async () => {
            dispatchStartedPromise = createPromiseWithResolvers<void>();

            const response = fetch(joinURL(baseURL, '/users'), { method: 'GET' });

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
  }

  async function advanceThroughDelay(respond: Mock, delay: number) {
    const numberOfCalls = respond.mock.calls.length;

    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(respond).toHaveBeenCalledTimes(numberOfCalls);

    await vi.advanceTimersByTimeAsync(1);
    expect(respond).toHaveBeenCalledTimes(numberOfCalls + 1);
  }

  async function expectDelayedResponse(
    declareDelay: (handler: DelayableHandler) => DelayableHandler,
    delay: number,
    delayOptions: { randomValue?: number; delayOverhead?: number } = {},
  ) {
    await usingDelayedHandler(declareDelay, async ({ handler, respond, randomSpy, sendRequest }) => {
      if (delayOptions.randomValue !== undefined) {
        randomSpy.mockReturnValue(delayOptions.randomValue);
      }

      const { response } = await sendRequest();

      if (delayOptions.delayOverhead !== undefined) {
        await vi.advanceTimersByTimeAsync(delayOptions.delayOverhead);
      }

      await advanceThroughDelay(respond, delay);

      expect((await response).status).toBe(204);
      expect(handler.requests).toHaveLength(1);
    });
  }

  async function expectUndelayedResponse(declareDelay: (handler: DelayableHandler) => DelayableHandler) {
    await usingDelayedHandler(declareDelay, async ({ handler, respond, sendRequest }) => {
      // Only a zero-millisecond flush runs before the response factory is checked, so no delay is applied.
      const { response } = await sendRequest();
      expect(respond).toHaveBeenCalledTimes(1);

      expect((await response).status).toBe(204);
      expect(handler.requests).toHaveLength(1);
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
        async ({ handler, respond, randomSpy, sendRequest }) => {
          for (const [index, expectedDelay] of expectedDelays.entries()) {
            randomSpy.mockReturnValue(randomValues[index]);

            const { response } = await sendRequest();

            await advanceThroughDelay(respond, expectedDelay);

            expect((await response).status).toBe(204);
          }

          expect(handler.requests).toHaveLength(expectedDelays.length);
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
    await usingHttpInterceptor<Schema>(interceptorOptions, async (interceptor) => {
      const delay = 100;

      const handler = await promiseIfRemote(
        interceptor.get('/users').delay(delay).respond({ status: 204 }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      await promiseIfRemote(handler.clear(), interceptor);

      await promiseIfRemote(handler.respond({ status: 204 }), handler);

      // No timer is advanced, so the response is only delivered if no delay remains.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      try {
        const response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);
      } finally {
        vi.useRealTimers();
      }

      expect(handler.requests).toHaveLength(1);
    });
  });

  it('should consider only the last delay if multiple are declared', async () => {
    const firstDelay = 200;
    const secondDelay = 50;

    await expectDelayedResponse((handler) => handler.delay(firstDelay).delay(secondDelay), secondDelay);
  });

  it('should not throw an error if the handler is cleared while the delay is being awaited', async () => {
    const delay = 200;

    await usingDelayedHandler(
      (handler) => handler.delay(delay),
      async ({ handler, respond, sendRequest, interceptor }) => {
        await usingIgnoredConsole(['error'], async (console) => {
          const { response } = await sendRequest();

          // The rejection handler is attached before advancing, to avoid an unhandled rejection.
          const fetchErrorExpectation = expectFetchError(response);

          let settled = false;
          void response.then(
            () => (settled = true),
            () => (settled = true),
          );

          await promiseIfRemote(handler.clear(), interceptor);

          await vi.advanceTimersByTimeAsync(delay - 1);
          expect(settled).toBe(false);

          await vi.advanceTimersByTimeAsync(1);

          await fetchErrorExpectation;
          expect(settled).toBe(true);

          expect(respond).not.toHaveBeenCalled();
          expect(handler.requests).toHaveLength(0);

          expect(console.error).toHaveBeenCalledTimes(0);
        });
      },
    );
  });
}
