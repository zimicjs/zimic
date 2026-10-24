import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import { usingWebSocketClient, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import { UnhandledMessageStrategy, WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions, verifyUnhandledMessageWarning } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareUnhandledMessageFactoriesWebSocketInterceptorTests(
  options: RuntimeSharedWebSocketInterceptorTestsOptions,
) {
  const { platform, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should support a synchronous unhandled message factory', async () => {
    const onUnhandledMessage = vi
      .fn<UnhandledMessageStrategy.DeclarationFactory>()
      .mockReturnValueOnce({ log: false })
      .mockReturnValueOnce({ log: true });

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, onUnhandledMessage },
      async (interceptor) => {
        const matchedMessage: MessageSchema = { type: 'client', index: 1 };

        await promiseIfRemote(
          interceptor.message().with(matchedMessage).respond({ type: 'server', index: 1 }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await usingIgnoredConsole(['warn', 'error'], async (console) => {
            const responsePromise = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify(matchedMessage));
            await expect(responsePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

            expect(onUnhandledMessage).toHaveBeenCalledTimes(0);
            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(0);

            const silentMessage: MessageSchema = { type: 'client', index: 2 };
            client.send(JSON.stringify(silentMessage));

            await waitFor(() => {
              expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
            });
            expect(onUnhandledMessage).toHaveBeenNthCalledWith(1, silentMessage);

            const loggedMessage: MessageSchema = { type: 'client', index: 3 };
            client.send(JSON.stringify(loggedMessage));

            await waitFor(() => {
              expect(console.warn).toHaveBeenCalledTimes(1);
            });
            expect(console.error).toHaveBeenCalledTimes(0);

            expect(onUnhandledMessage).toHaveBeenCalledTimes(2);
            expect(onUnhandledMessage).toHaveBeenNthCalledWith(2, loggedMessage);

            await verifyUnhandledMessageWarning(console.warn.mock.calls[0], { data: loggedMessage, platform });
          });
        });
      },
    );
  });

  it('should support an asynchronous unhandled message factory', async () => {
    const onUnhandledMessage = vi
      .fn<UnhandledMessageStrategy.DeclarationFactory>()
      .mockResolvedValueOnce({ log: false })
      .mockResolvedValueOnce({ log: true });

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, onUnhandledMessage },
      async (interceptor) => {
        const matchedMessage: MessageSchema = { type: 'client', index: 1 };

        await promiseIfRemote(
          interceptor.message().with(matchedMessage).respond({ type: 'server', index: 1 }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await usingIgnoredConsole(['warn', 'error'], async (console) => {
            const responsePromise = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify(matchedMessage));
            await expect(responsePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

            expect(onUnhandledMessage).toHaveBeenCalledTimes(0);
            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(0);

            const silentMessage: MessageSchema = { type: 'client', index: 2 };
            client.send(JSON.stringify(silentMessage));

            await waitFor(() => {
              expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
            });
            expect(onUnhandledMessage).toHaveBeenNthCalledWith(1, silentMessage);

            const loggedMessage: MessageSchema = { type: 'client', index: 3 };
            client.send(JSON.stringify(loggedMessage));

            await waitFor(() => {
              expect(console.warn).toHaveBeenCalledTimes(1);
            });
            expect(console.error).toHaveBeenCalledTimes(0);

            expect(onUnhandledMessage).toHaveBeenCalledTimes(2);
            expect(onUnhandledMessage).toHaveBeenNthCalledWith(2, loggedMessage);

            await verifyUnhandledMessageWarning(console.warn.mock.calls[0], { data: loggedMessage, platform });
          });
        });
      },
    );
  });

  it('should log an error if a synchronous unhandled message factory throws', async () => {
    const error = new Error('Unhandled message.');

    const onUnhandledMessage = vi
      .fn<UnhandledMessageStrategy.DeclarationFactory>()
      .mockReturnValueOnce({ log: false })
      .mockImplementationOnce(() => {
        throw error;
      });

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, onUnhandledMessage },
      async (interceptor) => {
        const matchedMessage: MessageSchema = { type: 'client', index: 1 };

        await promiseIfRemote(
          interceptor.message().with(matchedMessage).respond({ type: 'server', index: 1 }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await usingIgnoredConsole(['warn', 'error'], async (console) => {
            const responsePromise = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify(matchedMessage));
            await expect(responsePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

            expect(onUnhandledMessage).toHaveBeenCalledTimes(0);
            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(0);

            client.send(JSON.stringify({ type: 'client', index: 2 }));

            await waitFor(() => {
              expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
            });

            const loggedMessage: MessageSchema = { type: 'client', index: 3 };
            client.send(JSON.stringify(loggedMessage));

            await waitFor(() => {
              expect(console.warn).toHaveBeenCalledTimes(1);
            });
            expect(onUnhandledMessage).toHaveBeenCalledTimes(2);

            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenNthCalledWith(1, error);

            await verifyUnhandledMessageWarning(console.warn.mock.calls[0], { data: loggedMessage, platform });
          });
        });
      },
    );
  });

  it('should log an error if an asynchronous unhandled message factory throws', async () => {
    const error = new Error('Unhandled message.');

    const onUnhandledMessage = vi
      .fn<UnhandledMessageStrategy.DeclarationFactory>()
      .mockResolvedValueOnce({ log: false })
      .mockRejectedValueOnce(error);

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, onUnhandledMessage },
      async (interceptor) => {
        const matchedMessage: MessageSchema = { type: 'client', index: 1 };

        await promiseIfRemote(
          interceptor.message().with(matchedMessage).respond({ type: 'server', index: 1 }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await usingIgnoredConsole(['warn', 'error'], async (console) => {
            const responsePromise = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify(matchedMessage));
            await expect(responsePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

            expect(onUnhandledMessage).toHaveBeenCalledTimes(0);
            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(0);

            client.send(JSON.stringify({ type: 'client', index: 2 }));

            await waitFor(() => {
              expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
            });

            const loggedMessage: MessageSchema = { type: 'client', index: 3 };
            client.send(JSON.stringify(loggedMessage));

            await waitFor(() => {
              expect(console.warn).toHaveBeenCalledTimes(1);
            });
            expect(onUnhandledMessage).toHaveBeenCalledTimes(2);

            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenNthCalledWith(1, error);

            await verifyUnhandledMessageWarning(console.warn.mock.calls[0], { data: loggedMessage, platform });
          });
        });
      },
    );
  });

  it('should call an unhandled message factory once if multiple handlers match a message', async () => {
    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, onUnhandledMessage },
      async (interceptor) => {
        const matchedMessage: MessageSchema = { type: 'client', index: 1 };

        await promiseIfRemote(
          interceptor.message().with(matchedMessage).respond({ type: 'server', index: 1 }),
          interceptor,
        );

        await promiseIfRemote(
          interceptor.message().with(matchedMessage).respond({ type: 'server', index: 2 }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          client.send(JSON.stringify({ type: 'client', index: 2 }));

          await waitFor(() => {
            expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
          });

          const responsePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify(matchedMessage));
          await expect(responsePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));

          expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
        });
      },
    );
  });

  it('should call the unhandled message factory of the last started interceptor if an older one declares the newest handler', async () => {
    const olderOnUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>();
    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true }, onUnhandledMessage: olderOnUnhandledMessage },
      async (olderInterceptor) => {
        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, messageSaving: { enabled: true }, onUnhandledMessage },
          async (interceptor) => {
            const matchedMessage: MessageSchema = { type: 'client', index: 1 };

            const handler = await promiseIfRemote(
              interceptor.message().with(matchedMessage).respond({ type: 'server', index: 2 }),
              interceptor,
            );

            const olderHandler = await promiseIfRemote(
              olderInterceptor.message().with(matchedMessage).respond({ type: 'server', index: 1 }),
              olderInterceptor,
            );

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              client.send(JSON.stringify({ type: 'client', index: 2 }));

              await waitFor(() => {
                expect(onUnhandledMessage).toHaveBeenCalled();
              });

              // Unhandled messages have no reply, so no event signals that no other strategy will be applied.
              await waitForNot(() => {
                expect(olderOnUnhandledMessage).toHaveBeenCalled();
              });
            });

            expect(handler.messages).toHaveLength(0);
            expect(olderHandler.messages).toHaveLength(0);

            expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
            expect(olderOnUnhandledMessage).not.toHaveBeenCalled();
          },
        );
      },
    );
  });
}
