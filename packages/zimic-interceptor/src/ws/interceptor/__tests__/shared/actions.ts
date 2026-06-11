import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorOptions } from '../../types/options';
import {
  RuntimeSharedWebSocketInterceptorTestsOptions,
  createBinaryMessage,
  readBytes,
  usingWebSocketClient,
  waitForWebSocketMessage,
} from './utils';

type MessageSchema = WebSocketSchema<{ type: 'create'; body: { text: string } } | { type: 'delete'; id: string }>;
type BinarySchema = WebSocketSchema<ArrayBuffer>;

export function declareActionWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  describe('Responses', () => {
    it('should send static responses', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });
        });
      });
    });

    it('should send computed responses', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const responseFactory = vi.fn((message: MessageSchema) => ({ type: 'delete' as const, id: message.type }));

        await promiseIfRemote(interceptor.message().respond(responseFactory), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: 'create' });
        });

        expect(responseFactory).toHaveBeenCalledTimes(1);
      });
    });

    it('should log response callback errors and keep sockets usable', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
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

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
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
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const firstHandler = await promiseIfRemote(
          interceptor.message().respond({ type: 'delete', id: 'first' }).times(1),
          interceptor,
        );
        const secondHandler = await promiseIfRemote(
          interceptor.message().respond({ type: 'delete', id: 'second' }).times(1),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          let messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: 'second' });

          messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));
          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: 'first' });
        });

        await firstHandler.checkTimes();
        await secondHandler.checkTimes();
        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    it('should passively handle messages without sending a response', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await promiseIfRemote(interceptor.message().with({ type: 'create' }).times(1), interceptor);

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
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

          await promiseIfRemote(interceptor.checkTimes(), interceptor);
        },
      );
    });
  });

  describe('Effects', () => {
    it('should run side effects without responses', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const effect = vi.fn();

        await promiseIfRemote(interceptor.message().effect(effect), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
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
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(
          interceptor.message().effect((message, { sender }) => {
            sender.send(JSON.stringify({ type: 'delete', id: message.type }));
          }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: 'create' });
        });
      });
    });

    it('should allow effects to broadcast through the receiver', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(
          interceptor.message().effect((message, { receiver }) => {
            receiver.send(JSON.stringify({ type: 'delete', id: message.type }));
          }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (firstClient) => {
          await usingWebSocketClient<MessageSchema>(baseURL, async (secondClient) => {
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

    it('should log effect callback errors and keep sockets usable', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
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

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
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
      await usingWebSocketInterceptor<BinarySchema>(interceptorOptions, async (interceptor) => {
        const requestMessage = createBinaryMessage(0xff, 0x00);
        const responseMessage = createBinaryMessage(0x00, 0xff);

        await promiseIfRemote(
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

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });
  });
}
