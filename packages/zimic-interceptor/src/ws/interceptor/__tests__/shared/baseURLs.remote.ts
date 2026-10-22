import { waitFor } from '@zimic/utils/time';
import { joinURL } from '@zimic/utils/url';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { usingWebSocketClient, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import { UnhandledMessageStrategy } from '../../types/options';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

interface SharedRemoteBaseURLWebSocketInterceptorTestsOptions {
  getBaseURL: () => string;
}

export function declareRemoteBaseURLWebSocketInterceptorTests(
  options: SharedRemoteBaseURLWebSocketInterceptorTestsOptions,
) {
  const { getBaseURL } = options;

  const olderAuth = { token: 'older-token' };
  const auth = { token: 'token' };

  let baseURL: string;

  beforeEach(() => {
    baseURL = getBaseURL();
  });

  it('should apply the unhandled message strategy of the last started interceptor if only an older one using another authentication token has a matching handler', async () => {
    const olderOnUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));
    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

    await usingWebSocketInterceptor<MessageSchema>(
      {
        type: 'remote',
        baseURL,
        auth: olderAuth,
        messageSaving: { enabled: true },
        onUnhandledMessage: olderOnUnhandledMessage,
      },
      async (olderInterceptor) => {
        const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

        await usingWebSocketInterceptor<MessageSchema>(
          { type: 'remote', baseURL, auth, messageSaving: { enabled: true }, onUnhandledMessage },
          async (interceptor) => {
            const handler = await interceptor
              .message()
              .with({ type: 'client', index: 2 })
              .respond({ type: 'server', index: 2 });

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await waitFor(() => {
                expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
              });
            });

            expect(handler.messages).toHaveLength(0);
            expect(olderHandler.messages).toHaveLength(0);

            expect(olderOnUnhandledMessage).not.toHaveBeenCalled();
          },
        );
      },
    );
  });

  it('should intercept messages with the last started interceptor if an older one using another authentication token also matches', async () => {
    const olderRestriction = vi.fn(() => true);

    await usingWebSocketInterceptor<MessageSchema>(
      { type: 'remote', baseURL, auth: olderAuth, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        const olderConnectionListener = vi.fn();
        olderInterceptor.on('connection', olderConnectionListener);

        const olderHandler = await olderInterceptor
          .message()
          .with(olderRestriction)
          .respond({ type: 'server', index: 1 });

        await usingWebSocketInterceptor<MessageSchema>(
          { type: 'remote', baseURL, auth, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor.message().respond({ type: 'server', index: 2 });

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              const messagePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));

              expect(interceptor.clients).toHaveLength(1);
              expect(olderInterceptor.clients).toHaveLength(0);
              expect(olderConnectionListener).not.toHaveBeenCalled();
            });

            expect(handler.messages).toHaveLength(1);
            expect(olderHandler.messages).toHaveLength(0);
            expect(olderRestriction).not.toHaveBeenCalled();
          },
        );
      },
    );
  });

  it('should intercept messages with an older interceptor using another authentication token after the last started one stops', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { type: 'remote', baseURL, auth: olderAuth, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

        await usingWebSocketInterceptor<MessageSchema>(
          { type: 'remote', baseURL, auth, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor.message().respond({ type: 'server', index: 2 });

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              const messagePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
            });

            expect(handler.messages).toHaveLength(1);
            expect(olderHandler.messages).toHaveLength(0);

            await interceptor.stop();

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              const messagePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
            });

            expect(olderHandler.messages).toHaveLength(1);
          },
        );
      },
    );
  });

  it('should intercept messages with an older interceptor using another authentication token after the last started one stops if an interceptor using its authentication token is still running', async () => {
    const otherBaseURL = joinURL(baseURL, 'other');

    await usingWebSocketInterceptor<MessageSchema>(
      { type: 'remote', baseURL, auth: olderAuth, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

        await usingWebSocketInterceptor<MessageSchema>(
          { type: 'remote', baseURL: otherBaseURL, auth },
          async (otherInterceptor) => {
            await usingWebSocketInterceptor<MessageSchema>(
              { type: 'remote', baseURL, auth, messageSaving: { enabled: true } },
              async (interceptor) => {
                await interceptor.message().respond({ type: 'server', index: 2 });

                await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
                  const messagePromise = waitForWebSocketClientMessage(client);
                  client.send(JSON.stringify({ type: 'client', index: 1 }));

                  await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
                });

                await interceptor.stop();
                expect(otherInterceptor.isRunning).toBe(true);

                await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
                  const messagePromise = waitForWebSocketClientMessage(client);
                  client.send(JSON.stringify({ type: 'client', index: 1 }));

                  await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
                });

                expect(olderHandler.messages).toHaveLength(1);
              },
            );
          },
        );
      },
    );
  });

  it('should intercept messages with the last started interceptor after it is cleared and declares its handlers again if an older one uses another authentication token', async () => {
    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

    await usingWebSocketInterceptor<MessageSchema>(
      { type: 'remote', baseURL, auth: olderAuth, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

        await usingWebSocketInterceptor<MessageSchema>(
          { type: 'remote', baseURL, auth, messageSaving: { enabled: true }, onUnhandledMessage },
          async (interceptor) => {
            await interceptor.message().respond({ type: 'server', index: 2 });

            await interceptor.clear();

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await waitFor(() => {
                expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
              });
            });

            expect(olderHandler.messages).toHaveLength(0);

            const handler = await interceptor.message().respond({ type: 'server', index: 2 });

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              const messagePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
            });

            expect(handler.messages).toHaveLength(1);
            expect(olderHandler.messages).toHaveLength(0);
          },
        );
      },
    );
  });

  it('should intercept messages with the last started interceptor after an older one using another authentication token is cleared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { type: 'remote', baseURL, auth: olderAuth, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

        await usingWebSocketInterceptor<MessageSchema>(
          { type: 'remote', baseURL, auth: olderAuth, messageSaving: { enabled: true } },
          async (otherOlderInterceptor) => {
            await otherOlderInterceptor.message().respond({ type: 'server', index: 3 });

            await usingWebSocketInterceptor<MessageSchema>(
              { type: 'remote', baseURL, auth, messageSaving: { enabled: true } },
              async (interceptor) => {
                const handler = await interceptor.message().respond({ type: 'server', index: 2 });

                await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
                  const messagePromise = waitForWebSocketClientMessage(client);
                  client.send(JSON.stringify({ type: 'client', index: 1 }));

                  await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
                });

                await otherOlderInterceptor.clear();

                await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
                  const messagePromise = waitForWebSocketClientMessage(client);
                  client.send(JSON.stringify({ type: 'client', index: 1 }));

                  await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
                });

                expect(handler.messages).toHaveLength(2);
                expect(olderHandler.messages).toHaveLength(0);
              },
            );
          },
        );
      },
    );
  });

  it('should intercept messages with the last started interceptor after an older one using another authentication token is cleared and declares its handlers again', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { type: 'remote', baseURL, auth: olderAuth, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        await olderInterceptor.message().respond({ type: 'server', index: 1 });

        await usingWebSocketInterceptor<MessageSchema>(
          { type: 'remote', baseURL, auth, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor.message().respond({ type: 'server', index: 2 });

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              const messagePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
            });

            await olderInterceptor.clear();

            const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              const messagePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
            });

            expect(handler.messages).toHaveLength(2);
            expect(olderHandler.messages).toHaveLength(0);
          },
        );
      },
    );
  });

  it('should intercept messages with the last started interceptor after an older one using another authentication token declares its handlers later', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { type: 'remote', baseURL, auth: olderAuth, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        await usingWebSocketInterceptor<MessageSchema>(
          { type: 'remote', baseURL, auth: olderAuth, messageSaving: { enabled: true } },
          async (otherOlderInterceptor) => {
            const otherOlderHandler = await otherOlderInterceptor.message().respond({ type: 'server', index: 3 });

            await usingWebSocketInterceptor<MessageSchema>(
              { type: 'remote', baseURL, auth, messageSaving: { enabled: true } },
              async (interceptor) => {
                const handler = await interceptor.message().respond({ type: 'server', index: 2 });

                const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

                await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
                  const messagePromise = waitForWebSocketClientMessage(client);
                  client.send(JSON.stringify({ type: 'client', index: 1 }));

                  await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
                });

                expect(handler.messages).toHaveLength(1);
                expect(olderHandler.messages).toHaveLength(0);
                expect(otherOlderHandler.messages).toHaveLength(0);
              },
            );
          },
        );
      },
    );
  });

  it('should intercept messages with the last started interceptor after an older one using another authentication token declares more handlers', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { type: 'remote', baseURL, auth: olderAuth, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

        await usingWebSocketInterceptor<MessageSchema>(
          { type: 'remote', baseURL, auth, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor.message().respond({ type: 'server', index: 2 });

            await olderInterceptor.message().respond({ type: 'server', index: 3 });

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              const messagePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
            });

            expect(handler.messages).toHaveLength(1);
            expect(olderHandler.messages).toHaveLength(0);
          },
        );
      },
    );
  });
}
