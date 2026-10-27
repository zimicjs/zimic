import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expect, it } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import {
  createBinaryMessage,
  usingWebSocketClient,
  waitForWebSocketClientClose,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import { UnhandledMessageStrategy, WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions, verifyUnhandledMessageWarning } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

// HTTP splits each case into bypassed and rejected variants. Unhandled messages have no action, so each pair has one
// WebSocket counterpart.
export function declareUnhandledMessageLoggingWebSocketInterceptorTests(
  options: RuntimeSharedWebSocketInterceptorTestsOptions,
) {
  const { platform, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  describe.each([
    { declarationType: 'undefined' as const, log: undefined },
    { declarationType: 'static' as const, log: undefined },
    { declarationType: 'static' as const, log: true },
    { declarationType: 'factory' as const, log: undefined },
    { declarationType: 'factory' as const, log: true },
  ])('Logging enabled (declaration type: $declarationType)', ({ declarationType, log }) => {
    const onUnhandledMessage: UnhandledMessageStrategy | undefined =
      declarationType === 'undefined' ? undefined : declarationType === 'static' ? { log } : () => ({ log });

    it('should show a warning when logging is enabled and messages are unhandled', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, onUnhandledMessage },
        async (interceptor) => {
          expect(interceptor.onUnhandledMessage).toBe(onUnhandledMessage);

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            await usingIgnoredConsole(['warn', 'error'], async (console) => {
              const message: MessageSchema = { type: 'client', index: 1 };
              client.send(JSON.stringify(message));

              await waitFor(() => {
                expect(console.warn).toHaveBeenCalledTimes(1);
              });
              expect(console.error).toHaveBeenCalledTimes(0);

              await verifyUnhandledMessageWarning(console.warn.mock.calls[0], { data: message, platform });

              expect(client.readyState).toBe(WebSocketClient.OPEN);
            });
          });
        },
      );
    });

    it('should show a warning when logging is enabled and binary messages are unhandled', async () => {
      await usingWebSocketInterceptor<WebSocketSchema<ArrayBuffer>>(
        { ...interceptorOptions, onUnhandledMessage },
        async (interceptor) => {
          expect(interceptor.onUnhandledMessage).toBe(onUnhandledMessage);

          await usingWebSocketClient<WebSocketSchema<ArrayBuffer>>(baseURL, async (client) => {
            await usingIgnoredConsole(['warn', 'error'], async (console) => {
              const message = createBinaryMessage(1, 2);
              client.send(message);

              await waitFor(() => {
                expect(console.warn).toHaveBeenCalledTimes(1);
              });
              expect(console.error).toHaveBeenCalledTimes(0);

              await verifyUnhandledMessageWarning(console.warn.mock.calls[0], { data: message, platform });

              expect(client.readyState).toBe(WebSocketClient.OPEN);
            });
          });
        },
      );
    });

    it('should show a warning when logging is enabled and messages are unhandled due to restrictions', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, onUnhandledMessage },
        async (interceptor) => {
          expect(interceptor.onUnhandledMessage).toBe(onUnhandledMessage);

          const matchedMessage: MessageSchema = { type: 'client', index: 1 };

          await promiseIfRemote(
            interceptor.message().with(matchedMessage).respond({ type: 'server', index: 1 }),
            interceptor,
          );

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            await usingIgnoredConsole(['warn', 'error'], async (console) => {
              let responsePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify(matchedMessage));
              await expect(responsePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

              expect(console.warn).toHaveBeenCalledTimes(0);
              expect(console.error).toHaveBeenCalledTimes(0);

              const unmatchedMessage: MessageSchema = { type: 'client', index: 2 };
              client.send(JSON.stringify(unmatchedMessage));

              await waitFor(() => {
                expect(console.warn).toHaveBeenCalledTimes(1);
              });
              expect(console.error).toHaveBeenCalledTimes(0);

              await verifyUnhandledMessageWarning(console.warn.mock.calls[0], { data: unmatchedMessage, platform });

              expect(client.readyState).toBe(WebSocketClient.OPEN);

              responsePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify(matchedMessage));
              await expect(responsePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

              expect(console.warn).toHaveBeenCalledTimes(1);
              expect(console.error).toHaveBeenCalledTimes(0);
            });
          });
        },
      );
    });

    // No WebSocket counterparts for the cases with unmocked paths and array search params: WebSocket handlers have
    // no per-handler path and messages have no search params.
  });

  describe.each([{ declarationType: 'static' as const }, { declarationType: 'factory' as const }])(
    'Logging disabled',
    ({ declarationType }) => {
      const log = false;

      const onUnhandledMessage: UnhandledMessageStrategy = declarationType === 'static' ? { log } : () => ({ log });

      it('should not show a warning when logging is disabled and messages are unhandled', async () => {
        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, onUnhandledMessage },
          async (interceptor) => {
            expect(interceptor.onUnhandledMessage).toBe(onUnhandledMessage);

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

                client.send(JSON.stringify({ type: 'client', index: 2 }));

                // Messages on a socket are handled in order, so the response to the matched message arriving means that
                // the unhandled message was handled without logging.
                const probeResponsePromise = waitForWebSocketClientMessage(client);
                client.send(JSON.stringify(matchedMessage));
                await expect(probeResponsePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

                expect(console.warn).toHaveBeenCalledTimes(0);
                expect(console.error).toHaveBeenCalledTimes(0);

                expect(client.readyState).toBe(WebSocketClient.OPEN);
              });
            });
          },
        );
      });
    },
  );

  // No WebSocket counterparts for the cases without interceptors or without an interceptor matching the base URL:
  // connections only open through a running interceptor with a matching base URL, so no message reaches one otherwise.

  it('should not log unhandled messages when the matched interceptor is not running', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, onUnhandledMessage: { log: true } },
      async (interceptor) => {
        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await usingIgnoredConsole(['warn', 'error'], async (console) => {
            const message: MessageSchema = { type: 'client', index: 1 };
            client.send(JSON.stringify(message));

            await waitFor(() => {
              expect(console.warn).toHaveBeenCalledTimes(1);
            });
            expect(console.error).toHaveBeenCalledTimes(0);

            await verifyUnhandledMessageWarning(console.warn.mock.calls[0], { data: message, platform });

            console.warn.mockClear();

            const closeEventPromise = waitForWebSocketClientClose(client);

            await interceptor.stop();

            // Stopping closes the connection, so no message can be handled after the close event.
            await closeEventPromise;

            client.send(JSON.stringify(message));

            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(0);
          });
        });
      },
    );
  });

  it('should support changing the unhandled message strategy after created', async () => {
    const initialOnUnhandledMessage: UnhandledMessageStrategy = { log: false };

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, onUnhandledMessage: initialOnUnhandledMessage },
      async (interceptor) => {
        expect(interceptor.onUnhandledMessage).toEqual(initialOnUnhandledMessage);

        await promiseIfRemote(
          interceptor.message().with({ type: 'client', index: 0 }).respond({ type: 'server', index: 0 }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const message: MessageSchema = { type: 'client', index: 1 };

          await usingIgnoredConsole(['warn', 'error'], async (console) => {
            client.send(JSON.stringify(message));

            // Messages on a socket are handled in order, so the probe response arriving means that the unhandled
            // message was handled with the initial strategy.
            const probeResponsePromise = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify({ type: 'client', index: 0 }));
            await expect(probeResponsePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 0 }));

            expect(console.warn).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(0);
          });

          const newOnUnhandledMessage: UnhandledMessageStrategy = { log: true };
          expect(initialOnUnhandledMessage).not.toEqual(newOnUnhandledMessage);

          interceptor.onUnhandledMessage = newOnUnhandledMessage;
          expect(interceptor.onUnhandledMessage).toEqual(newOnUnhandledMessage);

          await usingIgnoredConsole(['warn', 'error'], async (console) => {
            client.send(JSON.stringify(message));

            await waitFor(() => {
              expect(console.warn).toHaveBeenCalledTimes(1);
            });
            expect(console.error).toHaveBeenCalledTimes(0);

            await verifyUnhandledMessageWarning(console.warn.mock.calls[0], { data: message, platform });
          });
        });
      },
    );
  });
}
