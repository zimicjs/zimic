import { expect, it } from 'vitest';

import type { Schema } from '../../../messageHandler/__tests__/shared/types';
import { usingDirectWebSocketMessageHandler } from '../../../messageHandler/__tests__/shared/utils';
import { LocalWebSocketMessageHandler } from '../../../messageHandler/LocalWebSocketMessageHandler';
import { RemoteWebSocketMessageHandler } from '../../../messageHandler/RemoteWebSocketMessageHandler';

export function declareWebSocketInterceptorClearTests() {
  it.each([
    { type: 'local', Handler: LocalWebSocketMessageHandler },
    { type: 'remote', Handler: RemoteWebSocketMessageHandler },
  ] as const)('should keep pre-clear dispatches out of all histories ($type)', async ({ type, Handler }) => {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL: 'ws://localhost', Handler, messageSaving: { enabled: true } },
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
