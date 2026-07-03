import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import MessageSavingSafeLimitExceededError from '../../../interceptor/errors/MessageSavingSafeLimitExceededError';
import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import DisabledMessageSavingError from '../../errors/DisabledMessageSavingError';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { createBinaryMessage, readBytes, usingWebSocketClient, waitForWebSocketMessage } from './utils';

type BinarySchema = WebSocketSchema<ArrayBuffer>;

export function declareActionWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
  },
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
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }), interceptor);

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });
        });
      });
    });

    it('should send computed responses', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const responseFactory = vi.fn((message: Schema) => ({ type: 'delete' as const, id: message.type }));

        await promiseIfRemote(interceptor.message().respond(responseFactory), interceptor);

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: 'create' });
        });

        expect(responseFactory).toHaveBeenCalledTimes(1);
      });
    });

    it('should log response callback errors and leave sockets usable', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const error = new Error('Response failed.');

        await promiseIfRemote(
          interceptor
            .message()
            .with({ type: 'create' })
            .respond(() => {
              throw error;
            }),
          interceptor,
        );
        await promiseIfRemote(
          interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: '2' }),
          interceptor,
        );

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          await usingIgnoredConsole(['error'], async (console) => {
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitFor(() => {
              expect(console.error).toHaveBeenCalledWith(error);
            });

            const messagePromise = waitForWebSocketMessage(client);
            client.send(JSON.stringify({ type: 'delete', id: '1' }));

            await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '2' });
          });
        });
      });
    });

    it('should give later handlers priority and skip exhausted handlers', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const firstHandler = await promiseIfRemote(
          interceptor.message().respond({ type: 'delete', id: 'first' }).times(1),
          interceptor,
        );
        const secondHandler = await promiseIfRemote(
          interceptor.message().respond({ type: 'delete', id: 'second' }).times(1),
          interceptor,
        );

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          let messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: 'second' });

          messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));
          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: 'first' });
        });

        await firstHandler.checkTimes();
        await secondHandler.checkTimes();
      });
    });

    it('should passively handle messages without sending a response', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await promiseIfRemote(interceptor.message().with({ type: 'create' }).times(1), interceptor);

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const messageListener = vi.fn();
            client.addEventListener('message', messageListener);

            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitFor(() => {
              expect(handler.messages).toHaveLength(1);
            });
            await waitForNot(() => {
              expect(messageListener).toHaveBeenCalled();
            });
          });

          await handler.checkTimes();
        },
      );
    });
  });

  describe('Effects', () => {
    it('should run side effects without responses', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const effect = vi.fn();

        await promiseIfRemote(interceptor.message().effect(effect), interceptor);

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const messageListener = vi.fn();
          client.addEventListener('message', messageListener);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitFor(() => {
            expect(effect).toHaveBeenCalledTimes(1);
          });
          await waitForNot(() => {
            expect(messageListener).toHaveBeenCalled();
          });
        });
      });
    });

    it('should allow effects to send targeted messages through the sender', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await promiseIfRemote(
          interceptor.message().effect((message, { sender }) => {
            sender.send(JSON.stringify({ type: 'delete', id: message.type }));
          }),
          interceptor,
        );

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: 'create' });
        });
      });
    });

    it('should allow effects to broadcast through the receiver', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await promiseIfRemote(
          interceptor.message().effect((message, { receiver }) => {
            receiver.send(JSON.stringify({ type: 'delete', id: message.type }));
          }),
          interceptor,
        );

        await usingWebSocketClient<Schema>(baseURL, async (firstClient) => {
          await usingWebSocketClient<Schema>(baseURL, async (secondClient) => {
            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(2);
            });

            const firstMessagePromise = waitForWebSocketMessage(firstClient);
            const secondMessagePromise = waitForWebSocketMessage(secondClient);

            firstClient.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await expect(firstMessagePromise).resolves.toEqual({ type: 'delete', id: 'create' });
            await expect(secondMessagePromise).resolves.toEqual({ type: 'delete', id: 'create' });
          });
        });
      });
    });

    it('should log effect callback errors and leave sockets usable', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const error = new Error('Effect failed.');

        await promiseIfRemote(
          interceptor
            .message()
            .with({ type: 'create' })
            .effect(() => {
              throw error;
            }),
          interceptor,
        );
        await promiseIfRemote(
          interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: '2' }),
          interceptor,
        );

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          await usingIgnoredConsole(['error'], async (console) => {
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitFor(() => {
              expect(console.error).toHaveBeenCalledWith(error);
            });

            const messagePromise = waitForWebSocketMessage(client);
            client.send(JSON.stringify({ type: 'delete', id: '1' }));

            await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '2' });
          });
        });
      });
    });

    it('should support binary messages', async () => {
      await usingWebSocketInterceptor<BinarySchema>({ type, baseURL }, async (interceptor) => {
        const requestMessage = createBinaryMessage(0xff, 0x00);
        const responseMessage = createBinaryMessage(0x00, 0xff);

        const handler = await promiseIfRemote(
          interceptor.message().with(requestMessage).respond(responseMessage).times(1),
          interceptor,
        );

        await usingWebSocketClient<BinarySchema>(baseURL, async (client) => {
          client.binaryType = 'arraybuffer';
          const messagePromise = waitForWebSocketMessage(client);

          client.send(requestMessage);

          const message = await messagePromise;
          expect(await readBytes(message as Blob | ArrayBuffer)).toEqual([0x00, 0xff]);
        });

        await handler.checkTimes();
      });
    });
  });

  describe('Message saving', () => {
    it('should save public message shapes when enabled', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'delete', id: '1' }),
            interceptor,
          );

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const messagePromise = waitForWebSocketMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });
            await waitFor(() => {
              expect(handler.messages).toHaveLength(1);
            });

            expect(interceptor.clients[0].messages[0]).toBe(handler.messages[0]);
          });

          expect(handler.messages[0].sender.url).toBe(new URL(baseURL).href);
          expect(handler.messages[0].receiver).toBe(interceptor.server);
          expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });
          expect(interceptor.server.messages[0]).toBe(handler.messages[0]);
        },
      );
    });

    it('should throw when accessing saved messages if message saving is disabled', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }), interceptor);

        expect(() => handler.messages).toThrow(DisabledMessageSavingError);
      });
    });

    it('should warn when saved messages exceed the safe limit and reset after clear', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true, safeLimit: 1 } },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'delete', id: '1' }),
            interceptor,
          );

          await usingIgnoredConsole(['warn'], async (console) => {
            await usingWebSocketClient<Schema>(baseURL, async (client) => {
              let messagePromise = waitForWebSocketMessage(client);
              client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
              await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });

              messagePromise = waitForWebSocketMessage(client);
              client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));
              await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });

              await waitFor(() => {
                expect(handler.messages).toHaveLength(2);
              });
            });

            expect(console.warn).toHaveBeenCalledWith(new MessageSavingSafeLimitExceededError(2, 1));

            await interceptor.clear();
            await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }), interceptor);
            console.warn.mockClear();

            await usingWebSocketClient<Schema>(baseURL, async (client) => {
              const messagePromise = waitForWebSocketMessage(client);
              client.send(JSON.stringify({ type: 'create', body: { text: 'three' } }));
              await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });
            });

            expect(console.warn).not.toHaveBeenCalled();
          });
        },
      );
    });
  });
}
