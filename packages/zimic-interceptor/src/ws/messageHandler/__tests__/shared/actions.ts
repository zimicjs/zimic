import { waitFor } from '@zimic/utils/time';
import { WebSocketClient } from '@zimic/ws';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { usingDirectWebSocketMessageHandler } from './utils';

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
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().respond({ type: 'delete', id: '1' });

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          const response = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
            client.addEventListener('message', resolve, { once: true });
          });

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(response).resolves.toMatchObject({ data: JSON.stringify({ type: 'delete', id: '1' }) });
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

          const response = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
            client.addEventListener('message', resolve, { once: true });
          });

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(response).resolves.toMatchObject({ data: JSON.stringify({ type: 'delete', id: 'create' }) });
          expect(responseFactory).toHaveBeenCalledTimes(1);
        } finally {
          await client.close();
        }
      });
    });

    // The worker logs a failing response callback instead of exposing it to the client, so only a direct dispatch can
    // observe the rejection.
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
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const firstHandler = await interceptor.message().respond({ type: 'delete', id: 'first' }).times(1);
        const secondHandler = await interceptor.message().respond({ type: 'delete', id: 'second' }).times(1);

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          const firstResponse = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
            client.addEventListener('message', resolve, { once: true });
          });

          client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));

          await expect(firstResponse).resolves.toMatchObject({
            data: JSON.stringify({ type: 'delete', id: 'second' }),
          });

          const secondResponse = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
            client.addEventListener('message', resolve, { once: true });
          });

          client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));

          await expect(secondResponse).resolves.toMatchObject({
            data: JSON.stringify({ type: 'delete', id: 'first' }),
          });

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
          const passiveHandler = await interceptor.message().with({ type: 'create' }).times(1);
          await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

          const client = new WebSocketClient<Schema>(baseURL);

          try {
            await client.open();

            const firstReceivedMessage = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
              client.addEventListener('message', resolve, { once: true });
            });

            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitFor(() => {
              expect(passiveHandler.messages).toHaveLength(1);
            });

            // Messages on a socket are delivered in order, so the probe response arriving first means that handling the
            // passive message sent nothing.
            client.send(JSON.stringify({ type: 'delete', id: '1' }));

            await expect(firstReceivedMessage).resolves.toMatchObject({
              data: JSON.stringify({ type: 'delete', id: 'probe' }),
            });

            await passiveHandler.checkTimes();
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

        await interceptor.message().effect(effect);
        await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          const firstReceivedMessage = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
            client.addEventListener('message', resolve, { once: true });
          });

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitFor(() => {
            expect(effect).toHaveBeenCalledTimes(1);
          });

          // Messages on a socket are delivered in order, so the probe response arriving first means that running the
          // effect sent nothing.
          client.send(JSON.stringify({ type: 'delete', id: '1' }));

          await expect(firstReceivedMessage).resolves.toMatchObject({
            data: JSON.stringify({ type: 'delete', id: 'probe' }),
          });
          expect(effect).toHaveBeenCalledTimes(1);
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

        const otherClient = new WebSocketClient<Schema>(baseURL);
        const senderClient = new WebSocketClient<Schema>(baseURL);

        try {
          await otherClient.open();
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          await senderClient.open();
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          const otherFirstMessage = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
            otherClient.addEventListener('message', resolve, { once: true });
          });
          const senderFirstMessage = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
            senderClient.addEventListener('message', resolve, { once: true });
          });

          senderClient.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(senderFirstMessage).resolves.toMatchObject({
            data: JSON.stringify({ type: 'delete', id: 'create' }),
          });

          // Messages on a socket are delivered in order, so the broadcast being the first message of the other client
          // means that the targeted message did not reach it.
          interceptor.server.send(JSON.stringify({ type: 'delete', id: 'broadcast' }));

          await expect(otherFirstMessage).resolves.toMatchObject({
            data: JSON.stringify({ type: 'delete', id: 'broadcast' }),
          });
        } finally {
          await Promise.all([otherClient.close(), senderClient.close()]);
        }
      });
    });

    it('should allow effects to broadcast through the receiver', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().effect((message, { receiver }) => {
          receiver.send(JSON.stringify({ type: 'delete', id: message.type }));
        });

        const otherClient = new WebSocketClient<Schema>(baseURL);
        const senderClient = new WebSocketClient<Schema>(baseURL);

        try {
          await otherClient.open();
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          await senderClient.open();
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          const otherFirstMessage = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
            otherClient.addEventListener('message', resolve, { once: true });
          });
          const senderFirstMessage = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
            senderClient.addEventListener('message', resolve, { once: true });
          });

          senderClient.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          const broadcast = { data: JSON.stringify({ type: 'delete', id: 'create' }) };
          await expect(otherFirstMessage).resolves.toMatchObject(broadcast);
          await expect(senderFirstMessage).resolves.toMatchObject(broadcast);
        } finally {
          await Promise.all([otherClient.close(), senderClient.close()]);
        }
      });
    });

    // The worker logs a failing effect callback instead of exposing it to the client, so only a direct dispatch can
    // observe the rejection.
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
}
