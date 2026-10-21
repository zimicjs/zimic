import { waitFor } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { describe, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import {
  createBinaryMessage,
  readBytes,
  usingWebSocketClient,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import type { Schema } from '../../../messageHandler/__tests__/shared/utils';
import type { WebSocketInterceptorType } from '../../types/options';

type BinarySchema = WebSocketSchema<ArrayBuffer | Blob>;

interface SharedWebSocketInterceptorResponseActionsTestOptions {
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
}

export function declareResponseActionsWebSocketInterceptorTests(
  options: SharedWebSocketInterceptorResponseActionsTestOptions,
) {
  const { type, getBaseURL } = options;

  describe('Responses', () => {
    it('should send static responses', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().respond({ type: 'delete', id: '1' });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const response = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));
        });
      });
    });

    it('should send computed responses', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const responseFactory = vi.fn((message: Schema) => ({ type: 'delete' as const, id: message.type }));

        await interceptor.message().respond(responseFactory);

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const response = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'create' }));
          expect(responseFactory).toHaveBeenCalledTimes(1);
        });
      });
    });

    it('should log response callback errors and keep handling later messages', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const error = new Error('Response failed.');

        await interceptor
          .message()
          .with({ type: 'create' })
          .respond(() => {
            throw error;
          });

        await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: '2' });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          await usingIgnoredConsole(['error'], async (console) => {
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitFor(() => {
              expect(console.error).toHaveBeenCalledWith(error);
            });
          });

          const response = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'delete', id: '1' }));

          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '2' }));
        });
      });
    });

    it('should give later handlers priority and skip exhausted handlers', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const firstHandler = await interceptor.message().respond({ type: 'delete', id: 'first' }).times(1);
        const secondHandler = await interceptor.message().respond({ type: 'delete', id: 'second' }).times(1);

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const firstResponse = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));

          await expect(firstResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'second' }));

          const secondResponse = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));

          await expect(secondResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'first' }));

          await firstHandler.checkTimes();
          await secondHandler.checkTimes();
        });
      });
    });

    it('should passively handle messages without sending a response', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const passiveHandler = await interceptor.message().with({ type: 'create' }).times(1);
          await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const firstReceivedMessage = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitFor(() => {
              expect(passiveHandler.messages).toHaveLength(1);
            });

            // Messages on a socket are delivered in order, so the probe response arriving first means that handling the
            // passive message sent nothing.
            client.send(JSON.stringify({ type: 'delete', id: '1' }));

            await expect(firstReceivedMessage).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));

            await passiveHandler.checkTimes();
          });
        },
      );
    });

    it.each([
      ['ArrayBuffer', () => createBinaryMessage(0xff, 0x00)],
      ['Blob', () => new Blob([createBinaryMessage(0xff, 0x00)])],
    ])('should support %s binary messages', async (_name, createRequestMessage) => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<BinarySchema>({ type, baseURL }, async (interceptor) => {
        await interceptor
          .message()
          .with(createBinaryMessage(0xff, 0x00))
          .respond(createBinaryMessage(0x00, 0xff))
          .times(1);

        await usingWebSocketClient<BinarySchema>(baseURL, async (client) => {
          client.binaryType = 'arraybuffer';

          const response = waitForWebSocketClientMessage(client);

          client.send(createRequestMessage());

          expect(await readBytes((await response) as Blob | ArrayBuffer)).toEqual([0x00, 0xff]);
        });

        await interceptor.checkTimes();
      });
    });
  });

  describe('Effects', () => {
    it('should run side effects without responses', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const effect = vi.fn();

        await interceptor.message().effect(effect);
        await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const firstReceivedMessage = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitFor(() => {
            expect(effect).toHaveBeenCalledTimes(1);
          });

          // Messages on a socket are delivered in order, so the probe response arriving first means that running the
          // effect sent nothing.
          client.send(JSON.stringify({ type: 'delete', id: '1' }));

          await expect(firstReceivedMessage).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));
          expect(effect).toHaveBeenCalledTimes(1);
        });
      });
    });

    it('should allow effects to send targeted messages through the sender', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().effect((message, { sender }) => {
          sender.send(JSON.stringify({ type: 'delete', id: message.type }));
        });

        await usingWebSocketClient<Schema>(baseURL, async (otherClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          await usingWebSocketClient<Schema>(baseURL, async (senderClient) => {
            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(2);
            });

            const otherFirstMessage = waitForWebSocketClientMessage(otherClient);
            const senderFirstMessage = waitForWebSocketClientMessage(senderClient);

            senderClient.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await expect(senderFirstMessage).resolves.toBe(JSON.stringify({ type: 'delete', id: 'create' }));

            // Messages on a socket are delivered in order, so the broadcast being the first message of the other client
            // means that the targeted message did not reach it.
            interceptor.server.send(JSON.stringify({ type: 'delete', id: 'broadcast' }));

            await expect(otherFirstMessage).resolves.toBe(JSON.stringify({ type: 'delete', id: 'broadcast' }));
          });
        });
      });
    });

    it('should allow effects to broadcast through the receiver', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().effect((message, { receiver }) => {
          receiver.send(JSON.stringify({ type: 'delete', id: message.type }));
        });

        await usingWebSocketClient<Schema>(baseURL, async (otherClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          await usingWebSocketClient<Schema>(baseURL, async (senderClient) => {
            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(2);
            });

            const otherFirstMessage = waitForWebSocketClientMessage(otherClient);
            const senderFirstMessage = waitForWebSocketClientMessage(senderClient);

            senderClient.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            const broadcast = JSON.stringify({ type: 'delete', id: 'create' });

            await expect(otherFirstMessage).resolves.toBe(broadcast);
            await expect(senderFirstMessage).resolves.toBe(broadcast);
          });
        });
      });
    });

    it('should log effect callback errors and keep handling later messages', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const error = new Error('Effect failed.');

        await interceptor
          .message()
          .with({ type: 'create' })
          .effect(() => {
            throw error;
          });

        await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: '2' });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          await usingIgnoredConsole(['error'], async (console) => {
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitFor(() => {
              expect(console.error).toHaveBeenCalledWith(error);
            });
          });

          const response = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'delete', id: '1' }));

          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '2' }));
        });
      });
    });

    it('should handle asynchronous effects concurrently', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const startedMessages: Schema[] = [];
        const completedMessages: Schema[] = [];
        const finishEffects: (() => void)[] = [];

        await interceptor.message().effect(async (message) => {
          startedMessages.push(message);

          await new Promise<void>((resolve) => {
            finishEffects.push(resolve);
          });

          completedMessages.push(message);
        });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          client.send(JSON.stringify({ type: 'create', body: { text: 'first' } }));
          client.send(JSON.stringify({ type: 'create', body: { text: 'second' } }));

          await waitFor(() => {
            expect(startedMessages).toEqual([
              { type: 'create', body: { text: 'first' } },
              { type: 'create', body: { text: 'second' } },
            ]);
          });

          for (const finish of finishEffects) {
            finish();
          }

          await waitFor(() => {
            expect(completedMessages).toHaveLength(2);
          });

          expect(completedMessages).toEqual(
            expect.arrayContaining([
              { type: 'create', body: { text: 'first' } },
              { type: 'create', body: { text: 'second' } },
            ]),
          );
        });
      });
    });
  });
}
