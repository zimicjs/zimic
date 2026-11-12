import { waitFor } from '@zimic/utils/time';
import { createInvalidTypeOfCases, ValidationError } from '@zimic/utils/validation';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

type Message = { type: 'client'; index: number } | { type: 'server'; index: number };
type MessageSchema = WebSocketSchema<{ '/': { message: Message } }>;

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
              const message: Message = { type: 'client', index: 1 };
              client.send(JSON.stringify(message));

              await waitFor(() => {
                expect(console.warn).toHaveBeenCalledTimes(1);
              });
              expect(console.error).toHaveBeenCalledTimes(0);

              await verifyUnhandledMessageWarning(console.warn.mock.calls[0], {
                data: message,
                url: client.url,
                platform,
              });

              expect(client.readyState).toBe(WebSocketClient.OPEN);
            });
          });
        },
      );
    });

    it('should show a warning when logging is enabled and binary messages are unhandled', async () => {
      await usingWebSocketInterceptor<WebSocketSchema<{ '/': { message: ArrayBuffer } }>>(
        { ...interceptorOptions, onUnhandledMessage },
        async (interceptor) => {
          expect(interceptor.onUnhandledMessage).toBe(onUnhandledMessage);

          await usingWebSocketClient<WebSocketSchema<{ '/': { message: ArrayBuffer } }>>(baseURL, async (client) => {
            await usingIgnoredConsole(['warn', 'error'], async (console) => {
              const message = createBinaryMessage(1, 2);
              client.send(message);

              await waitFor(() => {
                expect(console.warn).toHaveBeenCalledTimes(1);
              });
              expect(console.error).toHaveBeenCalledTimes(0);

              await verifyUnhandledMessageWarning(console.warn.mock.calls[0], {
                data: message,
                url: client.url,
                platform,
              });

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

          const matchedMessage: Message = { type: 'client', index: 1 };

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

              const unmatchedMessage: Message = { type: 'client', index: 2 };
              client.send(JSON.stringify(unmatchedMessage));

              await waitFor(() => {
                expect(console.warn).toHaveBeenCalledTimes(1);
              });
              expect(console.error).toHaveBeenCalledTimes(0);

              await verifyUnhandledMessageWarning(console.warn.mock.calls[0], {
                data: unmatchedMessage,
                url: client.url,
                platform,
              });

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

    it('should show a warning when logging is enabled and messages are unhandled due to unmocked path', async () => {
      type PathKeyedSchema = WebSocketSchema<{
        '/rooms/:roomId': { message: Message };
        '/users/:userId': { message: Message };
      }>;

      await usingWebSocketInterceptor<PathKeyedSchema>(
        { ...interceptorOptions, onUnhandledMessage },
        async (interceptor) => {
          expect(interceptor.onUnhandledMessage).toBe(onUnhandledMessage);

          const message: Message = { type: 'client', index: 1 };

          await promiseIfRemote(
            interceptor.message('/rooms/:roomId').with(message).respond({ type: 'server', index: 1 }),
            interceptor,
          );

          await usingWebSocketClient<PathKeyedSchema>(`${baseURL}/rooms/1`, async (roomClient) => {
            await usingWebSocketClient<PathKeyedSchema>(`${baseURL}/users/1`, async (userClient) => {
              await usingIgnoredConsole(['warn', 'error'], async (console) => {
                const responsePromise = waitForWebSocketClientMessage(roomClient);
                roomClient.send(JSON.stringify(message));
                await expect(responsePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

                expect(console.warn).toHaveBeenCalledTimes(0);
                expect(console.error).toHaveBeenCalledTimes(0);

                userClient.send(JSON.stringify(message));

                await waitFor(() => {
                  expect(console.warn).toHaveBeenCalledTimes(1);
                });
                expect(console.error).toHaveBeenCalledTimes(0);

                await verifyUnhandledMessageWarning(console.warn.mock.calls[0], {
                  data: message,
                  url: userClient.url,
                  platform,
                });

                expect(userClient.readyState).toBe(WebSocketClient.OPEN);
              });
            });
          });
        },
      );
    });

    // No WebSocket counterpart for "should show a warning when logging is enabled and requests with array search params
    // are unhandled and bypassed": message warnings log the connection URL as received, without formatting its search
    // params.

    // No WebSocket counterpart for "should show an error when logging is enabled and requests with an unknown method are
    // unhandled and rejected": messages have no method.

    // No WebSocket counterpart for "should show an error when logging is enabled and requests with array search params
    // are unhandled and rejected": message warnings log the connection URL as received, without formatting its search
    // params.
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

            const matchedMessage: Message = { type: 'client', index: 1 };

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
            const message: Message = { type: 'client', index: 1 };
            client.send(JSON.stringify(message));

            await waitFor(() => {
              expect(console.warn).toHaveBeenCalledTimes(1);
            });
            expect(console.error).toHaveBeenCalledTimes(0);

            await verifyUnhandledMessageWarning(console.warn.mock.calls[0], {
              data: message,
              url: client.url,
              platform,
            });

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
          const message: Message = { type: 'client', index: 1 };

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

            await verifyUnhandledMessageWarning(console.warn.mock.calls[0], {
              data: message,
              url: client.url,
              platform,
            });
          });
        });
      },
    );
  });

  const invalidOnUnhandledMessages = createInvalidTypeOfCases(['object', 'function'], { optional: true });

  it.each(invalidOnUnhandledMessages)(
    'should throw an error if provided an unhandled message strategy that is not an object or a function ($label)',
    async ({ value, actualType }) => {
      const handler = vi.fn();

      // @ts-expect-error Forcing an invalid unhandled message strategy type.
      const invalidOnUnhandledMessage: UnhandledMessageStrategy = value;

      await expect(async () => {
        await usingWebSocketInterceptor(
          { ...interceptorOptions, onUnhandledMessage: invalidOnUnhandledMessage },
          handler,
        );
      }).rejects.toThrow(
        new ValidationError(`Expected options.onUnhandledMessage to be object or function, but got ${actualType}.`),
      );

      expect(handler).not.toHaveBeenCalled();
    },
  );

  // No WebSocket counterpart for "should throw an error if provided an unhandled request action that is not supported
  // ($label)": unhandled messages have no action.

  // No WebSocket counterpart for "should throw an error if provided a bypass unhandled request action in a remote
  // interceptor": unhandled messages have no action.

  const invalidUnhandledMessageLogs = createInvalidTypeOfCases('boolean', { optional: true });

  it.each(invalidUnhandledMessageLogs)(
    'should throw an error if provided an unhandled message log option that is not a boolean ($label)',
    async ({ value, actualType }) => {
      const handler = vi.fn();

      // @ts-expect-error Forcing an invalid unhandled message log option type.
      const invalidLog: boolean = value;

      await expect(async () => {
        await usingWebSocketInterceptor({ ...interceptorOptions, onUnhandledMessage: { log: invalidLog } }, handler);
      }).rejects.toThrow(
        new ValidationError(`Expected options.onUnhandledMessage.log to be boolean, but got ${actualType}.`),
      );

      expect(handler).not.toHaveBeenCalled();
    },
  );
}
