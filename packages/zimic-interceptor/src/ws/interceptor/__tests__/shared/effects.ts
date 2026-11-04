import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import {
  expectWebSocketConnectionToBeRefused,
  usingWebSocketClient,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import { WebSocketInterceptorClient } from '../../types/messages';
import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions, verifyUnhandledMessageWarning } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'create'; body: { text: string } } | { type: 'delete'; id: string }>;

export function declareEffectWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { platform, getBaseURL, getInterceptorOptions } = options;

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
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, onUnhandledMessage: { log: true } },
      async (interceptor) => {
        const error = new Error('Effect failed.');

        await interceptor
          .message()
          .with({ type: 'create' })
          .effect(() => {
            throw error;
          });

        await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: '2' });

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await usingIgnoredConsole(['error', 'warn'], async (console) => {
            const message: MessageSchema = { type: 'create', body: { text: 'hello' } };
            client.send(JSON.stringify(message));

            // The message logs the effect error and the unhandled message.
            await waitFor(() => {
              expect(console.warn).toHaveBeenCalledTimes(1);
            });

            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error.mock.calls[0]).toEqual([error]);

            await verifyUnhandledMessageWarning(console.warn.mock.calls[0], {
              data: message,
              url: client.url,
              platform,
            });
          });

          const response = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'delete', id: '1' }));

          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '2' }));
        });
      },
    );
  });

  it('should not try older handlers after an effect callback throws', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const error = new Error('Effect failed.');

      await interceptor.message().with({ type: 'create' }).respond({ type: 'delete', id: 'older' });

      await interceptor
        .message()
        .with({ type: 'create' })
        .effect(() => {
          throw error;
        });

      await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        await usingIgnoredConsole(['error', 'warn'], async (console) => {
          const firstReceivedMessage = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          // Messages on a socket are delivered in order, so the probe response arriving first means that the older
          // handler sent no response.
          client.send(JSON.stringify({ type: 'delete', id: '1' }));

          await expect(firstReceivedMessage).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));

          expect(console.error).toHaveBeenCalledTimes(1);
          expect(console.error.mock.calls[0]).toEqual([error]);
        });
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

  describe('Connections', () => {
    it('should run connection effects with the handle of accepted clients after they are listed', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const clientsAtEffect: unknown[][] = [];

        const effect = vi.fn((client: WebSocketInterceptorClient<MessageSchema>) => {
          clientsAtEffect.push([...interceptor.clients]);
          client.send(JSON.stringify({ type: 'delete', id: 'welcome' }));
        });

        await interceptor.connection().effect(effect);

        const client = new WebSocketClient<MessageSchema>(baseURL);
        const welcomeMessage = waitForWebSocketClientMessage(client);

        try {
          await client.open();

          await expect(welcomeMessage).resolves.toBe(JSON.stringify({ type: 'delete', id: 'welcome' }));

          expect(effect).toHaveBeenCalledTimes(1);
          expect(effect).toHaveBeenCalledWith(interceptor.clients[0]);
          expect(clientsAtEffect).toEqual([[interceptor.clients[0]]]);
        } finally {
          await client.close();
        }
      });
    });

    it('should not run connection effects for rejected connections', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const effect = vi.fn();

        await interceptor.connection().effect(effect).respond({ action: 'reject' });

        await expectWebSocketConnectionToBeRefused(baseURL);

        expect(effect).not.toHaveBeenCalled();
      });
    });

    it('should log connection effect errors and keep the connection open', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const error = new Error('Effect failed.');

        await interceptor.connection().effect(() => {
          throw error;
        });

        await usingIgnoredConsole(['error'], async (console) => {
          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            await waitFor(() => {
              expect(console.error).toHaveBeenCalledTimes(1);
            });
            expect(console.error.mock.calls[0]).toEqual([error]);

            const message = JSON.stringify({ type: 'delete', id: 'after-error' } satisfies MessageSchema);
            const messagePromise = waitForWebSocketClientMessage(client);
            interceptor.server.send(message);
            await expect(messagePromise).resolves.toBe(message);
          });
        });
      });
    });

    // Effects do not delay the handshake, so an effect waiting for a message from its client can receive it.
    it('should not wait for asynchronous connection effects before opening connections', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const clientMessagePromise = createPromiseWithResolvers<MessageSchema>();
        const connectionEffectCompletedPromise = createPromiseWithResolvers<MessageSchema>();

        await interceptor.connection().effect(async () => {
          connectionEffectCompletedPromise.resolve(await clientMessagePromise);
        });
        await interceptor.message().effect((message) => {
          clientMessagePromise.resolve(message);
        });

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          client.send(JSON.stringify({ type: 'delete', id: 'from-client' }));
          await expect(connectionEffectCompletedPromise).resolves.toEqual({ type: 'delete', id: 'from-client' });
        });
      });
    });
  });
}
