import { waitFor } from '@zimic/utils/time';
import { ValidationError } from '@zimic/utils/validation';
import { WebSocketSchema } from '@zimic/ws';
import { expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import {
  collectWebSocketClientMessages,
  createBinaryMessage,
  readBytes,
  usingWebSocketClient,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import type { WebSocketInterceptorType } from '../../types/options';
import type { WebSocketInterceptor } from '../../types/public';

type ChatMessage = WebSocketSchema<{ type: 'server'; text: string }>;
type BinaryMessage = WebSocketSchema<ArrayBuffer>;
type BinaryOrTextMessage = WebSocketSchema<Blob | string>;

interface SharedWebSocketInterceptorSendsTestsOptions {
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
}

export function declareSendsWebSocketInterceptorTests(options: SharedWebSocketInterceptorSendsTestsOptions) {
  const { type, getBaseURL } = options;

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

  it('should log binary send errors and keep sending later messages', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<BinaryOrTextMessage>({ type, baseURL }, async (interceptor) => {
      await usingWebSocketClient<BinaryOrTextMessage>(baseURL, async (client) => {
        client.binaryType = 'arraybuffer';

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const messages = collectWebSocketClientMessages(client);

        // Reading a blob fails only when its backing data becomes unreadable, such as a file changed on disk, which no
        // portable test can trigger.
        const unreadableBlob = new Blob([createBinaryMessage(0x00, 0xff)]);
        const readError = new DOMException('The blob could not be read.', 'NotReadableError');
        vi.spyOn(unreadableBlob, 'arrayBuffer').mockRejectedValueOnce(readError);

        await usingIgnoredConsole(['error'], async (console) => {
          interceptor.server.send(unreadableBlob);
          interceptor.server.send('valid');

          await waitFor(() => {
            expect(messages).toEqual(['valid']);
          });

          expect(console.error).toHaveBeenCalledTimes(1);
          expect(console.error).toHaveBeenCalledWith(readError);
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
