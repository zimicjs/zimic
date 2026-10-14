import { waitFor } from '@zimic/utils/time';
import { WebSocketClient } from '@zimic/ws';
import { beforeAll, beforeEach, afterAll, expect, expectTypeOf, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { ChatMessage, Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { usingDirectWebSocketMessageHandler } from './utils';

export function declareRestrictionWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
  },
) {
  const { type, Handler, startServer, stopServer, getBaseURL } = options;

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

  // The tests using the direct fixture assert the dispatch match result. The transport does not expose it, since an
  // unmatched message is dropped without any signal to the client.
  it('should match only specific messages if contains static restrictions', async () => {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL, Handler },
      async ({ handler, sender, handleMessage }) => {
        handler.with({ type: 'create', body: { text: 'hello' } });
        handler.respond({ type: 'delete', id: '1' });
        handler.times(1);

        await expect(handleMessage({ type: 'delete', id: '1' })).resolves.toBe(false);
        await expect(handleMessage({ type: 'create', body: { text: 'hello' } })).resolves.toBe(true);

        expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
        await handler.checkTimes();
      },
    );
  });

  it('should match only specific messages if contains computed restrictions', async () => {
    await usingDirectWebSocketMessageHandler<Schema>({ type, baseURL, Handler }, async ({ handler, handleMessage }) => {
      function isCreateMessage(message: ChatMessage): message is Extract<ChatMessage, { type: 'create' }> {
        return message.type === 'create';
      }

      const effect = vi.fn((_message: Schema) => {
        expectTypeOf<Extract<typeof _message, { type: 'create' }>['body']['priority']>().toEqualTypeOf<
          number | undefined
        >();
      });

      handler.with(isCreateMessage);
      handler.effect(effect);
      handler.times(1);

      await expect(handleMessage({ type: 'delete', id: '1' })).resolves.toBe(false);
      await expect(handleMessage({ type: 'create', body: { text: 'hello' } })).resolves.toBe(true);

      expect(effect).toHaveBeenCalledTimes(1);
      await handler.checkTimes();
    });
  });

  it('should match only specific messages if contains boolean computed restrictions', async () => {
    await usingDirectWebSocketMessageHandler<Schema>({ type, baseURL, Handler }, async ({ handler, handleMessage }) => {
      const effect = vi.fn();

      handler.with((message: Schema): boolean => message.type === 'create' && message.body.text.startsWith('hello'));
      handler.effect(effect);
      handler.times(1);

      await expect(handleMessage({ type: 'delete', id: '1' })).resolves.toBe(false);
      await expect(handleMessage({ type: 'create', body: { text: 'goodbye' } })).resolves.toBe(false);
      await expect(handleMessage({ type: 'create', body: { text: 'hello' } })).resolves.toBe(true);

      expect(effect).toHaveBeenCalledTimes(1);
      await handler.checkTimes();
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
          const otherResponse = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
            otherClient.addEventListener('message', resolve, { once: true });
          });

          otherClient.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));

          await expect(otherResponse).resolves.toMatchObject({
            data: JSON.stringify({ type: 'delete', id: 'fallback' }),
          });
          expect(effect).not.toHaveBeenCalled();

          const restrictedResponse = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
            restrictedClient.addEventListener('message', resolve, { once: true });
          });

          restrictedClient.send(JSON.stringify({ type: 'create', body: { text: 'restricted' } }));

          await expect(restrictedResponse).resolves.toMatchObject({
            data: JSON.stringify({ type: 'delete', id: 'restricted' }),
          });

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
    await usingDirectWebSocketMessageHandler<Schema>({ type, baseURL, Handler }, async ({ handler, handleMessage }) => {
      const effect = vi.fn();

      handler.with({ type: 'create' });
      handler.with(
        (message: Schema): message is Extract<Schema, { type: 'create' }> =>
          message.type === 'create' && message.body.text.startsWith('hello'),
      );
      handler.effect(effect);
      handler.times(1);

      await expect(handleMessage({ type: 'create', body: { text: 'goodbye' } })).resolves.toBe(false);
      await expect(handleMessage({ type: 'create', body: { text: 'hello' } })).resolves.toBe(true);

      expect(effect).toHaveBeenCalledTimes(1);
      await handler.checkTimes();
    });
  });

  it('should clear restrictions after cleared', async () => {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL, Handler },
      async ({ handler, sender, handleMessage }) => {
        handler.with({ type: 'delete' });
        handler.respond({ type: 'delete', id: '1' });
        handler.times(1);

        await expect(handleMessage({ type: 'create', body: { text: 'hello' } })).resolves.toBe(false);

        const clearedHandler = handler.clear();
        expect(clearedHandler).toBe(handler);
        clearedHandler.respond({ type: 'delete', id: '2' }).times(1);

        await expect(handleMessage({ type: 'create', body: { text: 'hello' } })).resolves.toBe(true);

        expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '2' })]);
        await handler.checkTimes();
      },
    );
  });
}
