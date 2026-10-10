import { waitFor } from '@zimic/utils/time';
import { WebSocketClient } from '@zimic/ws';
import { beforeAll, beforeEach, afterAll, expect, expectTypeOf, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { ChatMessage, Schema, SharedWebSocketMessageHandlerTestOptions } from './types';

export function declareRestrictionWebSocketMessageHandlerTests(
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

  it('should match only specific messages if contains static restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor
          .message()
          .with({ type: 'create', body: { text: 'hello' } })
          .respond({ type: 'delete', id: 'hello' })
          .times(1);
        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          const responsePromise = new Promise<string>((resolve) => {
            client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
          });
          client.send(JSON.stringify({ type: 'delete', id: '1' }));
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(responsePromise).resolves.toBe('{"type":"delete","id":"hello"}');
          await waitFor(() => expect(handler.messages).toHaveLength(1));
          expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });
          await handler.checkTimes();
        } finally {
          await client.close();
        }
      },
    );
  });

  it('should match only specific messages if contains computed restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        function isCreateMessage(message: ChatMessage): message is Extract<ChatMessage, { type: 'create' }> {
          return message.type === 'create';
        }

        const effect = vi.fn((message: Schema) => {
          if (message.type === 'create') {
            expectTypeOf(message.body.priority).toEqualTypeOf<number | undefined>();
          }
        });
        const handler = await interceptor.message().with(isCreateMessage).effect(effect).times(1);
        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          client.send(JSON.stringify({ type: 'delete', id: '1' }));
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitFor(() => expect(handler.messages).toHaveLength(1));
          expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });
          expect(effect.mock.calls[0]?.[0]).toEqual({ type: 'create', body: { text: 'hello' } });
          await handler.checkTimes();
        } finally {
          await client.close();
        }
      },
    );
  });

  it('should match only specific messages if contains boolean computed restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const effect = vi.fn();
        const handler = await interceptor
          .message()
          .with((message: Schema): boolean => message.type === 'create' && message.body.text.startsWith('hello'))
          .effect(effect)
          .times(1);
        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          client.send(JSON.stringify({ type: 'delete', id: '1' }));
          client.send(JSON.stringify({ type: 'create', body: { text: 'goodbye' } }));
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitFor(() => expect(handler.messages).toHaveLength(1));
          expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });
          expect(effect).toHaveBeenCalledTimes(1);
          await handler.checkTimes();
        } finally {
          await client.close();
        }
      },
    );
  });

  it('should match only messages from a restricted sender', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const otherMessageHandled = Promise.withResolvers<void>();
        const fallbackEffect = vi.fn((_message: Schema) => otherMessageHandled.resolve());
        await interceptor.message().effect(fallbackEffect);

        const allowedClient = new WebSocketClient<Schema>(baseURL);
        const otherClient = new WebSocketClient<Schema>(baseURL);

        try {
          await allowedClient.open();
          await waitFor(() => expect(interceptor.clients).toHaveLength(1));
          const allowedSender = interceptor.clients[0];
          await otherClient.open();
          await waitFor(() => expect(interceptor.clients).toHaveLength(2));

          const effect = vi.fn();
          const handler = await interceptor
            .message()
            .from(allowedSender)
            .respond({ type: 'delete', id: 'restricted' })
            .effect(effect)
            .times(1);

          otherClient.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));
          await otherMessageHandled.promise;
          expect(handler.messages).toHaveLength(0);

          const responsePromise = new Promise<string>((resolve) => {
            allowedClient.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
          });
          allowedClient.send(JSON.stringify({ type: 'create', body: { text: 'restricted' } }));

          await expect(responsePromise).resolves.toBe('{"type":"delete","id":"restricted"}');
          await waitFor(() => expect(handler.messages).toHaveLength(1));
          expect(effect.mock.calls[0]?.[0]).toEqual({ type: 'create', body: { text: 'restricted' } });
          expect(handler.messages[0].sender).toBe(allowedSender);
          expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'restricted' } });
          await handler.checkTimes();
        } finally {
          await Promise.all([allowedClient.close(), otherClient.close()]);
        }
      },
    );
  });

  it('should match only messages satisfying multiple restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const effect = vi.fn();
        const handler = await interceptor
          .message()
          .with({ type: 'create' })
          .with(
            (message: Schema): message is Extract<Schema, { type: 'create' }> =>
              message.type === 'create' && message.body.text.startsWith('hello'),
          )
          .effect(effect)
          .times(1);
        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          client.send(JSON.stringify({ type: 'create', body: { text: 'goodbye' } }));
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitFor(() => expect(handler.messages).toHaveLength(1));
          expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });
          expect(effect).toHaveBeenCalledTimes(1);
          await handler.checkTimes();
        } finally {
          await client.close();
        }
      },
    );
  });

  it('should clear restrictions after cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const unmatchedMessageHandled = Promise.withResolvers<void>();
        await interceptor.message().effect((_message, { sender }) => {
          sender.send(JSON.stringify({ type: 'delete', id: 'fallback' }));
          unmatchedMessageHandled.resolve();
        });
        const handler = await interceptor
          .message()
          .with({ type: 'delete' })
          .respond({ type: 'delete', id: '1' })
          .times(1);
        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          const fallbackResponse = new Promise<string>((resolve) => {
            client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
          });
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
          await expect(fallbackResponse).resolves.toBe('{"type":"delete","id":"fallback"}');
          await unmatchedMessageHandled.promise;

          const clearedHandler = await handler.clear();
          await clearedHandler.respond({ type: 'delete', id: '2' }).times(1);
          const responsePromise = new Promise<string>((resolve) => {
            client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
          });
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(responsePromise).resolves.toBe('{"type":"delete","id":"2"}');
          await waitFor(() => expect(clearedHandler.messages).toHaveLength(1));
          expect(clearedHandler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });
          await clearedHandler.checkTimes();
        } finally {
          await client.close();
        }
      },
    );
  });
}
