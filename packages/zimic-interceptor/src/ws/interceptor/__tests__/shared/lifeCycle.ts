import { waitForNot } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import { createInternalWebSocketInterceptor, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';

import NotRunningWebSocketInterceptorError from '../../errors/NotRunningWebSocketInterceptorError';
import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions, usingWebSocketClient, waitForWebSocketMessage } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareLifeCycleWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should ignore all handlers after restarted when intercepting messages', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);
        expect(handler.messages).toHaveLength(0);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await expect(messagePromise).resolves.toEqual({ type: 'server', index: 1 });
        });

        expect(handler.messages).toHaveLength(1);

        expect(interceptor.isRunning).toBe(true);
        await interceptor.stop();
        expect(interceptor.isRunning).toBe(false);

        expect(handler.messages).toHaveLength(0);

        await interceptor.start();
        expect(interceptor.isRunning).toBe(true);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messageListener = vi.fn();
          client.addEventListener('message', messageListener);

          client.send(JSON.stringify({ type: 'client', index: 2 }));

          await waitForNot(() => {
            expect(messageListener).toHaveBeenCalled();
          });
        });

        expect(handler.messages).toHaveLength(0);
      },
    );
  });

  it('should ignore all handlers after restarted when intercepting messages, even if another interceptor is still running', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);
        expect(handler.messages).toHaveLength(0);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await expect(messagePromise).resolves.toEqual({ type: 'server', index: 1 });
        });

        expect(handler.messages).toHaveLength(1);

        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, baseURL: `${baseURL}/other` },
          async (otherInterceptor) => {
            expect(interceptor.isRunning).toBe(true);
            expect(otherInterceptor.isRunning).toBe(true);

            await interceptor.stop();
            expect(interceptor.isRunning).toBe(false);
            expect(otherInterceptor.isRunning).toBe(true);

            expect(handler.messages).toHaveLength(0);

            await interceptor.start();
            expect(interceptor.isRunning).toBe(true);
            expect(otherInterceptor.isRunning).toBe(true);

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              const messageListener = vi.fn();
              client.addEventListener('message', messageListener);

              client.send(JSON.stringify({ type: 'client', index: 2 }));

              await waitForNot(() => {
                expect(messageListener).toHaveBeenCalled();
              });
            });

            expect(handler.messages).toHaveLength(0);
          },
        );
      },
    );
  });

  it('should throw an error when trying to create a message handler if not running', () => {
    const interceptor = createInternalWebSocketInterceptor<MessageSchema>(interceptorOptions);
    expect(interceptor.isRunning).toBe(false);

    expect(() => interceptor.message()).toThrow(new NotRunningWebSocketInterceptorError());
  });
}
