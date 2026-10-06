import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import DisabledMessageSavingError from '../../../messageHandler/errors/DisabledMessageSavingError';
import MessageSavingSafeLimitExceededError from '../../errors/MessageSavingSafeLimitExceededError';
import type { WebSocketInterceptorType } from '../../types/options';

type ChatMessage = WebSocketSchema<{ type: 'client'; text: string } | { type: 'server'; text: string }>;

interface SharedWebSocketInterceptorMessageSavingTestOptions {
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
}

export function declareMessageSavingWebSocketInterceptorTests(
  options: SharedWebSocketInterceptorMessageSavingTestOptions,
) {
  const { type, getBaseURL } = options;

  let baseURL: string;

  beforeEach(() => {
    baseURL = getBaseURL();
  });

  it('should not save intercepted messages or show a warning if saving is disabled', async () => {
    await usingWebSocketInterceptor<ChatMessage>(
      { type, baseURL, messageSaving: { enabled: false, safeLimit: 1 } },
      async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'server', text: 'ack' });
        const client = new WebSocketClient<ChatMessage>(baseURL);

        try {
          await client.open();

          await usingIgnoredConsole(['warn'], async (console) => {
            for (let index = 0; index < 2; index++) {
              const responsePromise = new Promise<string>((resolve) => {
                client.addEventListener('message', (event) => resolve(String(event.data)), { once: true });
              });

              client.send(JSON.stringify({ type: 'client', text: `message ${index}` }));

              await expect(responsePromise).resolves.toBe('{"type":"server","text":"ack"}');
            }

            expect(() => handler.messages).toThrow(new DisabledMessageSavingError());
            expect(console.warn).not.toHaveBeenCalled();
          });
        } finally {
          await client.close();
        }
      },
    );
  });

  it('should warn with the safe limit error only after saved messages exceed the safe limit', async () => {
    const safeLimit = 2;

    await usingWebSocketInterceptor<ChatMessage>(
      { type, baseURL, messageSaving: { enabled: true, safeLimit } },
      async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'server', text: 'ack' });
        const client = new WebSocketClient<ChatMessage>(baseURL);

        try {
          await client.open();

          await usingIgnoredConsole(['warn'], async (console) => {
            for (let index = 0; index < safeLimit + 1; index++) {
              const responsePromise = new Promise<string>((resolve) => {
                client.addEventListener('message', (event) => resolve(String(event.data)), { once: true });
              });

              client.send(JSON.stringify({ type: 'client', text: `message ${index}` }));

              await expect(responsePromise).resolves.toBe('{"type":"server","text":"ack"}');

              await waitFor(() => {
                expect(handler.messages).toHaveLength(index + 1);
                expect(console.warn).toHaveBeenCalledTimes(index < safeLimit ? 0 : 1);
              });
            }

            expect(console.warn).toHaveBeenCalledWith(
              new MessageSavingSafeLimitExceededError(safeLimit + 1, safeLimit),
            );
          });
        } finally {
          await client.close();
        }
      },
    );
  });

  it('should reset the saved message count and warning threshold after clearing', async () => {
    const safeLimit = 2;

    await usingWebSocketInterceptor<ChatMessage>(
      { type, baseURL, messageSaving: { enabled: true, safeLimit } },
      async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'server', text: 'ack' });
        let client = new WebSocketClient<ChatMessage>(baseURL);

        try {
          await client.open();

          await usingIgnoredConsole(['warn'], async (console) => {
            for (let index = 0; index < safeLimit + 1; index++) {
              const responsePromise = new Promise<string>((resolve) => {
                client.addEventListener('message', (event) => resolve(String(event.data)), { once: true });
              });

              client.send(JSON.stringify({ type: 'client', text: `before clear ${index}` }));
              await responsePromise;
              await waitFor(() => {
                expect(handler.messages).toHaveLength(index + 1);
                expect(console.warn).toHaveBeenCalledTimes(index < safeLimit ? 0 : 1);
              });
            }

            expect(handler.messages).toHaveLength(safeLimit + 1);
            expect(console.warn).toHaveBeenCalledTimes(1);

            await interceptor.clear();
            expect(handler.messages).toHaveLength(0);

            const nextHandler = await interceptor.message().respond({ type: 'server', text: 'ack' });
            await client.close();
            client = new WebSocketClient<ChatMessage>(baseURL);
            await client.open();

            for (let index = 0; index < safeLimit; index++) {
              const responsePromise = new Promise<string>((resolve) => {
                client.addEventListener('message', (event) => resolve(String(event.data)), { once: true });
              });

              client.send(JSON.stringify({ type: 'client', text: `after clear ${index}` }));
              await responsePromise;
            }

            await waitFor(() => {
              expect(nextHandler.messages).toHaveLength(safeLimit);
            });
            expect(console.warn).toHaveBeenCalledTimes(1);
          });
        } finally {
          await client.close();
        }
      },
    );
  });
}
