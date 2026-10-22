import { waitFor } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { usingWebSocketClient, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'create'; body: { text: string } } | { type: 'delete'; id: string }>;

export function declareEffectWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should run side effects without responses', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const effect = vi.fn();

      await interceptor.message().effect(effect);
      await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const firstReceivedMessage = waitForWebSocketClientMessage(client);

        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(1);
        });

        // Messages on a socket are delivered in order, so the probe response arriving first means that running the
        // effect sent nothing.
        client.send(JSON.stringify({ type: 'delete', id: '1' }));

        await expect(firstReceivedMessage).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));
        expect(effect).toHaveBeenCalledTimes(1);
      });
    });
  });

  it('should allow effects to send targeted messages through the sender', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await interceptor.message().effect((message, { sender }) => {
        sender.send(JSON.stringify({ type: 'delete', id: message.type }));
      });

      await usingWebSocketClient<MessageSchema>(baseURL, async (otherClient) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        await usingWebSocketClient<MessageSchema>(baseURL, async (senderClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          const otherFirstMessage = waitForWebSocketClientMessage(otherClient);
          const senderFirstMessage = waitForWebSocketClientMessage(senderClient);

          senderClient.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(senderFirstMessage).resolves.toBe(JSON.stringify({ type: 'delete', id: 'create' }));

          // Messages on a socket are delivered in order, so the broadcast being the first message of the other client
          // means that the targeted message did not reach it.
          interceptor.server.send(JSON.stringify({ type: 'delete', id: 'broadcast' }));

          await expect(otherFirstMessage).resolves.toBe(JSON.stringify({ type: 'delete', id: 'broadcast' }));
        });
      });
    });
  });

  it('should allow effects to broadcast through the receiver', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await interceptor.message().effect((message, { receiver }) => {
        receiver.send(JSON.stringify({ type: 'delete', id: message.type }));
      });

      await usingWebSocketClient<MessageSchema>(baseURL, async (otherClient) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        await usingWebSocketClient<MessageSchema>(baseURL, async (senderClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          const otherFirstMessage = waitForWebSocketClientMessage(otherClient);
          const senderFirstMessage = waitForWebSocketClientMessage(senderClient);

          senderClient.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          const broadcast = JSON.stringify({ type: 'delete', id: 'create' });

          await expect(otherFirstMessage).resolves.toBe(broadcast);
          await expect(senderFirstMessage).resolves.toBe(broadcast);
        });
      });
    });
  });

  it('should log effect callback errors and keep handling later messages', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const error = new Error('Effect failed.');

      await interceptor
        .message()
        .with({ type: 'create' })
        .effect(() => {
          throw error;
        });

      await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: '2' });

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        await usingIgnoredConsole(['error'], async (console) => {
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitFor(() => {
            expect(console.error).toHaveBeenCalledWith(error);
          });
        });

        const response = waitForWebSocketClientMessage(client);

        client.send(JSON.stringify({ type: 'delete', id: '1' }));

        await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '2' }));
      });
    });
  });

  it('should handle asynchronous effects concurrently', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const startedMessages: MessageSchema[] = [];
      const completedMessages: MessageSchema[] = [];
      const finishEffects: (() => void)[] = [];

      await interceptor.message().effect(async (message) => {
        startedMessages.push(message);

        await new Promise<void>((resolve) => {
          finishEffects.push(resolve);
        });

        completedMessages.push(message);
      });

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        client.send(JSON.stringify({ type: 'create', body: { text: 'first' } }));
        client.send(JSON.stringify({ type: 'create', body: { text: 'second' } }));

        await waitFor(() => {
          expect(startedMessages).toEqual([
            { type: 'create', body: { text: 'first' } },
            { type: 'create', body: { text: 'second' } },
          ]);
        });

        for (const finish of finishEffects) {
          finish();
        }

        await waitFor(() => {
          expect(completedMessages).toHaveLength(2);
        });

        expect(completedMessages).toEqual(
          expect.arrayContaining([
            { type: 'create', body: { text: 'first' } },
            { type: 'create', body: { text: 'second' } },
          ]),
        );
      });
    });
  });
}
