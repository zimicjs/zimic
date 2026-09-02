import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import DisabledMessageSavingError from '../../errors/DisabledMessageSavingError';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { usingDirectWebSocketMessageHandler } from './utils';

export function declareDefaultWebSocketMessageHandlerTests(
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

  it('should match any message without a declared response, effect, or restrictions', async () => {
    await usingDirectWebSocketMessageHandler<Schema>({ type, baseURL, Handler }, async ({ handleMessage }) => {
      const didHandleMessage = await handleMessage({ type: 'create', body: { text: 'hello' } });

      expect(didHandleMessage).toBe(true);
    });
  });

  it('should match any message with a declared response and no restrictions', async () => {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL, Handler },
      async ({ handler, sender, handleMessage }) => {
        handler.respond({ type: 'delete', id: '1' });

        const didHandleMessage = await handleMessage({ type: 'create', body: { text: 'hello' } });

        expect(didHandleMessage).toBe(true);
        expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
      },
    );
  });

  it('should reset a message handler if cleared', async () => {
    await usingDirectWebSocketMessageHandler<Schema>({ type, baseURL, Handler }, async ({ handler }) => {
      handler.respond({ type: 'delete', id: '1' }).times(1);

      await expect(async () => {
        await handler.checkTimes();
      }).rejects.toThrow('Expected exactly 1 message, but got 0.');

      handler.clear();

      await handler.checkTimes();
    });
  });

  it('should create responses with declared messages and factories', async () => {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL, Handler },
      async ({ handler, sender, handleMessage }) => {
        const responseFactory = vi.fn((message: Schema) => ({ type: 'delete' as const, id: message.type }));

        handler.respond(responseFactory);

        await handleMessage({ type: 'create', body: { text: 'hello' } });

        expect(responseFactory).toHaveBeenCalledTimes(1);
        expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: 'create' })]);
      },
    );
  });

  it('should not throw when applying a message without a declared response', async () => {
    await usingDirectWebSocketMessageHandler<Schema>({ type, baseURL, Handler }, async ({ handleMessage }) => {
      await expect(handleMessage({ type: 'create', body: { text: 'hello' } })).resolves.toBe(true);
    });
  });

  it('should keep track of intercepted messages', async () => {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL, Handler, messageSaving: { enabled: true } },
      async ({ handler, sender, receiver, handleMessage }) => {
        handler.respond({ type: 'delete', id: '1' });

        expect(handler.messages).toEqual([]);

        await handleMessage({ type: 'create', body: { text: 'hello' } });

        expect(handler.messages).toHaveLength(1);
        expect(handler.messages[0].sender).toBe(sender.handle);
        expect(handler.messages[0].sender.url).toBe(baseURL);
        expect(handler.messages[0].receiver).toBe(receiver);
        expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });
      },
    );
  });

  it('should clear intercepted messages in place after cleared', async () => {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL, Handler, messageSaving: { enabled: true } },
      async ({ handler, sender, receiver, handleMessage }) => {
        handler.respond({ type: 'delete', id: '1' });

        await handleMessage({ type: 'create', body: { text: 'hello' } });

        const handlerMessages = handler.messages;
        const senderMessages = sender.handle.messages;
        const receiverMessages = receiver.messages;

        expect(handlerMessages).toHaveLength(1);
        expect(senderMessages).toHaveLength(1);
        expect(receiverMessages).toHaveLength(1);

        handler.clear();

        expect(handler.messages).toBe(handlerMessages);
        expect(handler.messages).toHaveLength(0);
        expect(sender.handle.messages).toBe(senderMessages);
        expect(sender.handle.messages).toHaveLength(0);
        expect(receiver.messages).toBe(receiverMessages);
        expect(receiver.messages).toHaveLength(0);
      },
    );
  });

  it('should not expose saved messages when message saving is disabled', async () => {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL, Handler, messageSaving: { enabled: false } },
      async ({ handler, handleMessage }) => {
        handler.respond({ type: 'delete', id: '1' });

        await handleMessage({ type: 'create', body: { text: 'hello' } });

        expect(() => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          handler.messages;
        }).toThrow(new DisabledMessageSavingError());
      },
    );
  });
}
