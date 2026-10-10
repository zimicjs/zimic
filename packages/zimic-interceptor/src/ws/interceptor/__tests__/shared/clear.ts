import { expect, it } from 'vitest';

import type { Schema } from '../../../messageHandler/__tests__/shared/types';
import { usingDirectWebSocketMessageHandler } from '../../../messageHandler/__tests__/shared/utils';
import NotRunningWebSocketInterceptorError from '../../errors/NotRunningWebSocketInterceptorError';
import type { WebSocketInterceptorType } from '../../types/options';

interface SharedWebSocketInterceptorClearTestsOptions {
  type: WebSocketInterceptorType;
}

export function declareClearWebSocketInterceptorTests(options: SharedWebSocketInterceptorClearTestsOptions) {
  const { type } = options;

  it('should not clear state when cleared before starting', async () => {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL: 'ws://localhost', messageSaving: { enabled: true } },
      async ({ interceptor, handler, sender, receiver, handleMessage }) => {
        const effectStarted = Promise.withResolvers<void>();
        const effectRelease = Promise.withResolvers<void>();

        handler.effect(async (message) => {
          if (message.type === 'create' && message.body.text === 'pending') {
            effectStarted.resolve();
            await effectRelease.promise;
          }
        });
        handler.respond({ type: 'delete', id: '1' });
        await handleMessage({ type: 'create', body: { text: 'saved' } });

        const handlerMessages = [...handler.messages];
        const clients = [...interceptor.clients];
        const pendingMessage = handleMessage({ type: 'create', body: { text: 'pending' } });
        await effectStarted.promise;
        interceptor.implementation.isRunning = false;

        try {
          if (type === 'local') {
            expect(() => interceptor.clear()).toThrow(NotRunningWebSocketInterceptorError);
          } else {
            await expect(interceptor.clear()).rejects.toThrow(NotRunningWebSocketInterceptorError);
          }
        } finally {
          interceptor.implementation.isRunning = true;
          effectRelease.resolve();
        }

        await pendingMessage;

        expect(interceptor.implementation.messageStore.size).toBe(2);
        expect(handler.messages).toHaveLength(2);
        expect(handler.messages[0]).toBe(handlerMessages[0]);
        expect(handler.messages[1].data).toEqual({ type: 'create', body: { text: 'pending' } });
        expect(sender.handle.messages).toHaveLength(2);
        expect(receiver.messages).toHaveLength(2);
        expect(interceptor.clients).toEqual(clients);
      },
    );
  });

  it('should not clear state when cleared after stopping', async () => {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL: 'ws://localhost', messageSaving: { enabled: true } },
      async ({ interceptor, handler, sender, receiver, handleMessage }) => {
        const effectStarted = Promise.withResolvers<void>();
        const effectRelease = Promise.withResolvers<void>();

        handler.effect(async (message) => {
          if (message.type === 'create' && message.body.text === 'pending') {
            effectStarted.resolve();
            await effectRelease.promise;
          }
        });
        handler.respond({ type: 'delete', id: '1' });
        await handleMessage({ type: 'create', body: { text: 'saved' } });

        const handlerMessages = [...handler.messages];
        const clients = [...interceptor.clients];
        const pendingMessage = handleMessage({ type: 'create', body: { text: 'pending' } });
        await effectStarted.promise;
        await interceptor.implementation.stop();

        try {
          if (type === 'local') {
            expect(() => interceptor.clear()).toThrow(NotRunningWebSocketInterceptorError);
          } else {
            await expect(interceptor.clear()).rejects.toThrow(NotRunningWebSocketInterceptorError);
          }
        } finally {
          interceptor.implementation.isRunning = true;
          effectRelease.resolve();
        }

        await pendingMessage;

        expect(interceptor.implementation.messageStore.size).toBe(2);
        expect(handler.messages).toHaveLength(2);
        expect(handler.messages[0]).toBe(handlerMessages[0]);
        expect(handler.messages[1].data).toEqual({ type: 'create', body: { text: 'pending' } });
        expect(sender.handle.messages).toHaveLength(2);
        expect(receiver.messages).toHaveLength(2);
        expect(interceptor.clients).toEqual(clients);
      },
    );
  });

  it('should not save intercepted messages after cleared while a message is being handled', async () => {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL: 'ws://localhost', messageSaving: { enabled: true } },
      async ({ interceptor, handler, sender, receiver, handleMessage }) => {
        const effectStarted = Promise.withResolvers<void>();
        const effectRelease = Promise.withResolvers<void>();

        handler.effect(async (message) => {
          if (message.type === 'create' && message.body.text === 'pending') {
            effectStarted.resolve();
            await effectRelease.promise;
          }
        });

        await handleMessage({ type: 'create', body: { text: 'existing' } });
        const handlerMessages = handler.messages;
        const senderMessages = sender.handle.messages;
        const receiverMessages = receiver.messages;
        const messagePromise = handleMessage({ type: 'create', body: { text: 'pending' } });
        await effectStarted.promise;
        expect(handlerMessages).toHaveLength(1);
        expect(senderMessages).toHaveLength(1);
        expect(receiverMessages).toHaveLength(1);
        await interceptor.clear();
        effectRelease.resolve();
        await messagePromise;

        expect(handler.messages).toBe(handlerMessages);
        expect(handlerMessages).toEqual([]);
        expect(sender.handle.messages).toBe(senderMessages);
        expect(senderMessages).toEqual([]);
        expect(receiver.messages).toBe(receiverMessages);
        expect(receiverMessages).toEqual([]);
      },
    );
  });
}
