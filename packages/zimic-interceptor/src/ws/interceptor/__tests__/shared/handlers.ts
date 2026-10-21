import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import { usingWebSocketClient, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareHandlerWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  // No WebSocket counterpart for the HTTP method groups: WebSocket messages have no method.

  it('should support intercepting messages with a static response', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const messagePromise = waitForWebSocketClientMessage(client);

        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
      });
    });
  });

  it('should support intercepting messages with a computed response', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const responseFactory = vi.fn((message: MessageSchema) => ({ type: 'server' as const, index: message.index }));

      await promiseIfRemote(interceptor.message().respond(responseFactory), interceptor);

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const messagePromise = waitForWebSocketClientMessage(client);

        client.send(JSON.stringify({ type: 'client', index: 2 }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
        expect(responseFactory).toHaveBeenCalledTimes(1);
      });
    });
  });

  it('should log an error if a message is intercepted with a computed response and the handler throws', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const error = new Error('An error occurred.');

      await promiseIfRemote(
        interceptor
          .message()
          .with({ type: 'client', index: 1 })
          .respond(() => {
            throw error;
          }),
        interceptor,
      );

      await promiseIfRemote(
        interceptor.message().with({ type: 'client', index: 2 }).respond({ type: 'server', index: 2 }),
        interceptor,
      );

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        await usingIgnoredConsole(['error'], async (console) => {
          client.send(JSON.stringify({ type: 'client', index: 1 }));

          await waitFor(() => {
            expect(console.error).toHaveBeenCalledWith(error);
          });
        });

        const messagePromise = waitForWebSocketClientMessage(client);

        client.send(JSON.stringify({ type: 'client', index: 2 }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
      });
    });
  });

  // No WebSocket counterparts for the HTTP cases intercepting requests having headers or search params: WebSocket
  // messages carry neither.

  // Unlike HTTP requests, a message needs no reply, so a handler without a registered response still intercepts it.
  it('should intercept messages without a registered response', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.message().with({ type: 'client', index: 1 }).times(1),
          interceptor,
        );

        await promiseIfRemote(
          interceptor.message().with({ type: 'client', index: 2 }).respond({ type: 'server', index: 2 }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const firstMessagePromise = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'client', index: 1 }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          // Messages on a socket are delivered in order, so the probe response arriving first means that handling the
          // message without a registered response sent nothing.
          client.send(JSON.stringify({ type: 'client', index: 2 }));

          await expect(firstMessagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));

          await handler.checkTimes();
        });
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

  // No WebSocket counterpart for the HTTP case about access-control headers in browsers: WebSocket handshakes do not
  // use CORS.

  it('should reply only to the sender of an intercepted message', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(
        interceptor.message().respond((message) => ({ type: 'server', index: message.index })),
        interceptor,
      );

      await usingWebSocketClient<MessageSchema>(baseURL, async (firstClient) => {
        await usingWebSocketClient<MessageSchema>(baseURL, async (secondClient) => {
          const firstMessagePromise = waitForWebSocketClientMessage(firstClient);
          const secondMessageListener = vi.fn();
          secondClient.addEventListener('message', secondMessageListener);

          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          firstClient.send(JSON.stringify({ type: 'client', index: 1 }));

          await expect(firstMessagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
          await waitForNot(() => {
            expect(secondMessageListener).toHaveBeenCalled();
          });
        });
      });
    });
  });
}
