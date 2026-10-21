import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import {
  createBinaryMessage,
  readBytes,
  usingWebSocketClient,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;
type ChatMessage = WebSocketSchema<{ type: 'client'; text: string } | { type: 'server'; text: string }>;
type BinaryLikeJSONMessage = WebSocketSchema<{ type: 'binary'; data: string }>;
type TextMessage = WebSocketSchema<string>;
type BinaryMessage = WebSocketSchema<ArrayBuffer>;

export function declareHandlerWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should track clients when they open and close', async () => {
    await usingWebSocketInterceptor<ChatMessage>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(interceptor.message().respond({ type: 'server', text: 'connected' }), interceptor);
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

  it('should forward client messages to handlers, reply only to the sender, and save messages', async () => {
    await usingWebSocketInterceptor<ChatMessage>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .message()
            .with({ type: 'client' })
            .respond((message) => ({ type: 'server', text: `received ${message.text}` }))
            .times(1),
          interceptor,
        );

        await usingWebSocketClient<ChatMessage>(baseURL, async (firstClient) => {
          await usingWebSocketClient<ChatMessage>(baseURL, async (secondClient) => {
            const firstMessagePromise = waitForWebSocketClientMessage(firstClient);
            const secondMessageListener = vi.fn();
            secondClient.addEventListener('message', secondMessageListener);

            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(2);
            });

            const serverMessages = interceptor.server.messages;
            const firstInterceptorClient = interceptor.clients.find((client) => client.url === firstClient.url)!;
            const firstClientMessages = firstInterceptorClient.messages;

            firstClient.send(JSON.stringify({ type: 'client', text: 'one' }));

            await expect(firstMessagePromise).resolves.toBe(JSON.stringify({ type: 'server', text: 'received one' }));
            await waitForNot(() => {
              expect(secondMessageListener).toHaveBeenCalled();
            });

            expect(handler.messages).toHaveLength(1);
            expect(handler.messages[0].sender.url).toBe(firstClient.url);
            expect(handler.messages[0].receiver).toBe(interceptor.server);
            expect(handler.messages[0].data).toEqual({ type: 'client', text: 'one' });
            expect(interceptor.server.messages).toBe(serverMessages);
            expect(firstInterceptorClient.messages).toHaveLength(1);
            expect(firstInterceptorClient.messages).toBe(firstClientMessages);
            expect(interceptor.server.messages).toHaveLength(1);
          });
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      },
    );
  });

  it('should forward and save plain string messages', async () => {
    await usingWebSocketInterceptor<TextMessage>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().with('ping').respond('pong').times(1), interceptor);

        await usingWebSocketClient<TextMessage>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);

          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          client.send('ping');

          await expect(messagePromise).resolves.toBe('pong');
          expect(handler.messages).toHaveLength(1);
          expect(handler.messages[0].data).toBe('ping');
          expect(interceptor.clients[0].messages[0].data).toBe('ping');
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      },
    );
  });

  it('should preserve JSON messages shaped like binary envelopes', async () => {
    await usingWebSocketInterceptor<BinaryLikeJSONMessage>(interceptorOptions, async (interceptor) => {
      const responseMessage: BinaryLikeJSONMessage = { type: 'binary', data: 'response' };

      await promiseIfRemote(
        interceptor.message().with({ type: 'binary', data: 'request' }).respond(responseMessage).times(1),
        interceptor,
      );

      await usingWebSocketClient<BinaryLikeJSONMessage>(baseURL, async (firstClient) => {
        await usingWebSocketClient<BinaryLikeJSONMessage>(baseURL, async (secondClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          const firstMessagePromise = waitForWebSocketClientMessage(firstClient);
          firstClient.send(JSON.stringify({ type: 'binary', data: 'request' }));
          await expect(firstMessagePromise).resolves.toBe(JSON.stringify(responseMessage));

          const secondMessagePromise = waitForWebSocketClientMessage(secondClient);
          interceptor.server.send(JSON.stringify({ type: 'binary', data: 'broadcast' }));
          await expect(secondMessagePromise).resolves.toBe(JSON.stringify({ type: 'binary', data: 'broadcast' }));
        });
      });
    });
  });

  it('should allow effects to target clients through public handles', async () => {
    await usingWebSocketInterceptor<ChatMessage>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(
        interceptor.message().effect((message) => {
          const [, secondClient] = interceptor.clients;
          secondClient.send(JSON.stringify({ type: 'server', text: `targeted ${message.text}` }));
        }),
        interceptor,
      );

      await usingWebSocketClient<ChatMessage>(baseURL, async (firstClient) => {
        await usingWebSocketClient<ChatMessage>(baseURL, async (secondClient) => {
          const firstMessageListener = vi.fn();
          const secondMessagePromise = waitForWebSocketClientMessage(secondClient);
          firstClient.addEventListener('message', firstMessageListener);

          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          firstClient.send(JSON.stringify({ type: 'client', text: 'one' }));

          await expect(secondMessagePromise).resolves.toBe(JSON.stringify({ type: 'server', text: 'targeted one' }));
          await waitForNot(() => {
            expect(firstMessageListener).toHaveBeenCalled();
          });
        });
      });
    });
  });

  it('should parse JSON text before unrestricted handler callbacks', async () => {
    await usingWebSocketInterceptor<ChatMessage>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const requestMessage: ChatMessage = { type: 'client', text: 'hello' };
        const effect = vi.fn();
        const handler = await promiseIfRemote(interceptor.message().effect(effect).times(1), interceptor);

        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          client.send(JSON.stringify(requestMessage));

          await waitFor(() => {
            expect(effect).toHaveBeenCalledWith(requestMessage, expect.any(Object));
          });

          expect(handler.messages).toHaveLength(1);
          expect(handler.messages[0].data).toEqual(requestMessage);
          expect(interceptor.clients[0].messages[0].data).toEqual(requestMessage);
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      },
    );
  });

  it('should preserve non-JSON text before unrestricted handler callbacks', async () => {
    await usingWebSocketInterceptor<TextMessage>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const requestMessage = 'plain text';
        const effect = vi.fn();
        const handler = await promiseIfRemote(interceptor.message().effect(effect).times(1), interceptor);

        await usingWebSocketClient<TextMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          client.send(requestMessage);

          await waitFor(() => {
            expect(effect).toHaveBeenCalledWith(requestMessage, expect.any(Object));
          });

          expect(handler.messages).toHaveLength(1);
          expect(handler.messages[0].data).toBe(requestMessage);
          expect(interceptor.clients[0].messages[0].data).toBe(requestMessage);
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      },
    );
  });

  it('should preserve binary data before unrestricted handler callbacks', async () => {
    await usingWebSocketInterceptor<BinaryMessage>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const requestMessage = createBinaryMessage(0xff, 0x00);
        const effect = vi.fn();
        const handler = await promiseIfRemote(interceptor.message().effect(effect).times(1), interceptor);

        await usingWebSocketClient<BinaryMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          client.send(requestMessage);

          await waitFor(() => {
            expect(effect).toHaveBeenCalledOnce();
          });

          const receivedMessage = effect.mock.calls[0][0] as Blob | ArrayBuffer;
          expect(await readBytes(receivedMessage)).toEqual([0xff, 0x00]);
          expect(handler.messages).toHaveLength(1);
          expect(await readBytes(handler.messages[0].data)).toEqual([0xff, 0x00]);
          expect(await readBytes(interceptor.clients[0].messages[0].data)).toEqual([0xff, 0x00]);
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      },
    );
  });

  it('should passively accept, save, and count matching client messages without sending a response', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().with({ type: 'client' }).times(1), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messageListener = vi.fn();
          client.addEventListener('message', messageListener);

          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          client.send(JSON.stringify({ type: 'client', index: 1 }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          await waitForNot(() => {
            expect(messageListener).toHaveBeenCalled();
          });

          expect(handler.messages[0].sender.url).toBe(client.url);
          expect(handler.messages[0].receiver).toBe(interceptor.server);
          expect(handler.messages[0].data).toEqual({ type: 'client', index: 1 });
          expect(interceptor.clients[0].messages).toHaveLength(1);
          expect(interceptor.clients[0].messages[0].data).toEqual({ type: 'client', index: 1 });
          expect(interceptor.server.messages).toHaveLength(1);
          expect(interceptor.server.messages[0].data).toEqual({ type: 'client', index: 1 });
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      },
    );
  });

  it('should consider only the last declared response when intercepting messages', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          let messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

          expect(handler.messages).toHaveLength(1);

          const otherHandler = await promiseIfRemote(
            interceptor.message().respond({ type: 'server', index: 2 }),
            interceptor,
          );

          expect(otherHandler.messages).toHaveLength(0);

          messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 2 }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));

          expect(handler.messages).toHaveLength(1);
          expect(otherHandler.messages).toHaveLength(1);
          expect(otherHandler.messages[0].data).toEqual({ type: 'client', index: 2 });
        });
      },
    );
  });
}
