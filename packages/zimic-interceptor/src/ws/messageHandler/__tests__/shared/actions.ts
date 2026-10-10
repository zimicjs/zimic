import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { createBinaryMessage, readBytes, usingDirectWebSocketMessageHandler } from './utils';

type BinarySchema = WebSocketSchema<ArrayBuffer>;

export function declareActionWebSocketMessageHandlerTests(
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

  describe('Responses', () => {
    it('should send static responses', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().respond({ type: 'delete', id: '1' });
        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          const responsePromise = new Promise<string>((resolve) => {
            client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
          });
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(responsePromise).resolves.toBe('{"type":"delete","id":"1"}');
        } finally {
          await client.close();
        }
      });
    });

    it('should send computed responses', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const responseFactory = vi.fn((message: Schema) => ({ type: 'delete' as const, id: message.type }));
        await interceptor.message().respond(responseFactory);
        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          const responsePromise = new Promise<string>((resolve) => {
            client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
          });
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(responsePromise).resolves.toBe('{"type":"delete","id":"create"}');
          expect(responseFactory.mock.calls[0]?.[0]).toEqual({ type: 'create', body: { text: 'hello' } });
        } finally {
          await client.close();
        }
      });
    });

    it('should reject response callback errors and leave later messages usable', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL },
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
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const firstHandler = await interceptor.message().respond({ type: 'delete', id: 'first' }).times(1);
        const secondHandler = await interceptor.message().respond({ type: 'delete', id: 'second' }).times(1);
        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          const responseMessages: string[] = [];
          const bothResponses = Promise.withResolvers<void>();
          client.addEventListener('message', ({ data }) => {
            responseMessages.push(String(data));
            if (responseMessages.length === 2) {
              bothResponses.resolve();
            }
          });
          client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
          client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));

          await bothResponses.promise;
          expect(responseMessages).toEqual(['{"type":"delete","id":"second"}', '{"type":"delete","id":"first"}']);

          await firstHandler.checkTimes();
          await secondHandler.checkTimes();
        } finally {
          await client.close();
        }
      });
    });

    it('should passively handle messages without sending a response', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.message().with({ type: 'create' }).times(1);
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
  });

  describe('Effects', () => {
    it('should run side effects without responses', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const effect = vi.fn();
        const effectCompleted = Promise.withResolvers<void>();
        const handler = await interceptor
          .message()
          .effect((message) => {
            effect(message);
            effectCompleted.resolve();
          })
          .times(1);
        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
          await effectCompleted.promise;

          expect(effect.mock.calls[0]?.[0]).toEqual({ type: 'create', body: { text: 'hello' } });
          await handler.checkTimes();
        } finally {
          await client.close();
        }
      });
    });

    it('should allow effects to send targeted messages through the sender', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().effect((message, { sender }) => {
          sender.send(JSON.stringify({ type: 'delete', id: message.type }));
        });
        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          const responsePromise = new Promise<string>((resolve) => {
            client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
          });
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(responsePromise).resolves.toBe('{"type":"delete","id":"create"}');
        } finally {
          await client.close();
        }
      });
    });

    it('should allow effects to broadcast through the receiver', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().effect((message, { receiver }) => {
          receiver.send(JSON.stringify({ type: 'delete', id: message.type }));
        });
        const clients = [new WebSocketClient<Schema>(baseURL), new WebSocketClient<Schema>(baseURL)];

        try {
          await Promise.all(clients.map((client) => client.open()));
          await waitFor(() => expect(interceptor.clients).toHaveLength(2));
          const responsePromises = clients.map(
            (client) =>
              new Promise<string>((resolve) => {
                client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
              }),
          );
          clients[0].send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(Promise.all(responsePromises)).resolves.toEqual([
            '{"type":"delete","id":"create"}',
            '{"type":"delete","id":"create"}',
          ]);
        } finally {
          await Promise.all(clients.map((client) => client.close()));
        }
      });
    });

    it('should reject effect callback errors and leave later messages usable', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL },
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
    await usingWebSocketInterceptor<BinarySchema>({ type, baseURL }, async (interceptor) => {
      const response = createBinaryMessage(1, 2);
      const handler = await interceptor.message().respond(response).times(1);
      const client = new WebSocketClient<BinarySchema>(baseURL);
      client.binaryType = 'arraybuffer';

      try {
        await client.open();
        const responsePromise = new Promise<WebSocketClient.MessageEvent<BinarySchema>>((resolve) => {
          client.addEventListener('message', resolve, { once: true });
        });
        client.send(createBinaryMessage(3, 4));

        const responseEvent = await responsePromise;
        expect(await readBytes(responseEvent.data as Blob | ArrayBuffer)).toEqual([1, 2]);
        await handler.checkTimes();
      } finally {
        await client.close();
      }
    });
  });
}
