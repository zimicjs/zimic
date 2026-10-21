import { waitFor } from '@zimic/utils/time';
import { beforeAll, beforeEach, afterAll, expect, expectTypeOf, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { usingWebSocketClient, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { ChatMessage, Schema, SharedWebSocketMessageHandlerTestOptions } from './utils';

export function declareRestrictionWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
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

  it('should match only specific messages if contains static restrictions', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'delete', id: 'fallback' });

      const handler = await interceptor
        .message()
        .with({ type: 'create', body: { text: 'hello' } })
        .respond({ type: 'delete', id: 'restricted' })
        .times(1);

      await usingWebSocketClient<Schema>(baseURL, async (client) => {
        const unmatchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'delete', id: '1' }));
        await expect(unmatchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));

        const matchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(matchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));

        await handler.checkTimes();
      });
    });
  });

  it('should match only specific messages if contains computed restrictions', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      function isCreateMessage(message: ChatMessage): message is Extract<ChatMessage, { type: 'create' }> {
        return message.type === 'create';
      }

      const effect = vi.fn((message: Extract<ChatMessage, { type: 'create' }>) => {
        expectTypeOf(message.body.priority).toEqualTypeOf<number | undefined>();
      });

      await interceptor.message().respond({ type: 'delete', id: 'fallback' });

      const handler = await interceptor
        .message()
        .with(isCreateMessage)
        .effect(effect)
        .respond({ type: 'delete', id: 'restricted' })
        .times(1);

      await usingWebSocketClient<Schema>(baseURL, async (client) => {
        const unmatchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'delete', id: '1' }));
        await expect(unmatchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
        expect(effect).not.toHaveBeenCalled();

        const matchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(matchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));

        expect(effect).toHaveBeenCalledTimes(1);
        await handler.checkTimes();
      });
    });
  });

  it('should match only specific messages if contains boolean computed restrictions', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const effect = vi.fn();

      await interceptor.message().respond({ type: 'delete', id: 'fallback' });

      const handler = await interceptor
        .message()
        .with((message: Schema): boolean => message.type === 'create' && message.body.text.startsWith('hello'))
        .effect(effect)
        .respond({ type: 'delete', id: 'restricted' })
        .times(1);

      await usingWebSocketClient<Schema>(baseURL, async (client) => {
        const deleteResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'delete', id: '1' }));
        await expect(deleteResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));

        const goodbyeResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'goodbye' } }));
        await expect(goodbyeResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
        expect(effect).not.toHaveBeenCalled();

        const helloResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(helloResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));

        expect(effect).toHaveBeenCalledTimes(1);
        await handler.checkTimes();
      });
    });
  });

  it('should match only messages from a restricted sender', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        await interceptor.message().respond({ type: 'delete', id: 'fallback' });

        await usingWebSocketClient<Schema>(baseURL, async (restrictedClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          await usingWebSocketClient<Schema>(baseURL, async (otherClient) => {
            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(2);
            });

            const [restrictedSender] = interceptor.clients;

            const effect = vi.fn();
            const handler = await interceptor
              .message()
              .from(restrictedSender)
              .effect(effect)
              .respond({ type: 'delete', id: 'restricted' })
              .times(1);

            // The fallback response shows that the message from the other client was handled without matching the
            // restricted handler.
            const otherResponse = waitForWebSocketClientMessage(otherClient);

            otherClient.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));

            await expect(otherResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
            expect(effect).not.toHaveBeenCalled();

            const restrictedResponse = waitForWebSocketClientMessage(restrictedClient);

            restrictedClient.send(JSON.stringify({ type: 'create', body: { text: 'restricted' } }));

            await expect(restrictedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));

            await waitFor(() => {
              expect(handler.messages).toHaveLength(1);
            });

            expect(effect).toHaveBeenCalledTimes(1);
            expect(effect.mock.calls[0][0]).toEqual({ type: 'create', body: { text: 'restricted' } });
            expect(handler.messages[0].sender).toBe(restrictedSender);
            expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'restricted' } });

            await handler.checkTimes();
          });
        });
      },
    );
  });

  it('should match only messages satisfying multiple restrictions', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const effect = vi.fn();

      await interceptor.message().respond({ type: 'delete', id: 'fallback' });

      const handler = await interceptor
        .message()
        .with({ type: 'create' })
        .with(
          (message: Schema): message is Extract<Schema, { type: 'create' }> =>
            message.type === 'create' && message.body.text.startsWith('hello'),
        )
        .effect(effect)
        .respond({ type: 'delete', id: 'restricted' })
        .times(1);

      await usingWebSocketClient<Schema>(baseURL, async (client) => {
        const unmatchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'goodbye' } }));
        await expect(unmatchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
        expect(effect).not.toHaveBeenCalled();

        const matchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(matchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));

        expect(effect).toHaveBeenCalledTimes(1);
        await handler.checkTimes();
      });
    });
  });
}
