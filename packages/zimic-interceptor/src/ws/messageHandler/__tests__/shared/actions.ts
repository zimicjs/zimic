import { WebSocketSchema } from '@zimic/ws';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { createBinaryMessage, readBytes, usingDirectWebSocketMessageHandler } from './utils';

type BinarySchema = WebSocketSchema<ArrayBuffer>;

export function declareActionWebSocketMessageHandlerTests(
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

  describe('Responses', () => {
    it('should send static responses', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ handler, sender, handleMessage }) => {
          handler.respond({ type: 'delete', id: '1' });

          await handleMessage({ type: 'create', body: { text: 'hello' } });

          expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);
        },
      );
    });

    it('should send computed responses', async () => {
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

    it('should reject response callback errors and leave later messages usable', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ interceptor, sender, handleMessage }) => {
          const error = new Error('Response failed.');

          const failedHandler = interceptor.message();
          failedHandler.with({ type: 'create' });
          failedHandler.respond(() => {
            throw error;
          });
          const recoveryHandler = interceptor.message();
          recoveryHandler.with({ type: 'delete' });
          recoveryHandler.respond({ type: 'delete', id: '2' });

          await expect(handleMessage({ type: 'create', body: { text: 'hello' } })).rejects.toThrow(error);

          await expect(handleMessage({ type: 'delete', id: '1' })).resolves.toBe(true);
          expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '2' })]);
        },
      );
    });

    it('should give later handlers priority and skip exhausted handlers', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ interceptor, sender, handleMessage }) => {
          const firstHandler = interceptor.message().respond({ type: 'delete', id: 'first' }).times(1);
          const secondHandler = interceptor.message().respond({ type: 'delete', id: 'second' }).times(1);

          await handleMessage({ type: 'create', body: { text: 'one' } });
          await handleMessage({ type: 'create', body: { text: 'two' } });

          expect(sender.sentMessages).toEqual([
            JSON.stringify({ type: 'delete', id: 'second' }),
            JSON.stringify({ type: 'delete', id: 'first' }),
          ]);

          await firstHandler.checkTimes();
          await secondHandler.checkTimes();
        },
      );
    });

    it('should passively handle messages without sending a response', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler, messageSaving: { enabled: true } },
        async ({ handler, sender, handleMessage }) => {
          handler.with({ type: 'create' });
          handler.times(1);

          await handleMessage({ type: 'create', body: { text: 'hello' } });

          expect(handler.messages).toHaveLength(1);
          expect(sender.sentMessages).toEqual([]);
          await handler.checkTimes();
        },
      );
    });
  });

  describe('Effects', () => {
    it('should run side effects without responses', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ handler, sender, handleMessage }) => {
          const effect = vi.fn();

          handler.effect(effect);

          await handleMessage({ type: 'create', body: { text: 'hello' } });

          expect(effect).toHaveBeenCalledTimes(1);
          expect(sender.sentMessages).toEqual([]);
        },
      );
    });

    it('should allow effects to send targeted messages through the sender', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ handler, sender, handleMessage }) => {
          handler.effect((message, { sender }) => {
            sender.send(JSON.stringify({ type: 'delete', id: message.type }));
          });

          await handleMessage({ type: 'create', body: { text: 'hello' } });

          expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: 'create' })]);
        },
      );
    });

    it('should allow effects to broadcast through the receiver', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ handler, receivedMessages, handleMessage }) => {
          handler.effect((message, { receiver }) => {
            receiver.send(JSON.stringify({ type: 'delete', id: message.type }));
          });

          await handleMessage({ type: 'create', body: { text: 'hello' } });

          expect(receivedMessages).toEqual([JSON.stringify({ type: 'delete', id: 'create' })]);
        },
      );
    });

    it('should reject effect callback errors and leave later messages usable', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ interceptor, sender, handleMessage }) => {
          const error = new Error('Effect failed.');

          const failedHandler = interceptor.message();
          failedHandler.with({ type: 'create' });
          failedHandler.effect(() => {
            throw error;
          });
          const recoveryHandler = interceptor.message();
          recoveryHandler.with({ type: 'delete' });
          recoveryHandler.respond({ type: 'delete', id: '2' });

          await expect(handleMessage({ type: 'create', body: { text: 'hello' } })).rejects.toThrow(error);

          await handleMessage({ type: 'delete', id: '1' });

          expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '2' })]);
        },
      );
    });
  });

  it('should support binary responses', async () => {
    await usingDirectWebSocketMessageHandler<BinarySchema>(
      { type, baseURL, Handler },
      async ({ handler, sender, handleMessage }) => {
        const response = createBinaryMessage(1, 2);

        handler.respond(response);

        await handleMessage(createBinaryMessage(3, 4));

        expect(await readBytes(sender.sentMessages[0] as ArrayBuffer)).toEqual([1, 2]);
      },
    );
  });
}
