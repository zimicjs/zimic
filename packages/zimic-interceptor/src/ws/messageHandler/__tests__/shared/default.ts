import { waitFor } from '@zimic/utils/time';
import { WebSocketClient } from '@zimic/ws';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';

export function declareDefaultWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & { type: WebSocketInterceptorType },
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
        const effectCompleted = Promise.withResolvers<void>();
        const firstRestriction = vi.fn((_message: Schema) => true);
        const handler = await interceptor
          .message()
          .with(firstRestriction)
          .effect((message) => {
            effectMessage = message;
            effectCompleted.resolve();
          });

        const secondRestriction = vi.fn((_message: Schema) => false);
        await interceptor.message().with(secondRestriction);

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          client.send(JSON.stringify({ type: 'create', body: { text: 'serialized' } }));
          await effectCompleted.promise;
          await waitFor(() => expect(handler.messages).toHaveLength(1));

          expect(firstRestriction).toHaveBeenCalledWith({ type: 'create', body: { text: 'serialized' } });
          expect(secondRestriction).toHaveBeenCalledWith({ type: 'create', body: { text: 'serialized' } });
          expect(effectMessage).toEqual({ type: 'create', body: { text: 'serialized' } });
          expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'serialized' } });
          await handler.checkTimes();
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

          await waitFor(() => expect(handler.messages).toHaveLength(1));
          expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });
          await handler.checkTimes();
        } finally {
          await client.close();
        }
      },
    );
  });

  it('should reset a message handler if cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(1);
        await expect(async () => handler.checkTimes()).rejects.toThrow('Expected exactly 1 message, but got 0.');

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          const responsePromise = new Promise<string>((resolve) => {
            client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
          });
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(responsePromise).resolves.toBe('{"type":"delete","id":"1"}');
          await waitFor(() => expect(handler.messages).toHaveLength(1));
          await handler.checkTimes();

          await handler.clear();
          expect(handler.messages).toHaveLength(0);
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
        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          await waitFor(() => expect(interceptor.clients).toHaveLength(1));
          const responsePromise = new Promise<string>((resolve) => {
            client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
          });
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(responsePromise).resolves.toBe('{"type":"delete","id":"1"}');
          await waitFor(() => expect(handler.messages).toHaveLength(1));

          expect(handler.messages[0].sender).toBe(interceptor.clients[0]);
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
          const responsePromise = new Promise<string>((resolve) => {
            client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
          });
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(responsePromise).resolves.toBe('{"type":"delete","id":"1"}');
          await waitFor(() => expect(handler.messages).toHaveLength(1));

          const handlerMessages = handler.messages;
          expect(handlerMessages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });

          await handler.clear();

          expect(handler.messages).toBe(handlerMessages);
          expect(handler.messages).toEqual([]);
        } finally {
          await client.close();
        }
      },
    );
  });
}
