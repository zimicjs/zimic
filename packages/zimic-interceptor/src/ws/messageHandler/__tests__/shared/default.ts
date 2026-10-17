import { waitFor } from '@zimic/utils/time';
import { WebSocketClient } from '@zimic/ws';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';

export function declareDefaultWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
  },
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

  it('should normalize incoming text messages before matching handlers and saving intercepted messages', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        let effectMessage: Schema | undefined;
        const firstRestriction = vi.fn((_message: Schema) => true);
        const handler = await interceptor
          .message()
          .with(firstRestriction)
          .effect((message) => {
            effectMessage = message;
          });

        const secondRestriction = vi.fn((_message: Schema) => false);
        await interceptor.message().with(secondRestriction);

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          client.send(JSON.stringify({ type: 'create', body: { text: 'serialized' } }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          const normalizedMessage = firstRestriction.mock.calls[0][0];
          expect(normalizedMessage).toEqual({ type: 'create', body: { text: 'serialized' } });
          expect(secondRestriction.mock.calls[0][0]).toBe(normalizedMessage);
          expect(effectMessage).toBe(normalizedMessage);
          expect(handler.messages[0].data).toBe(normalizedMessage);

          expect(interceptor.clients[0].messages).toHaveLength(1);
          expect(interceptor.server.messages).toHaveLength(1);
        } finally {
          await client.close();
        }
      },
    );
  });

  it('should match any message without a declared response, effect, or restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor.message().times(1);

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });

          await handler.checkTimes();
        } finally {
          await client.close();
        }
      },
    );
  });

  it('should keep track of intercepted messages', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' });

        expect(handler.messages).toEqual([]);

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          const response = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          expect(handler.messages[0].sender).toBe(interceptor.clients[0]);
          expect(handler.messages[0].sender.url).toBe(client.url);
          expect(handler.messages[0].receiver).toBe(interceptor.server);
          expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });
        } finally {
          await client.close();
        }
      },
    );
  });

  it('should clear intercepted messages in place after cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' });

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          const response = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
          await response;

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          const [senderHandle] = interceptor.clients;
          const handlerMessages = handler.messages;
          const senderMessages = senderHandle.messages;
          const receiverMessages = interceptor.server.messages;

          expect(handlerMessages).toHaveLength(1);
          expect(senderMessages).toHaveLength(1);
          expect(receiverMessages).toHaveLength(1);

          handler.clear();

          expect(handler.messages).toBe(handlerMessages);
          expect(handler.messages).toHaveLength(0);
          expect(senderHandle.messages).toBe(senderMessages);
          expect(senderHandle.messages).toHaveLength(0);
          expect(interceptor.server.messages).toBe(receiverMessages);
          expect(interceptor.server.messages).toHaveLength(0);
        } finally {
          await client.close();
        }
      },
    );
  });
}
