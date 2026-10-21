import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import {
  usingWebSocketClient,
  waitForWebSocketClientClose,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import LocalWebSocketMessageHandler from '../../../messageHandler/LocalWebSocketMessageHandler';
import RemoteWebSocketMessageHandler from '../../../messageHandler/RemoteWebSocketMessageHandler';
import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;
type ChatMessage = WebSocketSchema<{ type: 'client'; text: string } | { type: 'server'; text: string }>;

export function declareClearWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  const Handler = type === 'local' ? LocalWebSocketMessageHandler : RemoteWebSocketMessageHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should ignore all handlers after cleared when intercepting messages', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);
        expect(handler.messages).toHaveLength(0);

        let closeEvent: WebSocketClient.CloseEvent<MessageSchema> | undefined;

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          client.addEventListener('close', (event) => {
            closeEvent = event;
          });

          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

          expect(handler.messages).toHaveLength(1);
          expect(interceptor.server.messages).toHaveLength(1);

          await promiseIfRemote(interceptor.clear(), interceptor);

          await waitFor(() => {
            expect(closeEvent?.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);
          });

          expect(handler.messages).toHaveLength(0);
          expect(interceptor.server.messages).toHaveLength(0);
          expect(interceptor.clients).toHaveLength(0);
        });

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messageListener = vi.fn();
          client.addEventListener('message', messageListener);

          client.send(JSON.stringify({ type: 'client', index: 2 }));

          await waitForNot(() => {
            expect(messageListener).toHaveBeenCalled();
          });

          expect(handler.messages).toHaveLength(0);
        });
      },
    );
  });

  it('should support creating new handlers after cleared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

        await promiseIfRemote(interceptor.clear(), interceptor);

        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 2 }), interceptor);
        expect(handler.messages).toHaveLength(0);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 2 }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
        });

        expect(handler.messages).toHaveLength(1);
      },
    );
  });

  it('should support reusing previous handlers after cleared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message(), interceptor);

        await promiseIfRemote(handler.respond({ type: 'server', index: 1 }), interceptor);

        await promiseIfRemote(interceptor.clear(), interceptor);

        const otherHandler = await promiseIfRemote(handler.respond({ type: 'server', index: 2 }), interceptor);
        expect(otherHandler).toBeInstanceOf(Handler);

        expect(handler.messages).toHaveLength(0);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 2 }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
        });

        expect(otherHandler.messages).toHaveLength(1);
      },
    );
  });

  // No WebSocket counterpart for "should not consider handlers from before cleared when multiple paths matched
  // requests": WebSocket handlers have no per-handler paths.

  it('should handle messages once if another interceptor is cleared while they are being handled', async () => {
    const restrictionStartedPromise = createPromiseWithResolvers<void>();
    const restrictionReleasedPromise = createPromiseWithResolvers<void>();

    const restriction = vi.fn(async () => {
      restrictionStartedPromise.resolve();
      await restrictionReleasedPromise;
      return true;
    });

    const effect = vi.fn();

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, baseURL: `${baseURL}/other` },
      async (otherInterceptor) => {
        await promiseIfRemote(otherInterceptor.message().respond({ type: 'server', index: 2 }), otherInterceptor);

        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          await promiseIfRemote(
            interceptor.message().with(restriction).effect(effect).respond({ type: 'server', index: 1 }),
            interceptor,
          );

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            const messagePromise = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify({ type: 'client', index: 1 }));
            await restrictionStartedPromise;

            await promiseIfRemote(otherInterceptor.clear(), otherInterceptor);
            restrictionReleasedPromise.resolve();

            await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

            expect(restriction).toHaveBeenCalledTimes(1);
            expect(effect).toHaveBeenCalledTimes(1);
          });
        });
      },
    );
  });

  // No WebSocket counterpart for "should not consider handlers of another interceptor cleared while requests are being
  // handled": a connection belongs to one interceptor for its whole lifetime, so its messages never reach the handlers
  // of another interceptor.

  it('should clear only clients owned by the selected interceptor', async () => {
    const firstBaseURL = `${baseURL}/first`;
    const secondBaseURL = `${baseURL}/second`;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, baseURL: firstBaseURL },
      async (firstInterceptor) => {
        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, baseURL: secondBaseURL },
          async (secondInterceptor) => {
            await promiseIfRemote(firstInterceptor.message().respond({ type: 'server', index: 1 }), firstInterceptor);
            await promiseIfRemote(secondInterceptor.message().respond({ type: 'server', index: 2 }), secondInterceptor);

            await usingWebSocketClient<MessageSchema>(firstBaseURL, async (firstClient) => {
              await usingWebSocketClient<MessageSchema>(secondBaseURL, async (secondClient) => {
                await waitFor(() => {
                  expect(firstInterceptor.clients).toHaveLength(1);
                  expect(secondInterceptor.clients).toHaveLength(1);
                });

                const firstCloseEventPromise = waitForWebSocketClientClose(firstClient);

                await promiseIfRemote(firstInterceptor.clear(), firstInterceptor);

                const firstCloseEvent = await firstCloseEventPromise;
                expect(firstCloseEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);
                expect(firstInterceptor.clients).toHaveLength(0);
                expect(secondInterceptor.clients).toHaveLength(1);
                expect(secondClient.readyState).toBe(WebSocketClient.OPEN);

                const secondMessagePromise = waitForWebSocketClientMessage(secondClient);
                secondClient.send(JSON.stringify({ type: 'client', index: 2 }));
                await expect(secondMessagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
              });
            });
          },
        );
      },
    );
  });

  it('should not save intercepted messages after cleared while a message is being handled', async () => {
    await usingWebSocketInterceptor<ChatMessage>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const effectStartedPromise = createPromiseWithResolvers<void>();
        const effectReleasePromise = createPromiseWithResolvers<void>();

        const handler = await interceptor
          .message()
          .effect(async (message) => {
            if (message.type === 'client' && message.text === 'pending') {
              effectStartedPromise.resolve();
              await effectReleasePromise;
            }
          })
          .respond({ type: 'server', text: 'ack' });

        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
          const existingResponsePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', text: 'existing' }));
          await expect(existingResponsePromise).resolves.toBe('{"type":"server","text":"ack"}');

          const handlerMessages = handler.messages;
          const serverMessages = interceptor.server.messages;
          const [clientHandle] = interceptor.clients;
          const clientMessages = clientHandle.messages;

          expect(handlerMessages).toHaveLength(1);
          expect(serverMessages).toHaveLength(1);
          expect(clientMessages).toHaveLength(1);

          client.send(JSON.stringify({ type: 'client', text: 'pending' }));
          await effectStartedPromise;

          await interceptor.clear();

          const nextHandler = await interceptor.message().respond({ type: 'server', text: 'next' });

          effectReleasePromise.resolve();

          // Clearing closes the connected clients, so the follow-up message is sent by a new client.
          await usingWebSocketClient<ChatMessage>(baseURL, async (nextClient) => {
            const nextResponsePromise = waitForWebSocketClientMessage(nextClient);
            nextClient.send(JSON.stringify({ type: 'client', text: 'next' }));
            await expect(nextResponsePromise).resolves.toBe('{"type":"server","text":"next"}');
          });

          await waitFor(() => {
            expect(nextHandler.messages).toHaveLength(1);
          });

          expect(handler.messages).toBe(handlerMessages);
          expect(handlerMessages).toEqual([]);

          expect(interceptor.server.messages).toBe(serverMessages);
          expect(serverMessages).toHaveLength(1);
          expect(serverMessages[0].data).toEqual({ type: 'client', text: 'next' });

          expect(clientHandle.messages).toBe(clientMessages);
          expect(clientMessages).toEqual([]);
        });
      },
    );
  });
}
