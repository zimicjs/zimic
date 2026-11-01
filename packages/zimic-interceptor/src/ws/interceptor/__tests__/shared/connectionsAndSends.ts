import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { ValidationError } from '@zimic/utils/validation';
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
  waitForWebSocketClientClose,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import type { WebSocketInterceptorClient } from '../../types/messages';
import type { WebSocketInterceptorType } from '../../types/options';
import type { WebSocketInterceptor } from '../../types/public';

type ChatMessage = WebSocketSchema<{ type: 'server'; text: string }>;
type BinaryMessage = WebSocketSchema<ArrayBuffer>;
type BinaryOrTextMessage = WebSocketSchema<Blob | string>;

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

  it('should share connections with the same base URL between running interceptors', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (firstInterceptor) => {
      await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (secondInterceptor) => {
        const firstConnectionListener = vi.fn();
        const secondConnectionListener = vi.fn();
        firstInterceptor.on('connection', firstConnectionListener);
        secondInterceptor.on('connection', secondConnectionListener);

        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(firstInterceptor.clients).toHaveLength(1);
            expect(secondInterceptor.clients).toHaveLength(1);
          });
          expect(firstConnectionListener).toHaveBeenCalledTimes(1);
          expect(firstConnectionListener).toHaveBeenCalledWith(firstInterceptor.clients[0]);
          expect(secondConnectionListener).toHaveBeenCalledTimes(1);
          expect(secondConnectionListener).toHaveBeenCalledWith(secondInterceptor.clients[0]);

          const messages = collectWebSocketClientMessages(client);

          const firstMessage = JSON.stringify({ type: 'server', text: 'first' } satisfies ChatMessage);
          const secondMessage = JSON.stringify({ type: 'server', text: 'second' } satisfies ChatMessage);
          firstInterceptor.server.send(firstMessage);
          secondInterceptor.server.send(secondMessage);

          await waitFor(() => {
            expect(messages).toHaveLength(2);
          });
          expect(messages).toEqual(expect.arrayContaining([firstMessage, secondMessage]));
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

  it.each([
    { firstSuffix: '', lastSuffix: '/', label: 'last with a trailing slash' },
    { firstSuffix: '/', lastSuffix: '', label: 'last without a trailing slash' },
  ])(
    'should handle messages with the last started interceptor if base URLs differ by a trailing slash ($label)',
    async ({ firstSuffix, lastSuffix }) => {
      const baseURL = `${getBaseURL()}/path`;

      await usingWebSocketInterceptor<ChatMessage>(
        { type, baseURL: `${baseURL}${firstSuffix}` },
        async (firstInterceptor) => {
          await usingWebSocketInterceptor<ChatMessage>(
            { type, baseURL: `${baseURL}${lastSuffix}` },
            async (lastInterceptor) => {
              const firstConnectionListener = vi.fn();
              const lastConnectionListener = vi.fn();
              firstInterceptor.on('connection', firstConnectionListener);
              lastInterceptor.on('connection', lastConnectionListener);

              await promiseIfRemote(
                firstInterceptor.message().respond({ type: 'server', text: 'first' }),
                firstInterceptor,
              );
              await promiseIfRemote(
                lastInterceptor.message().respond({ type: 'server', text: 'last' }),
                lastInterceptor,
              );

              // Only a URL with the trailing slash starts with both base URLs.
              await usingWebSocketClient<ChatMessage>(`${baseURL}/`, async (client) => {
                await waitFor(() => {
                  expect(firstInterceptor.clients).toHaveLength(1);
                  expect(lastInterceptor.clients).toHaveLength(1);
                });
                expect(firstConnectionListener).toHaveBeenCalledTimes(1);
                expect(firstConnectionListener).toHaveBeenCalledWith(firstInterceptor.clients[0]);
                expect(lastConnectionListener).toHaveBeenCalledTimes(1);
                expect(lastConnectionListener).toHaveBeenCalledWith(lastInterceptor.clients[0]);

                const messagePromise = waitForWebSocketClientMessage(client);
                client.send(JSON.stringify({ type: 'server', text: 'ping' } satisfies ChatMessage));

                await expect(messagePromise).resolves.toBe(
                  JSON.stringify({ type: 'server', text: 'last' } satisfies ChatMessage),
                );
              });
            },
          );
        },
      );
    },
  );

  it('should not share connections with interceptors started after they open', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (firstInterceptor) => {
      await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, { start: false }, async (secondInterceptor) => {
        const secondConnectionListener = vi.fn();
        secondInterceptor.on('connection', secondConnectionListener);

        await promiseIfRemote(firstInterceptor.message().respond({ type: 'server', text: 'first' }), firstInterceptor);

        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(firstInterceptor.clients).toHaveLength(1);
          });

          await secondInterceptor.start();

          const secondEffect = vi.fn();
          await promiseIfRemote(
            secondInterceptor.message().effect(secondEffect).respond({ type: 'server', text: 'second' }),
            secondInterceptor,
          );

          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'server', text: 'ping' } satisfies ChatMessage));

          await expect(messagePromise).resolves.toBe(
            JSON.stringify({ type: 'server', text: 'first' } satisfies ChatMessage),
          );

          expect(secondInterceptor.clients).toHaveLength(0);
          expect(secondConnectionListener).not.toHaveBeenCalled();
          expect(secondEffect).not.toHaveBeenCalled();
        });
      });
    });
  });

  it.each([
    {
      action: 'cleared',
      release: (interceptor: WebSocketInterceptor<ChatMessage>) => promiseIfRemote(interceptor.clear(), { type }),
    },
    {
      action: 'stopped',
      release: (interceptor: WebSocketInterceptor<ChatMessage>) => interceptor.stop(),
    },
  ])(
    'should not send messages from clients of an interceptor $action while another one shares their connection',
    async ({ release }) => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (firstInterceptor) => {
        await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (secondInterceptor) => {
          const secondConnectedClients: WebSocketInterceptorClient<ChatMessage>[] = [];
          secondInterceptor.on('connection', (connectedClient) => {
            secondConnectedClients.push(connectedClient);
          });

          await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
            await waitFor(() => {
              expect(firstInterceptor.clients).toHaveLength(1);
              expect(secondInterceptor.clients).toHaveLength(1);
            });

            expect(secondConnectedClients).toHaveLength(1);
            const releasedClient = secondConnectedClients[0];

            await release(secondInterceptor);

            expect(secondInterceptor.clients).toHaveLength(0);
            expect(client.readyState).toBe(WebSocketClient.OPEN);

            const messages = collectWebSocketClientMessages(client);

            const releasedMessage = JSON.stringify({ type: 'server', text: 'released' } satisfies ChatMessage);
            const probeMessage = JSON.stringify({ type: 'server', text: 'probe' } satisfies ChatMessage);

            releasedClient.send(releasedMessage);

            // Messages on a socket are delivered in order, so the probe arriving first means that the released client
            // sent nothing.
            firstInterceptor.clients[0].send(probeMessage);

            await waitFor(() => {
              expect(messages).toContain(probeMessage);
            });
            expect(messages).toEqual([probeMessage]);
          });
        });
      });
    },
  );

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

  it('should close clients with a code and reason', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const closeEventPromise = waitForWebSocketClientClose(client);
        interceptor.clients[0].close(4000, 'Closed by the interceptor.');

        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(4000);
        expect(closeEvent.reason).toBe('Closed by the interceptor.');

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(0);
        });
      });
    });
  });

  it('should close clients with no status code if no code is provided', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const closeEventPromise = waitForWebSocketClientClose(client);
        interceptor.clients[0].close();

        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(1005);
        expect(closeEvent.reason).toBe('');

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(0);
        });
      });
    });
  });

  it('should deliver earlier server messages before closing clients', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<BinaryOrTextMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<BinaryOrTextMessage>(baseURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const messages = collectWebSocketClientMessages(client);
        const closeEventPromise = waitForWebSocketClientClose(client);

        interceptor.clients[0].send(new Blob([createBinaryMessage(0x00, 0xff)]));
        interceptor.clients[0].close(1000);

        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(1000);
        expect(messages).toHaveLength(1);
        expect(await readBytes(messages[0] as Blob | ArrayBuffer)).toEqual([0x00, 0xff]);
      });
    });
  });

  it('should remove closed clients from every interceptor holding them', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (firstInterceptor) => {
      await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (secondInterceptor) => {
        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(firstInterceptor.clients).toHaveLength(1);
            expect(secondInterceptor.clients).toHaveLength(1);
          });

          const closeEventPromise = waitForWebSocketClientClose(client);
          firstInterceptor.clients[0].close(1000);

          expect((await closeEventPromise).code).toBe(1000);

          await waitFor(() => {
            expect(firstInterceptor.clients).toHaveLength(0);
            expect(secondInterceptor.clients).toHaveLength(0);
          });
        });
      });
    });
  });

  it('should allow a connection listener to close its client immediately', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      const client = new WebSocketClient<ChatMessage>(baseURL);
      const closeEventPromise = waitForWebSocketClientClose(client);

      interceptor.once('connection', (connectedClient) => connectedClient.close(4000, 'Rejected.'));

      try {
        await client.open();

        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(4000);
        expect(closeEvent.reason).toBe('Rejected.');

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(0);
        });
      } finally {
        await client.close();
      }
    });
  });

  it.each([
    { code: 3000.5, expectedCode: 3000 },
    { code: 3001.5, expectedCode: 3002 },
    { code: 999.6, expectedCode: 1000 },
    { code: 4999.4, expectedCode: 4999 },
  ])('should close clients with code $code rounded to $expectedCode', async ({ code, expectedCode }) => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const closeEventPromise = waitForWebSocketClientClose(client);
        interceptor.clients[0].close(code, 'Rounded.');

        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(expectedCode);
        expect(closeEvent.reason).toBe('Rounded.');
      });
    });
  });

  // Codes are clamped to 0 through 65535 and rounded with ties to even before being checked, so the last five codes
  // become 999, 5000, 0, 0, and 65535.
  it.each([999, 1001, 1005, 2999, 5000, 999.4, 4999.5, Number.NaN, -1, Number.POSITIVE_INFINITY])(
    'should throw an error when closing clients with an invalid code (%s)',
    async (code) => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          expect(() => interceptor.clients[0].close(code)).toThrow(
            expect.objectContaining({ name: 'InvalidAccessError', constructor: DOMException }),
          );

          expect(interceptor.clients).toHaveLength(1);
          expect(client.readyState).toBe(WebSocketClient.OPEN);
        });
      });
    },
  );

  it('should throw an error when closing clients with a reason longer than 123 bytes', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        // 62 two-byte characters, so the reason is short enough in characters but not in UTF-8 bytes.
        const reason = 'é'.repeat(62);

        expect(() => interceptor.clients[0].close(1000, reason)).toThrow(
          expect.objectContaining({ name: 'SyntaxError', constructor: DOMException }),
        );

        expect(interceptor.clients).toHaveLength(1);
        expect(client.readyState).toBe(WebSocketClient.OPEN);
      });
    });
  });

  it('should not affect other clients when closing a client already closed', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<ChatMessage>(baseURL, async (closedClient) => {
        await usingWebSocketClient<ChatMessage>(baseURL, async (openClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          const [closedClientHandle, openClientHandle] = interceptor.clients;

          const closeEventPromise = waitForWebSocketClientClose(closedClient);
          closedClientHandle.close(4000, 'First close.');
          closedClientHandle.close(4001, 'Second close.');

          const closeEvent = await closeEventPromise;
          expect(closeEvent.code).toBe(4000);
          expect(closeEvent.reason).toBe('First close.');

          await waitFor(() => {
            expect(interceptor.clients).toEqual([openClientHandle]);
          });

          closedClientHandle.close(4002, 'Third close.');

          const messages = collectWebSocketClientMessages(openClient);
          const marker = JSON.stringify({ type: 'server', text: 'marker' } satisfies ChatMessage);
          interceptor.server.send(marker);

          await waitFor(() => {
            expect(messages).toEqual([marker]);
          });
          expect(openClient.readyState).toBe(WebSocketClient.OPEN);
          expect(interceptor.clients).toEqual([openClientHandle]);
        });
      });
    });
  });

  it.each([
    {
      action: 'clearing',
      release: async (interceptor: WebSocketInterceptor<ChatMessage>) => {
        await interceptor.clear();
      },
    },
    {
      action: 'restarting',
      release: async (interceptor: WebSocketInterceptor<ChatMessage>) => {
        await interceptor.stop();
        await interceptor.start();
      },
    },
  ])('should not affect other clients when closing a client after $action the interceptor', async ({ release }) => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<ChatMessage>(baseURL, async (releasedClient) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const releasedClientHandle = interceptor.clients[0];

        const closeEventPromise = waitForWebSocketClientClose(releasedClient);
        await release(interceptor);
        await closeEventPromise;

        await usingWebSocketClient<ChatMessage>(baseURL, async (openClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          const openClientHandle = interceptor.clients[0];

          releasedClientHandle.close(4000, 'Released close.');

          const messages = collectWebSocketClientMessages(openClient);
          const marker = JSON.stringify({ type: 'server', text: 'marker' } satisfies ChatMessage);
          interceptor.server.send(marker);

          await waitFor(() => {
            expect(messages).toEqual([marker]);
          });
          expect(openClient.readyState).toBe(WebSocketClient.OPEN);
          expect(interceptor.clients).toEqual([openClientHandle]);
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

  it.each(
    (
      [
        { binaryType: 'blob', receivedMessageType: Blob },
        { binaryType: 'arraybuffer', receivedMessageType: ArrayBuffer },
      ] as const
    ).flatMap(({ binaryType, receivedMessageType }) => [
      {
        dataType: 'Blob',
        createMessage: () => new Blob([createBinaryMessage(0x00, 0xff)]),
        binaryType,
        receivedMessageType,
      },
      {
        dataType: 'ArrayBuffer',
        createMessage: () => createBinaryMessage(0x00, 0xff),
        binaryType,
        receivedMessageType,
      },
      {
        dataType: 'Uint8Array',
        createMessage: () => new Uint8Array([0x01, 0x00, 0xff, 0x01]).subarray(1, 3),
        binaryType,
        receivedMessageType,
      },
    ]),
  )(
    'should deliver $dataType server messages as the $binaryType binary type of clients',
    async ({ createMessage, binaryType, receivedMessageType }) => {
      type BinaryBufferMessage = WebSocketSchema<Blob | BufferSource>;

      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<BinaryBufferMessage>({ type, baseURL }, async (interceptor) => {
        await usingWebSocketClient<BinaryBufferMessage>(baseURL, async (client) => {
          client.binaryType = binaryType;

          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          const messagePromise = waitForWebSocketClientMessage(client);
          interceptor.server.send(createMessage());

          const message = (await messagePromise) as Blob | ArrayBuffer;
          expect(message).toBeInstanceOf(receivedMessageType);
          expect(await readBytes(message)).toEqual([0x00, 0xff]);
        });
      });
    },
  );

  it.each([
    {
      sender: 'server',
      send: (interceptor: WebSocketInterceptor<BinaryOrTextMessage>, data: Blob | string) => {
        interceptor.server.send(data);
      },
    },
    {
      sender: 'client',
      send: (interceptor: WebSocketInterceptor<BinaryOrTextMessage>, data: Blob | string) => {
        interceptor.clients[0].send(data);
      },
    },
  ])('should send $sender messages in call order when a binary message precedes a text message', async ({ send }) => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<BinaryOrTextMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<BinaryOrTextMessage>(baseURL, async (client) => {
        client.binaryType = 'arraybuffer';

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const messages = collectWebSocketClientMessages(client);

        send(interceptor, new Blob([createBinaryMessage(0x00, 0xff)]));
        send(interceptor, 'text');

        await waitFor(() => {
          expect(messages).toHaveLength(2);
        });
        expect(await readBytes(messages[0] as Blob | ArrayBuffer)).toEqual([0x00, 0xff]);
        expect(messages[1]).toBe('text');
      });
    });
  });

  it('should log send errors and keep sending later messages', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<BinaryOrTextMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<BinaryOrTextMessage>(baseURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const messages = collectWebSocketClientMessages(client);

        await usingIgnoredConsole(['error'], async (console) => {
          // Simulates an invalid runtime value, which typed code cannot send.
          interceptor.server.send(undefined as unknown as string);
          interceptor.server.send('valid');

          await waitFor(() => {
            expect(messages).toContain('valid');
          });

          // Remote interceptors serialize messages to send them through the interceptor server, which rejects invalid
          // data. Local interceptors pass the data to the client connection as is.
          if (type === 'remote') {
            expect(messages).toEqual(['valid']);
            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith(
              new ValidationError('WebSocket message data must not be undefined.'),
            );
          } else {
            expect(messages).toHaveLength(2);
            expect(messages[1]).toBe('valid');
            expect(console.error).not.toHaveBeenCalled();
          }
        });
      });
    });
  });

  it('should not reject sends when the interceptor stops right after them', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<BinaryOrTextMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<BinaryOrTextMessage>(baseURL, async () => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        interceptor.server.send(new Blob([createBinaryMessage(0x00, 0xff)]));
        interceptor.clients[0].send('text');

        await interceptor.stop();

        expect(interceptor.isRunning).toBe(false);
      });
    });
  });
}
