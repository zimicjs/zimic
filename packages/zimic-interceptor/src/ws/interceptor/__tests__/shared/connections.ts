import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { describe, expect, it, vi } from 'vitest';

import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import {
  collectWebSocketClientMessages,
  createBinaryMessage,
  expectWebSocketConnectionToBeRefused,
  expectWebSocketConnectionToOpen,
  openWebSocketUntilSettled,
  readBytes,
  usingWebSocketClient,
  waitForWebSocketClientClose,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import type { WebSocketInterceptorType } from '../../types/options';
import type { LocalWebSocketInterceptor, RemoteWebSocketInterceptor, WebSocketInterceptor } from '../../types/public';
import { MAX_CLOSE_REASON_BYTE_LENGTH } from '../../WebSocketInterceptorHandle';

type ChatMessage = WebSocketSchema<{ type: 'server'; text: string }>;
type BinaryMessage = WebSocketSchema<ArrayBuffer>;
type BinaryOrTextMessage = WebSocketSchema<Blob | string>;

interface SharedWebSocketInterceptorConnectionsTestsOptions {
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
}

export function declareConnectionsWebSocketInterceptorTests(
  options: SharedWebSocketInterceptorConnectionsTestsOptions,
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

  it.each([
    { requestedProtocols: ['graphql-transport-ws', 'chat'], expectedProtocols: ['graphql-transport-ws', 'chat'] },
    { requestedProtocols: 'chat', expectedProtocols: ['chat'] },
    { requestedProtocols: [], expectedProtocols: [] },
    { requestedProtocols: undefined, expectedProtocols: [] },
  ])(
    'should expose the subprotocols requested by clients (requested: $requestedProtocols)',
    async ({ requestedProtocols, expectedProtocols }) => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<ChatMessage>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await promiseIfRemote(interceptor.message(), interceptor);

          const client = new WebSocketClient<ChatMessage>(baseURL, requestedProtocols);

          try {
            await client.open();
            expect(client.protocol).toBe(expectedProtocols[0] ?? '');

            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(1);
            });
            expect(interceptor.clients[0].protocols).toEqual(expectedProtocols);

            client.send(JSON.stringify({ type: 'server', text: 'message' } satisfies ChatMessage));

            await waitFor(() => {
              expect(handler.messages).toHaveLength(1);
            });
            expect(handler.messages[0].sender.protocols).toEqual(expectedProtocols);
          } finally {
            await client.close();
          }
        },
      );
    },
  );

  it('should accept connections without handlers after started and after cleared', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      const message = JSON.stringify({ type: 'server', text: 'welcome' } satisfies ChatMessage);

      await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const messagePromise = waitForWebSocketClientMessage(client);
        interceptor.server.send(message);
        await expect(messagePromise).resolves.toBe(message);
      });

      await interceptor.clear();

      await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

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
        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(firstInterceptor.clients).toHaveLength(1);
            expect(secondInterceptor.clients).toHaveLength(1);
          });

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
          await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
            await waitFor(() => {
              expect(firstInterceptor.clients).toHaveLength(1);
              expect(secondInterceptor.clients).toHaveLength(1);
            });

            const releasedClient = secondInterceptor.clients[0];

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

  it.each([
    { initialBinaryType: 'arraybuffer', binaryType: 'blob', receivedMessageType: Blob },
    { initialBinaryType: 'blob', binaryType: 'arraybuffer', receivedMessageType: ArrayBuffer },
  ] as const)(
    'should deliver immediate connection effect messages as the $binaryType binary type set when clients open',
    async ({ initialBinaryType, binaryType, receivedMessageType }) => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<BinaryMessage>({ type, baseURL }, async (interceptor) => {
        await promiseIfRemote(
          interceptor.connection().effect((connectedClient) => connectedClient.send(createBinaryMessage(0x00, 0xff))),
          interceptor,
        );

        // A `WebSocketClient` exposes its socket only after opening, so its open listeners cannot change the binary type
        // of the socket.
        const socket = new WebSocket(baseURL);
        socket.binaryType = initialBinaryType;

        socket.addEventListener(
          'open',
          () => {
            socket.binaryType = binaryType;
          },
          { once: true },
        );

        const receivedMessage = new Promise<Blob | ArrayBuffer>((resolve) => {
          socket.addEventListener('message', (event: MessageEvent<Blob | ArrayBuffer>) => resolve(event.data), {
            once: true,
          });
        });

        try {
          const message = await receivedMessage;
          expect(message).toBeInstanceOf(receivedMessageType);
          expect(await readBytes(message)).toEqual([0x00, 0xff]);
        } finally {
          const closePromise = new Promise((resolve) => {
            socket.addEventListener('close', resolve, { once: true });
          });
          socket.close();
          await closePromise;
        }
      });
    },
  );

  it('should close clients with a code and reason', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const closeEventPromise = waitForWebSocketClientClose(client);

        const closeCode = 4000;
        const closeReason = 'Closed by the interceptor.';

        interceptor.clients[0].close(closeCode, closeReason);

        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(closeCode);
        expect(closeEvent.reason).toBe(closeReason);

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
        expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.NO_STATUS_RECEIVED);
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

        const closeCode = 1000;
        interceptor.clients[0].close(closeCode);

        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(closeCode);
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

          const closeCode = 1000;
          firstInterceptor.clients[0].close(closeCode);

          expect((await closeEventPromise).code).toBe(closeCode);

          await waitFor(() => {
            expect(firstInterceptor.clients).toHaveLength(0);
            expect(secondInterceptor.clients).toHaveLength(0);
          });
        });
      });
    });
  });

  it('should allow a connection effect to close its client immediately', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      const client = new WebSocketClient<ChatMessage>(baseURL);
      const closeEventPromise = waitForWebSocketClientClose(client);

      const closeCode = 4000;
      const closeReason = 'Rejected.';

      await promiseIfRemote(
        interceptor.connection().effect((client) => client.close(closeCode, closeReason)),
        interceptor,
      );

      try {
        await client.open();

        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(closeCode);
        expect(closeEvent.reason).toBe(closeReason);

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

        const closeReason = 'Rounded.';
        interceptor.clients[0].close(code, closeReason);

        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(expectedCode);
        expect(closeEvent.reason).toBe(closeReason);
      });
    });
  });

  // Codes are clamped to 0 through 65535 and rounded with ties to even before being checked.
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

  it(`should throw an error when closing clients with a reason longer than ${MAX_CLOSE_REASON_BYTE_LENGTH} bytes`, async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        // 62 two-byte characters, so the reason is short enough in characters but not in UTF-8 bytes.
        const reason = 'é'.repeat(62);
        expect(new TextEncoder().encode(reason).byteLength).toBeGreaterThan(MAX_CLOSE_REASON_BYTE_LENGTH);

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

  describe('Connection handlers', () => {
    it('should refuse connections rejected by a connection handler before they open', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
        await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }), interceptor);

        const { eventTypes, closeEvent } = await openWebSocketUntilSettled(baseURL);

        expect(eventTypes).toEqual(['error', 'close']);
        expect(closeEvent?.code).toBe(WEB_SOCKET_CLOSE_CODES.ABNORMAL_CLOSURE);

        expect(interceptor.clients).toHaveLength(0);
      });
    });

    it.each([
      { declaration: 'no connection handler', declare: () => undefined },
      {
        declaration: 'a connection handler without a declared response',
        declare: (interceptor: LocalWebSocketInterceptor<ChatMessage> | RemoteWebSocketInterceptor<ChatMessage>) =>
          interceptor.connection().times(1),
      },
    ])('should accept connections matching $declaration', async ({ declare }) => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
        await declare(interceptor);

        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
          expect(client.readyState).toBe(WebSocketClient.OPEN);

          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          const message = JSON.stringify({ type: 'server', text: 'accepted' } satisfies ChatMessage);
          const messagePromise = waitForWebSocketClientMessage(client);
          interceptor.server.send(message);
          await expect(messagePromise).resolves.toBe(message);
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    it('should not deliver server messages sent while a connection is being decided', async () => {
      const baseURL = getBaseURL();

      const restrictionStartedPromise = createPromiseWithResolvers<void>();
      const restrictionReleasedPromise = createPromiseWithResolvers<void>();

      await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
        await promiseIfRemote(
          interceptor.connection().with(async () => {
            restrictionStartedPromise.resolve();
            await restrictionReleasedPromise;
            return true;
          }),
          interceptor,
        );

        const client = new WebSocketClient<ChatMessage>(baseURL);
        const receivedMessages = collectWebSocketClientMessages(client);

        try {
          const openPromise = client.open();
          await restrictionStartedPromise;

          interceptor.server.send(JSON.stringify({ type: 'server', text: 'deciding' } satisfies ChatMessage));
          restrictionReleasedPromise.resolve();

          await openPromise;

          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          // Messages on a socket are delivered in order, so this message being the first one received means that the
          // message sent during the decision did not reach the client.
          const acceptedMessage = JSON.stringify({ type: 'server', text: 'accepted' } satisfies ChatMessage);
          interceptor.server.send(acceptedMessage);

          await waitFor(() => {
            expect(receivedMessages).toEqual([acceptedMessage]);
          });
        } finally {
          await client.close();
        }
      });
    });

    it('should deliver server messages sent by connection effects', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<ChatMessage>({ type, baseURL }, async (interceptor) => {
        const message = JSON.stringify({ type: 'server', text: 'welcome' } satisfies ChatMessage);

        await promiseIfRemote(
          interceptor.connection().effect(() => {
            interceptor.server.send(message);
          }),
          interceptor,
        );

        const client = new WebSocketClient<ChatMessage>(baseURL);
        const receivedMessages = collectWebSocketClientMessages(client);

        try {
          await client.open();

          await waitFor(() => {
            expect(receivedMessages).toEqual([message]);
          });
        } finally {
          await client.close();
        }
      });
    });

    it('should decide connections with the newest matching connection handler only', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<ChatMessage>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const olderHandler = await promiseIfRemote(
            interceptor.connection().respond({ action: 'reject' }),
            interceptor,
          );
          const newerHandler = await promiseIfRemote(interceptor.connection().times(1), interceptor);

          await expectWebSocketConnectionToOpen(baseURL);

          expect(newerHandler.connections).toHaveLength(1);
          expect(olderHandler.connections).toHaveLength(0);

          await promiseIfRemote(newerHandler.clear(), interceptor);

          await expectWebSocketConnectionToBeRefused(baseURL);

          expect(olderHandler.connections).toHaveLength(1);
        },
      );
    });

    it('should decide connections shared by interceptors with the newest connection handler of any of them', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<ChatMessage>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (firstInterceptor) => {
          await usingWebSocketInterceptor<ChatMessage>(
            { type, baseURL, messageSaving: { enabled: true } },
            async (secondInterceptor) => {
              // The handler of the interceptor started last is older, so it does not decide the connection.
              const secondHandler = await promiseIfRemote(
                secondInterceptor.connection().respond({ action: 'reject' }),
                secondInterceptor,
              );
              const firstHandler = await promiseIfRemote(firstInterceptor.connection().times(1), firstInterceptor);

              await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
                expect(client.readyState).toBe(WebSocketClient.OPEN);

                await waitFor(() => {
                  expect(firstInterceptor.clients).toHaveLength(1);
                  expect(secondInterceptor.clients).toHaveLength(1);
                });
              });

              expect(firstHandler.connections).toHaveLength(1);
              expect(secondHandler.connections).toHaveLength(0);

              await promiseIfRemote(firstHandler.clear(), firstInterceptor);

              await expectWebSocketConnectionToBeRefused(baseURL);

              expect(secondHandler.connections).toHaveLength(1);
              expect(firstInterceptor.clients).toHaveLength(0);
              expect(secondInterceptor.clients).toHaveLength(0);
            },
          );
        },
      );
    });
  });
}
