import { beforeAll, beforeEach, afterAll, expect, expectTypeOf, it, vi } from 'vitest';

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

      const effect = vi.fn((message: Schema) => {
        if (message.type === 'create') {
          expectTypeOf(message.body.priority).toEqualTypeOf<number | undefined>();
        }
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
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL, Handler, messageSaving: { enabled: true } },
      async ({ handler, sender, createSender, handleMessage }) => {
        const otherSender = createSender(`${baseURL}/other`);

        handler.from(sender.handle);
        handler.respond({ type: 'delete', id: '1' });
        handler.times(1);

        await expect(
          handleMessage({ type: 'create', body: { text: 'other' } }, { sender: otherSender.handle }),
        ).resolves.toBe(false);
        await expect(handleMessage({ type: 'create', body: { text: 'restricted' } })).resolves.toBe(true);

        expect(handler.messages).toHaveLength(1);
        expect(handler.messages[0].sender).toBe(sender.handle);
        expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'restricted' } });
        expect(otherSender.sentMessages).toEqual([]);

        await handler.checkTimes();
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

        handler.clear().respond({ type: 'delete', id: '2' }).times(1);

        await expect(handleMessage({ type: 'create', body: { text: 'hello' } })).resolves.toBe(true);

        expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '2' })]);
        await handler.checkTimes();
      },
    );
  });
}
