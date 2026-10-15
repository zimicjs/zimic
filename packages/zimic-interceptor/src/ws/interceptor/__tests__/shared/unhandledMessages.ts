import { waitForNot } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';

import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions, usingWebSocketClient, waitForWebSocketMessage } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareUnhandledMessageWebSocketInterceptorTests(
  options: RuntimeSharedWebSocketInterceptorTestsOptions,
) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should leave sockets open after unmatched messages', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(
        interceptor.message().with({ type: 'client', index: 2 }).respond({ type: 'server', index: 2 }),
        interceptor,
      );

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const messageListener = vi.fn();
        client.addEventListener('message', messageListener);

        await usingIgnoredConsole(['error'], async (console) => {
          client.send(JSON.stringify({ type: 'client', index: 1 }));

          await waitForNot(() => {
            expect(messageListener).toHaveBeenCalled();
          });

          expect(client.readyState).toBe(WebSocketClient.OPEN);
          expect(console.error).not.toHaveBeenCalled();

          const messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 2 }));

          await expect(messagePromise).resolves.toEqual({ type: 'server', index: 2 });
          expect(client.readyState).toBe(WebSocketClient.OPEN);
          expect(console.error).not.toHaveBeenCalled();
        });
      });
    });
  });
}
