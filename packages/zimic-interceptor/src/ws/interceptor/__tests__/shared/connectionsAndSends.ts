import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import {
  collectWebSocketClientMessages,
  createBinaryMessage,
  readBytes,
  usingWebSocketClient,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import type { WebSocketInterceptorClient } from '../../types/messages';
import type { WebSocketInterceptorType } from '../../types/options';

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

  it('should track clients when they open and close', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      const clients = interceptor.clients;
      expect(interceptor.clients).toHaveLength(0);

      await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toBe(clients);
          expect(interceptor.clients).toHaveLength(1);
          expect(interceptor.clients[0].url).toBe(client.url);
        });

        await client.close();

        await waitFor(() => {
          expect(interceptor.clients).toBe(clients);
          expect(interceptor.clients).toHaveLength(0);
        });
      });
    });
  });

  it('should accept connections without handlers after started and after cleared', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      const connectionListener = vi.fn<(client: WebSocketInterceptorClient<ChatMessage>) => void>();
      interceptor.on('connection', connectionListener);

      const message = JSON.stringify({ type: 'server', text: 'welcome' } satisfies ChatMessage);

      await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });
        expect(connectionListener).toHaveBeenCalledTimes(1);
        expect(connectionListener).toHaveBeenCalledWith(interceptor.clients[0]);

        const messagePromise = waitForWebSocketClientMessage(client);
        interceptor.server.send(message);
        await expect(messagePromise).resolves.toBe(message);
      });

      await interceptor.clear();
      connectionListener.mockClear();

      await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });
        expect(connectionListener).toHaveBeenCalledTimes(1);
        expect(connectionListener).toHaveBeenCalledWith(interceptor.clients[0]);

        const messagePromise = waitForWebSocketClientMessage(client);
        interceptor.server.send(message);
        await expect(messagePromise).resolves.toBe(message);
      });
    });
  });

  it('should route connections with the same base URL only to the last started interceptor', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (firstInterceptor) => {
      await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (secondInterceptor) => {
        const firstConnectionListener = vi.fn();
        const secondConnectionListener = vi.fn();
        firstInterceptor.on('connection', firstConnectionListener);
        secondInterceptor.on('connection', secondConnectionListener);

        const firstEffect = vi.fn();
        const secondEffect = vi.fn();

        await promiseIfRemote(
          firstInterceptor.message().effect(firstEffect).respond({ type: 'server', text: 'first' }),
          firstInterceptor,
        );
        await promiseIfRemote(
          secondInterceptor.message().effect(secondEffect).respond({ type: 'server', text: 'second' }),
          secondInterceptor,
        );

        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(secondInterceptor.clients).toHaveLength(1);
          });
          expect(secondConnectionListener).toHaveBeenCalledTimes(1);
          expect(secondConnectionListener).toHaveBeenCalledWith(secondInterceptor.clients[0]);

          const messages = collectWebSocketClientMessages(client);
          client.send(JSON.stringify({ type: 'server', text: 'ping' } satisfies ChatMessage));

          await waitFor(() => {
            expect(secondEffect).toHaveBeenCalledTimes(1);
          });

          const marker = JSON.stringify({ type: 'server', text: 'marker' } satisfies ChatMessage);
          secondInterceptor.server.send(marker);

          await waitFor(() => {
            expect(messages).toContain(marker);
          });
          expect(messages).toEqual([JSON.stringify({ type: 'server', text: 'second' } satisfies ChatMessage), marker]);

          expect(firstInterceptor.clients).toHaveLength(0);
          expect(firstConnectionListener).not.toHaveBeenCalled();
          expect(firstEffect).not.toHaveBeenCalled();
        });
      });
    });
  });

  it('should route new connections to the previous interceptor after the last started one stops', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (firstInterceptor) => {
      await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (secondInterceptor) => {
        const firstConnectionListener = vi.fn();
        firstInterceptor.on('connection', firstConnectionListener);

        await promiseIfRemote(firstInterceptor.message().respond({ type: 'server', text: 'first' }), firstInterceptor);
        await promiseIfRemote(
          secondInterceptor.message().respond({ type: 'server', text: 'second' }),
          secondInterceptor,
        );

        await secondInterceptor.stop();

        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(firstInterceptor.clients).toHaveLength(1);
          });
          expect(firstConnectionListener).toHaveBeenCalledTimes(1);
          expect(firstConnectionListener).toHaveBeenCalledWith(firstInterceptor.clients[0]);

          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'server', text: 'ping' } satisfies ChatMessage));

          await expect(messagePromise).resolves.toBe(
            JSON.stringify({ type: 'server', text: 'first' } satisfies ChatMessage),
          );
        });
      });
    });
  });

  it('should keep routing to the last started interceptor after the previous one is cleared', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (firstInterceptor) => {
      await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (secondInterceptor) => {
        const firstConnectionListener = vi.fn();
        const secondConnectionListener = vi.fn();
        firstInterceptor.on('connection', firstConnectionListener);
        secondInterceptor.on('connection', secondConnectionListener);

        await promiseIfRemote(
          secondInterceptor.message().respond({ type: 'server', text: 'second' }),
          secondInterceptor,
        );

        await firstInterceptor.clear();

        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(secondInterceptor.clients).toHaveLength(1);
          });
          expect(secondConnectionListener).toHaveBeenCalledTimes(1);
          expect(secondConnectionListener).toHaveBeenCalledWith(secondInterceptor.clients[0]);

          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'server', text: 'ping' } satisfies ChatMessage));

          await expect(messagePromise).resolves.toBe(
            JSON.stringify({ type: 'server', text: 'second' } satisfies ChatMessage),
          );

          expect(firstInterceptor.clients).toHaveLength(0);
          expect(firstConnectionListener).not.toHaveBeenCalled();
        });
      });
    });
  });

  it('should notify listeners with a connected public client', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      const messageHandledPromise = createPromiseWithResolvers<void>();

      await promiseIfRemote(
        interceptor.message().effect(() => messageHandledPromise.resolve()),
        interceptor,
      );

      const connectedClients: WebSocketInterceptorClient<ChatMessage>[] = [];
      const connectionPromise = createPromiseWithResolvers<void>();

      interceptor.on('connection', (connectedClient) => {
        connectedClients.push(connectedClient);
        connectionPromise.resolve();
      });

      await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
        await connectionPromise;

        expect(connectedClients[0]).toBe(interceptor.clients[0]);

        client.send(JSON.stringify({ type: 'server', text: 'message' } satisfies ChatMessage));
        await messageHandledPromise;

        expect(connectedClients).toHaveLength(1);
      });
    });
  });

  it.each(['on', 'once'] as const)('should skip %s listeners removed during connection delivery', async (method) => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      const removedListener = vi.fn();
      const retainedListener = vi.fn();
      interceptor.once('connection', () => interceptor.off('connection', removedListener));
      interceptor[method]('connection', removedListener);
      interceptor.on('connection', retainedListener);

      await usingWebSocketClient<ChatMessage>(baseURL, async () => {
        await waitFor(() => {
          expect(retainedListener).toHaveBeenCalledWith(interceptor.clients[0]);
        });

        expect(removedListener).not.toHaveBeenCalled();
      });
    });
  });

  it('should allow a connection listener to send an immediate message', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      const client = new WebSocketClient<ChatMessage>(baseURL);
      const messageData = JSON.stringify({ type: 'server', text: 'welcome' } satisfies ChatMessage);
      const receivedMessage = waitForWebSocketClientMessage(client);

      interceptor.once('connection', (connectedClient) => connectedClient.send(messageData));

      try {
        await client.open();
        await expect(receivedMessage).resolves.toBe(messageData);
      } finally {
        await client.close();
      }
    });
  });

  it('should remove a once listener before delivering its event', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      const firstConnectionPromise = createPromiseWithResolvers<void>();
      const secondConnectionPromise = createPromiseWithResolvers<void>();

      let connectionCount = 0;

      function listener(_client: WebSocketInterceptorClient<ChatMessage>) {
        connectionCount++;

        if (connectionCount === 1) {
          interceptor.once('connection', listener);
          firstConnectionPromise.resolve();
        } else {
          secondConnectionPromise.resolve();
        }
      }

      interceptor.once('connection', listener);

      await usingWebSocketClient<ChatMessage>(baseURL, async () => {
        await firstConnectionPromise;

        await usingWebSocketClient<ChatMessage>(baseURL, async () => {
          await secondConnectionPromise;

          expect(connectionCount).toBe(2);
        });
      });
    });
  });

  it('should notify a once listener only for its first connection', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      const firstConnectionPromise = createPromiseWithResolvers<void>();

      let connectionCount = 0;

      interceptor.once('connection', () => {
        connectionCount++;
        firstConnectionPromise.resolve();
      });

      await usingWebSocketClient<ChatMessage>(baseURL, async () => {
        await firstConnectionPromise;

        await usingWebSocketClient<ChatMessage>(baseURL, async () => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          expect(connectionCount).toBe(1);
        });
      });
    });
  });

  it('should preserve listeners through clear and restart until they are removed', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      const connectedClients: WebSocketInterceptorClient<ChatMessage>[] = [];

      function listener(client: WebSocketInterceptorClient<ChatMessage>) {
        connectedClients.push(client);
      }

      interceptor.on('connection', listener);

      await usingWebSocketClient<ChatMessage>(baseURL, async () => {
        await waitFor(() => {
          expect(connectedClients).toHaveLength(1);
        });

        await interceptor.clear();
        await usingWebSocketClient<ChatMessage>(baseURL, async () => {
          await waitFor(() => {
            expect(connectedClients).toHaveLength(2);
          });

          await interceptor.stop();
          await interceptor.start();
          await usingWebSocketClient<ChatMessage>(baseURL, async () => {
            await waitFor(() => {
              expect(connectedClients).toHaveLength(3);
            });

            interceptor.off('connection', listener);
            await interceptor.stop();
            await interceptor.start();
            await usingWebSocketClient<ChatMessage>(baseURL, async () => {
              await waitFor(() => {
                expect(interceptor.clients).toHaveLength(1);
              });

              expect(connectedClients).toHaveLength(3);
            });
          });
        });
      });
    });
  });

  it('should keep connection listeners from rejecting connections when they throw', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      const error = new Error('Connection listener failed.');
      interceptor.on('connection', () => {
        throw error;
      });

      await usingIgnoredConsole(['error'], async (console) => {
        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          await waitFor(() => {
            expect(console.error).toHaveBeenCalledWith(error);
          });

          expect(client.readyState).toBe(WebSocketClient.OPEN);
        });
      });
    });
  });

  it('should send server messages to a single client', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<ChatMessage>(baseURL, async (firstClient) => {
        await usingWebSocketClient<ChatMessage>(baseURL, async (secondClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          const messages = [collectWebSocketClientMessages(firstClient), collectWebSocketClientMessages(secondClient)];

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
      await usingWebSocketClient<ChatMessage>(baseURL, async (firstClient) => {
        await usingWebSocketClient<ChatMessage>(baseURL, async (secondClient) => {
          await usingWebSocketClient<ChatMessage>(baseURL, async (thirdClient) => {
            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(3);
            });

            const messages = [
              collectWebSocketClientMessages(firstClient),
              collectWebSocketClientMessages(secondClient),
              collectWebSocketClientMessages(thirdClient),
            ];

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
      await usingWebSocketClient<ChatMessage>(baseURL, async (firstClient) => {
        await usingWebSocketClient<ChatMessage>(baseURL, async (secondClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          const messages = [collectWebSocketClientMessages(firstClient), collectWebSocketClientMessages(secondClient)];

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
      await usingWebSocketClient<ChatMessage>(baseURL, async (firstClient) => {
        await usingWebSocketClient<ChatMessage>(baseURL, async (secondClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          const firstMessagePromise = waitForWebSocketClientMessage(firstClient);
          const secondMessagePromise = waitForWebSocketClientMessage(secondClient);

          const message: ChatMessage = { type: 'server', text: 'broadcast' };
          interceptor.server.send(JSON.stringify(message));

          await expect(firstMessagePromise).resolves.toBe(JSON.stringify(message));
          await expect(secondMessagePromise).resolves.toBe(JSON.stringify(message));
        });
      });
    });
  });

  it('should broadcast binary server messages to all clients', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<BinaryMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<BinaryMessage>(baseURL, async (firstClient) => {
        await usingWebSocketClient<BinaryMessage>(baseURL, async (secondClient) => {
          firstClient.binaryType = 'arraybuffer';
          secondClient.binaryType = 'arraybuffer';

          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          const firstMessagePromise = waitForWebSocketClientMessage(firstClient);
          const secondMessagePromise = waitForWebSocketClientMessage(secondClient);

          interceptor.server.send(createBinaryMessage(0x00, 0xff));

          expect(await readBytes((await firstMessagePromise) as Blob | ArrayBuffer)).toEqual([0x00, 0xff]);
          expect(await readBytes((await secondMessagePromise) as Blob | ArrayBuffer)).toEqual([0x00, 0xff]);
        });
      });
    });
  });
}
