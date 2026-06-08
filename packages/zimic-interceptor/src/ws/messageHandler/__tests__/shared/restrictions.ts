import { waitFor, waitForNot } from '@zimic/utils/time';
import { beforeAll, beforeEach, afterAll, expect, expectTypeOf, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { ChatMessage, Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { usingWebSocketClient, waitForWebSocketMessage } from './utils';

export function declareRestrictionWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
  },
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

  it('should match only specific messages if contains a declared response and static restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .message()
            .with({ type: 'create', body: { text: 'hello' } })
            .respond({ type: 'delete', id: '1' })
            .times(1),
          interceptor,
        );
        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const unmatchedMessageListener = vi.fn();
          client.addEventListener('message', unmatchedMessageListener);

          client.send(JSON.stringify({ type: 'delete', id: '1' }));

          await waitForNot(() => {
            expect(unmatchedMessageListener).toHaveBeenCalled();
          });

          client.removeEventListener('message', unmatchedMessageListener);

          const messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });
        });

        await handler.checkTimes();
      },
    );
  });

  it('should match only specific messages if contains a declared response and computed restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        function isCreateMessage(message: ChatMessage): message is Extract<ChatMessage, { type: 'create' }> {
          return message.type === 'create';
        }

        const effect = vi.fn((message: Extract<ChatMessage, { type: 'create' }>) => {
          expectTypeOf(message.body.priority).toEqualTypeOf<number | undefined>();
        });

        const handler = await promiseIfRemote(
          interceptor.message().with(isCreateMessage).effect(effect).times(1),
          interceptor,
        );

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          client.send(JSON.stringify({ type: 'delete', id: '1' }));

          await waitForNot(() => {
            expect(effect).toHaveBeenCalled();
          });

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitFor(() => {
            expect(effect).toHaveBeenCalledTimes(1);
          });
        });

        await handler.checkTimes();
      },
    );
  });

  it('should match only messages from a restricted sender', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
        messageSaving: { enabled: true },
      },
      async (interceptor) => {
        await promiseIfRemote(interceptor.message().times(0), interceptor);

        await usingWebSocketClient<Schema>(baseURL, async (firstClient) => {
          await usingWebSocketClient<Schema>(baseURL, async (secondClient) => {
            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(2);
            });

            const handler = await promiseIfRemote(
              interceptor.message().from(interceptor.clients[0]).respond({ type: 'delete', id: '1' }).times(1),
              interceptor,
            );

            const secondMessageListener = vi.fn();
            secondClient.addEventListener('message', secondMessageListener);

            secondClient.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));

            await waitForNot(() => {
              expect(secondMessageListener).toHaveBeenCalled();
            });

            const firstMessagePromise = waitForWebSocketMessage(firstClient);
            firstClient.send(JSON.stringify({ type: 'create', body: { text: 'restricted' } }));

            await expect(firstMessagePromise).resolves.toEqual({ type: 'delete', id: '1' });

            await waitFor(() => {
              expect(handler.messages).toHaveLength(1);
            });

            expect(handler.messages[0].sender).toBe(interceptor.clients[0]);
            expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'restricted' } });

            await handler.checkTimes();
          });
        });
      },
    );
  });

  it('should match only messages satisfying multiple restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const effect = vi.fn();

        const handler = await promiseIfRemote(
          interceptor
            .message()
            .with({ type: 'create' })
            .with((message): message is Extract<Schema, { type: 'create' }> => message.body.text.startsWith('hello'))
            .effect(effect)
            .times(1),
          interceptor,
        );
        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          client.send(JSON.stringify({ type: 'create', body: { text: 'goodbye' } }));

          await waitForNot(() => {
            expect(effect).toHaveBeenCalled();
          });

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitFor(() => {
            expect(effect).toHaveBeenCalledTimes(1);
          });
        });

        await handler.checkTimes();
      },
    );
  });

  it('should clear restrictions after cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: '1' }).times(1),
          interceptor,
        );
        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const unmatchedMessageListener = vi.fn();
          client.addEventListener('message', unmatchedMessageListener);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitForNot(() => {
            expect(unmatchedMessageListener).toHaveBeenCalled();
          });

          client.removeEventListener('message', unmatchedMessageListener);

          await promiseIfRemote(handler.clear().respond({ type: 'delete', id: '2' }).times(1), interceptor);

          const messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '2' });

          await handler.checkTimes();
        });
      },
    );
  });
}
