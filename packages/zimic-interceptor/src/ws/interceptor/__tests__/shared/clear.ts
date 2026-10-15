import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';

import { LocalWebSocketMessageHandler } from '../../../messageHandler/LocalWebSocketMessageHandler';
import { RemoteWebSocketMessageHandler } from '../../../messageHandler/RemoteWebSocketMessageHandler';
import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions, usingWebSocketClient, waitForWebSocketMessage } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

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

          const messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await expect(messagePromise).resolves.toEqual({ type: 'server', index: 1 });

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
          const messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 2 }));
          await expect(messagePromise).resolves.toEqual({ type: 'server', index: 2 });
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
          const messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 2 }));
          await expect(messagePromise).resolves.toEqual({ type: 'server', index: 2 });
        });

        expect(otherHandler.messages).toHaveLength(1);
      },
    );
  });

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

                const firstCloseEventPromise = new Promise<WebSocketClient.CloseEvent<MessageSchema>>((resolve) => {
                  firstClient.addEventListener('close', resolve, { once: true });
                });

                await promiseIfRemote(firstInterceptor.clear(), firstInterceptor);

                const firstCloseEvent = await firstCloseEventPromise;
                expect(firstCloseEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);
                expect(firstInterceptor.clients).toHaveLength(0);
                expect(secondInterceptor.clients).toHaveLength(1);
                expect(secondClient.readyState).toBe(WebSocketClient.OPEN);

                const secondMessagePromise = waitForWebSocketMessage(secondClient);
                secondClient.send(JSON.stringify({ type: 'client', index: 2 }));
                await expect(secondMessagePromise).resolves.toEqual({ type: 'server', index: 2 });
              });
            });
          },
        );
      },
    );
  });
}
