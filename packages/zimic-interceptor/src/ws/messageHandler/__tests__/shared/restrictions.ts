import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeAll, beforeEach, afterAll, expect, expectTypeOf, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { ChatMessage, Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { createBinaryMessage } from './utils';

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

      const client = new WebSocketClient<Schema>(baseURL);

      try {
        await client.open();

        const unmatchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'delete', id: '1' }));
        await expect(unmatchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));

        const matchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(matchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));

        await handler.checkTimes();
      } finally {
        await client.close();
      }
    });
  });

  it('should not match JSON messages if contains static binary restrictions', async () => {
    type BinarySchema = WebSocketSchema<{ type: 'a' | 'b' } | ArrayBuffer>;

    await usingWebSocketInterceptor<BinarySchema>({ type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'a' });

      const handler = await interceptor.message().with(createBinaryMessage(1, 2)).respond({ type: 'b' }).times(0);

      const client = new WebSocketClient<BinarySchema>(baseURL);

      try {
        await client.open();

        const unmatchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'a' }));
        await expect(unmatchedResponse).resolves.toBe(JSON.stringify({ type: 'a' }));

        await handler.checkTimes();
      } finally {
        await client.close();
      }
    });
  });

  it('should match only specific messages if contains computed restrictions', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      function isCreateMessage(message: ChatMessage): message is Extract<ChatMessage, { type: 'create' }> {
        return message.type === 'create';
      }

      const effect = vi.fn((message: Schema) => {
        if (message.type === 'create') {
          expectTypeOf(message.body.priority).toEqualTypeOf<number | undefined>();
        }
      });

      await interceptor.message().respond({ type: 'delete', id: 'fallback' });

      const handler = await interceptor
        .message()
        .with(isCreateMessage)
        .effect(effect)
        .respond({ type: 'delete', id: 'restricted' })
        .times(1);

      const client = new WebSocketClient<Schema>(baseURL);

      try {
        await client.open();

        const unmatchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'delete', id: '1' }));
        await expect(unmatchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
        expect(effect).not.toHaveBeenCalled();

        const matchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(matchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));

        expect(effect).toHaveBeenCalledTimes(1);
        await handler.checkTimes();
      } finally {
        await client.close();
      }
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

      const client = new WebSocketClient<Schema>(baseURL);

      try {
        await client.open();

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
      } finally {
        await client.close();
      }
    });
  });

  it('should match only messages from a restricted sender', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        await interceptor.message().respond({ type: 'delete', id: 'fallback' });

        const restrictedClient = new WebSocketClient<Schema>(baseURL);
        const otherClient = new WebSocketClient<Schema>(baseURL);

        try {
          await restrictedClient.open();
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          await otherClient.open();
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
        } finally {
          await Promise.all([restrictedClient.close(), otherClient.close()]);
        }
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

      const client = new WebSocketClient<Schema>(baseURL);

      try {
        await client.open();

        const unmatchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'goodbye' } }));
        await expect(unmatchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
        expect(effect).not.toHaveBeenCalled();

        const matchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(matchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));

        expect(effect).toHaveBeenCalledTimes(1);
        await handler.checkTimes();
      } finally {
        await client.close();
      }
    });
  });

  it('should clear restrictions after cleared', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'delete', id: 'fallback' });

      const handler = await interceptor
        .message()
        .with({ type: 'delete' })
        .respond({ type: 'delete', id: '1' })
        .times(1);

      const client = new WebSocketClient<Schema>(baseURL);

      try {
        await client.open();

        const restrictedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(restrictedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));

        await handler.clear().respond({ type: 'delete', id: '2' }).times(1);

        const clearedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(clearedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: '2' }));

        await handler.checkTimes();
      } finally {
        await client.close();
      }
    });
  });
}
