import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';

import type { WebSocketInterceptorClient } from '../../types/messages';
import type { WebSocketInterceptorType } from '../../types/options';
import { createBinaryMessage, readBytes, usingWebSocketClient, waitForWebSocketMessage } from './utils';

type ChatMessage = WebSocketSchema<{ type: 'server'; text: string }>;
type BinaryMessage = WebSocketSchema<ArrayBuffer>;

interface SharedWebSocketInterceptorConnectionAndSendTestsOptions {
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
}

export function declareConnectionAndSendWebSocketInterceptorTests(
  options: SharedWebSocketInterceptorConnectionAndSendTestsOptions,
) {
  const { type, getBaseURL } = options;

  it('should notify listeners with a connected public client', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      const messageHandled = Promise.withResolvers<void>();
      await promiseIfRemote(
        interceptor.message().effect(() => messageHandled.resolve()),
        interceptor,
      );

      const client = new WebSocketClient<ChatMessage>(baseURL);
      const connectedClients: WebSocketInterceptorClient<ChatMessage>[] = [];
      const connection = Promise.withResolvers<void>();
      interceptor.on('connection', (connectedClient) => {
        connectedClients.push(connectedClient);
        connection.resolve();
      });

      try {
        await client.open();
        await connection.promise;

        expect(connectedClients[0]).toBe(interceptor.clients[0]);

        client.send(JSON.stringify({ type: 'server', text: 'message' } satisfies ChatMessage));
        await messageHandled.promise;

        expect(connectedClients).toHaveLength(1);
      } finally {
        await client.close();
      }
    });
  });

  it.each(['on', 'once'] as const)('should skip %s listeners removed during connection delivery', async (method) => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().effect(vi.fn()), interceptor);

      const client = new WebSocketClient<ChatMessage>(baseURL);
      const removedListener = vi.fn();
      const retainedListener = vi.fn();
      interceptor.once('connection', () => interceptor.off('connection', removedListener));
      interceptor[method]('connection', removedListener);
      interceptor.on('connection', retainedListener);

      try {
        await client.open();
        await waitFor(() => expect(retainedListener).toHaveBeenCalledWith(interceptor.clients[0]));

        expect(removedListener).not.toHaveBeenCalled();
      } finally {
        await client.close();
      }
    });
  });

  it('should allow a connection listener to send an immediate welcome message', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().effect(vi.fn()), interceptor);

      const client = new WebSocketClient<ChatMessage>(baseURL);
      const welcome = JSON.stringify({ type: 'server', text: 'welcome' } satisfies ChatMessage);
      const message = new Promise<WebSocketClient.MessageEvent<ChatMessage>>((resolve) => {
        client.addEventListener('message', resolve, { once: true });
      });
      interceptor.once('connection', (connectedClient) => connectedClient.send(welcome));

      try {
        await client.open();
        await expect(message).resolves.toMatchObject({ data: welcome });
      } finally {
        await client.close();
      }
    });
  });

  it('should remove a once listener before delivering its event', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().effect(vi.fn()), interceptor);

      const clients = [new WebSocketClient<ChatMessage>(baseURL), new WebSocketClient<ChatMessage>(baseURL)];
      const firstConnection = Promise.withResolvers<void>();
      const secondConnection = Promise.withResolvers<void>();
      let connectionCount = 0;
      function listener(_client: WebSocketInterceptorClient<ChatMessage>) {
        connectionCount++;

        if (connectionCount === 1) {
          interceptor.once('connection', listener);
          firstConnection.resolve();
        } else {
          secondConnection.resolve();
        }
      }

      interceptor.once('connection', listener);

      try {
        await clients[0].open();
        await firstConnection.promise;
        await clients[1].open();
        await secondConnection.promise;

        expect(connectionCount).toBe(2);
      } finally {
        await Promise.all(clients.map((client) => client.close()));
      }
    });
  });

  it('should notify a once listener only for its first connection', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().effect(vi.fn()), interceptor);

      const clients = [new WebSocketClient<ChatMessage>(baseURL), new WebSocketClient<ChatMessage>(baseURL)];
      const firstConnection = Promise.withResolvers<void>();
      let connectionCount = 0;
      interceptor.once('connection', () => {
        connectionCount++;
        firstConnection.resolve();
      });

      try {
        await clients[0].open();
        await firstConnection.promise;
        await clients[1].open();
        await waitFor(() => expect(interceptor.clients).toHaveLength(2));

        expect(connectionCount).toBe(1);
      } finally {
        await Promise.all(clients.map((client) => client.close()));
      }
    });
  });

  it('should preserve listeners through clear and restart until they are removed', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      const clients = Array.from({ length: 4 }, () => new WebSocketClient<ChatMessage>(baseURL));
      const connectedClients: WebSocketInterceptorClient<ChatMessage>[] = [];
      function listener(client: WebSocketInterceptorClient<ChatMessage>) {
        connectedClients.push(client);
      }

      interceptor.on('connection', listener);

      try {
        await promiseIfRemote(interceptor.message().effect(vi.fn()), interceptor);
        await clients[0].open();
        await waitFor(() => expect(connectedClients).toHaveLength(1));

        await interceptor.clear();
        await promiseIfRemote(interceptor.message().effect(vi.fn()), interceptor);
        await clients[1].open();
        await waitFor(() => expect(connectedClients).toHaveLength(2));

        await interceptor.stop();
        await interceptor.start();
        await promiseIfRemote(interceptor.message().effect(vi.fn()), interceptor);
        await clients[2].open();
        await waitFor(() => expect(connectedClients).toHaveLength(3));

        interceptor.off('connection', listener);
        await interceptor.stop();
        await interceptor.start();
        await promiseIfRemote(interceptor.message().effect(vi.fn()), interceptor);
        await clients[3].open();
        await waitFor(() => expect(interceptor.clients).toHaveLength(1));

        expect(connectedClients).toHaveLength(3);
      } finally {
        await Promise.all(clients.map((client) => client.close()));
      }
    });
  });

  it('should keep connection listeners from rejecting connections when they throw', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().effect(vi.fn()), interceptor);

      const error = new Error('Connection listener failed.');
      const client = new WebSocketClient<ChatMessage>(baseURL);
      interceptor.on('connection', () => {
        throw error;
      });

      try {
        await usingIgnoredConsole(['error'], async (console) => {
          await client.open();
          await waitFor(() => expect(interceptor.clients).toHaveLength(1));
          await waitFor(() => expect(console.error).toHaveBeenCalledWith(error));

          expect(client.readyState).toBe(WebSocketClient.OPEN);
        });
      } finally {
        await client.close();
      }
    });
  });

  it('should send server messages to a single client', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().effect(vi.fn()), interceptor);

      await usingWebSocketClient<ChatMessage>(baseURL, async (firstClient) => {
        await usingWebSocketClient<ChatMessage>(baseURL, async (secondClient) => {
          await waitFor(() => expect(interceptor.clients).toHaveLength(2));

          const messages: string[][] = [[], []];
          for (const [index, client] of [firstClient, secondClient].entries()) {
            client.addEventListener('message', ({ data }) => {
              messages[index].push(data);
            });
          }

          const message = JSON.stringify({ type: 'server', text: 'single' } satisfies ChatMessage);
          const marker = JSON.stringify({ type: 'server', text: 'marker' } satisfies ChatMessage);

          interceptor.server.send(message, { to: interceptor.clients[1] });
          interceptor.server.send(marker);

          await waitFor(() => {
            for (const clientMessages of messages) {
              expect(clientMessages).toContain(marker);
            }
          });
          expect(messages).toEqual([[marker], [message, marker]]);
        });
      });
    });
  });

  it('should send server messages to a readonly client list', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().effect(vi.fn()), interceptor);

      await usingWebSocketClient<ChatMessage>(baseURL, async (firstClient) => {
        await usingWebSocketClient<ChatMessage>(baseURL, async (secondClient) => {
          await usingWebSocketClient<ChatMessage>(baseURL, async (thirdClient) => {
            await waitFor(() => expect(interceptor.clients).toHaveLength(3));

            const messages: string[][] = [[], [], []];
            for (const [index, client] of [firstClient, secondClient, thirdClient].entries()) {
              client.addEventListener('message', ({ data }) => {
                messages[index].push(data);
              });
            }

            const message = JSON.stringify({ type: 'server', text: 'list' } satisfies ChatMessage);
            const marker = JSON.stringify({ type: 'server', text: 'marker' } satisfies ChatMessage);
            const recipients = [interceptor.clients[0], interceptor.clients[1]] as const;

            interceptor.server.send(message, { to: recipients });
            interceptor.server.send(marker);

            await waitFor(() => {
              for (const clientMessages of messages) {
                expect(clientMessages).toContain(marker);
              }
            });
            expect(messages).toEqual([[message, marker], [message, marker], [marker]]);
          });
        });
      });
    });
  });

  it('should send server messages to no clients when the recipient list is empty', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().effect(vi.fn()), interceptor);

      await usingWebSocketClient<ChatMessage>(baseURL, async (firstClient) => {
        await usingWebSocketClient<ChatMessage>(baseURL, async (secondClient) => {
          await waitFor(() => expect(interceptor.clients).toHaveLength(2));

          const messages: string[][] = [[], []];
          for (const [index, client] of [firstClient, secondClient].entries()) {
            client.addEventListener('message', ({ data }) => {
              messages[index].push(data);
            });
          }

          const message = JSON.stringify({ type: 'server', text: 'empty recipients' } satisfies ChatMessage);
          const marker = JSON.stringify({ type: 'server', text: 'marker' } satisfies ChatMessage);

          interceptor.server.send(message, { to: [] });
          interceptor.server.send(marker);

          await waitFor(() => {
            for (const clientMessages of messages) {
              expect(clientMessages).toContain(marker);
            }
          });
          expect(messages).toEqual([[marker], [marker]]);
        });
      });
    });
  });

  it('should broadcast server messages to all clients', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().effect(vi.fn()), interceptor);

      await usingWebSocketClient<ChatMessage>(baseURL, async (firstClient) => {
        await usingWebSocketClient<ChatMessage>(baseURL, async (secondClient) => {
          await waitFor(() => expect(interceptor.clients).toHaveLength(2));

          const firstMessagePromise = waitForWebSocketMessage(firstClient);
          const secondMessagePromise = waitForWebSocketMessage(secondClient);

          const message: ChatMessage = { type: 'server', text: 'broadcast' };
          interceptor.server.send(JSON.stringify(message));

          await expect(firstMessagePromise).resolves.toEqual(message);
          await expect(secondMessagePromise).resolves.toEqual(message);
        });
      });
    });
  });

  it('should broadcast binary server messages to all clients', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<BinaryMessage>({ type, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().effect(vi.fn()), interceptor);

      await usingWebSocketClient<BinaryMessage>(baseURL, async (firstClient) => {
        await usingWebSocketClient<BinaryMessage>(baseURL, async (secondClient) => {
          firstClient.binaryType = 'arraybuffer';
          secondClient.binaryType = 'arraybuffer';

          await waitFor(() => expect(interceptor.clients).toHaveLength(2));

          const firstMessagePromise = waitForWebSocketMessage(firstClient);
          const secondMessagePromise = waitForWebSocketMessage(secondClient);

          interceptor.server.send(createBinaryMessage(0x00, 0xff));

          expect(await readBytes((await firstMessagePromise) as Blob | ArrayBuffer)).toEqual([0x00, 0xff]);
          expect(await readBytes((await secondMessagePromise) as Blob | ArrayBuffer)).toEqual([0x00, 0xff]);
        });
      });
    });
  });
}
