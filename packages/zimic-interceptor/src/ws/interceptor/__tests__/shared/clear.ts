import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { expect, it } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import type { WebSocketInterceptorType } from '../../types/options';

type ChatMessage = WebSocketSchema<{ type: 'client'; text: string } | { type: 'server'; text: string }>;

interface SharedWebSocketInterceptorClearTestsOptions {
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
}

export function declareClearWebSocketInterceptorTests(options: SharedWebSocketInterceptorClearTestsOptions) {
  const { type, getBaseURL } = options;

  it('should not save intercepted messages after cleared while a message is being handled', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const effectStartedPromise = createPromiseWithResolvers<void>();
        const effectReleasePromise = createPromiseWithResolvers<void>();

        const handler = await interceptor
          .message()
          .effect(async (message) => {
            if (message.type === 'client' && message.text === 'pending') {
              effectStartedPromise.resolve();
              await effectReleasePromise;
            }
          })
          .respond({ type: 'server', text: 'ack' });

        const client = new WebSocketClient<ChatMessage>(baseURL);

        try {
          await client.open();

          const existingResponsePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', text: 'existing' }));
          await expect(existingResponsePromise).resolves.toBe('{"type":"server","text":"ack"}');

          const handlerMessages = handler.messages;
          const serverMessages = interceptor.server.messages;
          const [clientHandle] = interceptor.clients;
          const clientMessages = clientHandle.messages;

          expect(handlerMessages).toHaveLength(1);
          expect(serverMessages).toHaveLength(1);
          expect(clientMessages).toHaveLength(1);

          client.send(JSON.stringify({ type: 'client', text: 'pending' }));
          await effectStartedPromise;

          await interceptor.clear();

          const nextHandler = await interceptor.message().respond({ type: 'server', text: 'next' });

          effectReleasePromise.resolve();

          // Clearing closes the connected clients, so the follow-up message is sent by a new client.
          const nextClient = new WebSocketClient<ChatMessage>(baseURL);

          try {
            await nextClient.open();

            const nextResponsePromise = waitForWebSocketClientMessage(nextClient);
            nextClient.send(JSON.stringify({ type: 'client', text: 'next' }));
            await expect(nextResponsePromise).resolves.toBe('{"type":"server","text":"next"}');
          } finally {
            await nextClient.close();
          }

          await waitFor(() => {
            expect(nextHandler.messages).toHaveLength(1);
          });

          expect(handler.messages).toBe(handlerMessages);
          expect(handlerMessages).toEqual([]);

          expect(interceptor.server.messages).toBe(serverMessages);
          expect(serverMessages).toHaveLength(1);
          expect(serverMessages[0].data).toEqual({ type: 'client', text: 'next' });

          expect(clientHandle.messages).toBe(clientMessages);
          expect(clientMessages).toEqual([]);
        } finally {
          await client.close();
        }
      },
    );
  });
}
