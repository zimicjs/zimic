import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import type { WebSocketInterceptorClient } from '../../types/messages';
import type { WebSocketInterceptorType } from '../../types/options';

type ChatMessage = WebSocketSchema<{ type: 'server'; text: string }>;

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
      await interceptor.message().effect(() => messageHandled.resolve());

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

  it('should skip a connection listener removed by an earlier listener', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await interceptor.message();

      const client = new WebSocketClient<ChatMessage>(baseURL);
      const removedListener = vi.fn();
      const connection = Promise.withResolvers<void>();
      interceptor.on('connection', () => {
        interceptor.off('connection', removedListener);
      });
      interceptor.on('connection', removedListener);
      interceptor.once('connection', () => connection.resolve());

      try {
        await client.open();
        await connection.promise;

        expect(interceptor.clients).toHaveLength(1);
        expect(removedListener).not.toHaveBeenCalled();
      } finally {
        await client.close();
      }
    });
  });

  it('should allow a connection listener to send an immediate welcome message', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await interceptor.message();

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
      await interceptor.message();

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
      await interceptor.message();

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
        await interceptor.message();
        await clients[0].open();
        await waitFor(() => expect(connectedClients).toHaveLength(1));

        await interceptor.clear();
        await interceptor.message();
        await clients[1].open();
        await waitFor(() => expect(connectedClients).toHaveLength(2));

        await interceptor.stop();
        await interceptor.start();
        await interceptor.message();
        await clients[2].open();
        await waitFor(() => expect(connectedClients).toHaveLength(3));

        interceptor.off('connection', listener);
        await interceptor.stop();
        await interceptor.start();
        await interceptor.message();
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
      await interceptor.message();

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

  it('should target sends to one client or a readonly client list', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await interceptor.message();

      const clients = Array.from({ length: 3 }, () => new WebSocketClient<ChatMessage>(baseURL));
      try {
        for (const [index, client] of clients.entries()) {
          await client.open();
          await waitFor(() => expect(interceptor.clients).toHaveLength(index + 1));
        }

        const [firstClient, secondClient] = interceptor.clients;
        const singleRecipientMessage = JSON.stringify({ type: 'server', text: 'single' } satisfies ChatMessage);
        const listRecipientMessage = JSON.stringify({ type: 'server', text: 'list' } satisfies ChatMessage);
        const broadcastMessage = JSON.stringify({ type: 'server', text: 'broadcast' } satisfies ChatMessage);
        const listRecipients = [firstClient, secondClient] as const;
        const messages: string[][] = [[], [], []];
        const allBroadcastsReceived = Promise.withResolvers<void>();
        let numberOfBroadcastsReceived = 0;

        for (const [index, client] of clients.entries()) {
          client.addEventListener('message', ({ data }) => {
            messages[index].push(data);

            if (data === broadcastMessage) {
              numberOfBroadcastsReceived++;

              if (numberOfBroadcastsReceived === clients.length) {
                allBroadcastsReceived.resolve();
              }
            }
          });
        }

        interceptor.server.send(singleRecipientMessage, { to: secondClient });
        interceptor.server.send(listRecipientMessage, { to: listRecipients });
        interceptor.server.send(broadcastMessage);

        await allBroadcastsReceived.promise;
        expect(messages.map((clientMessages) => clientMessages.sort())).toEqual([
          [listRecipientMessage, broadcastMessage].sort(),
          [singleRecipientMessage, listRecipientMessage, broadcastMessage].sort(),
          [broadcastMessage],
        ]);
      } finally {
        await Promise.all(clients.map((client) => client.close()));
      }
    });
  });

  it('should send to no clients when the recipient list is empty', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await interceptor.message();

      const clients = [new WebSocketClient<ChatMessage>(baseURL), new WebSocketClient<ChatMessage>(baseURL)];
      try {
        for (const [index, client] of clients.entries()) {
          await client.open();
          await waitFor(() => expect(interceptor.clients).toHaveLength(index + 1));
        }

        const emptyRecipientMessage = JSON.stringify({
          type: 'server',
          text: 'empty recipients',
        } satisfies ChatMessage);
        const broadcastMessage = JSON.stringify({ type: 'server', text: 'broadcast' } satisfies ChatMessage);
        const messages: string[][] = [[], []];
        const allBroadcastsReceived = Promise.withResolvers<void>();
        let numberOfBroadcastsReceived = 0;

        for (const [index, client] of clients.entries()) {
          client.addEventListener('message', ({ data }) => {
            messages[index].push(data);
            numberOfBroadcastsReceived++;

            if (numberOfBroadcastsReceived === clients.length) {
              allBroadcastsReceived.resolve();
            }
          });
        }

        interceptor.server.send(emptyRecipientMessage, { to: [] });
        interceptor.server.send(broadcastMessage);

        await allBroadcastsReceived.promise;
        expect(messages).toEqual([[broadcastMessage], [broadcastMessage]]);
      } finally {
        await Promise.all(clients.map((client) => client.close()));
      }
    });
  });
}
