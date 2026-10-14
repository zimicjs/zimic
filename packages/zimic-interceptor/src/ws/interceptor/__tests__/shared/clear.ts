import { expect, it } from 'vitest';

import type { Schema } from '../../../messageHandler/__tests__/shared/types';
import { usingDirectWebSocketMessageHandler } from '../../../messageHandler/__tests__/shared/utils';
import { LocalWebSocketMessageHandler } from '../../../messageHandler/LocalWebSocketMessageHandler';
import { RemoteWebSocketMessageHandler } from '../../../messageHandler/RemoteWebSocketMessageHandler';
import type { WebSocketInterceptorType } from '../../types/options';

interface SharedWebSocketInterceptorClearTestsOptions {
  type: WebSocketInterceptorType;
  Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
}

export function declareClearWebSocketInterceptorTests(options: SharedWebSocketInterceptorClearTestsOptions) {
  const { type, Handler } = options;

  // Holding the effect and awaiting the exact dispatch completion shows that no save happens after the clear. A real
  // client cannot observe when the server finishes handling a message, so this uses the direct fixture.
  it('should not save intercepted messages after cleared while a message is being handled', async () => {
    await usingDirectWebSocketMessageHandler<Schema>(
      { type, baseURL: 'ws://localhost', Handler, messageSaving: { enabled: true } },
      async ({ interceptor, handler, handleMessage }) => {
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
        const [senderHandle] = interceptor.clients;
        const senderMessages = senderHandle.messages;
        const receiverMessages = interceptor.server.messages;
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
        expect(senderHandle.messages).toBe(senderMessages);
        expect(senderMessages).toEqual([]);
        expect(interceptor.server.messages).toBe(receiverMessages);
        expect(receiverMessages).toEqual([]);
      },
    );
  });
}
