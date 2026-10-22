import { waitFor } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DisabledMessageSavingError from '@/ws/messageHandler/errors/DisabledMessageSavingError';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import { usingWebSocketClient, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import MessageSavingSafeLimitExceededError from '../../errors/MessageSavingSafeLimitExceededError';
import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorOptions } from '../../types/options';
import { WebSocketInterceptorMessageSaving } from '../../types/public';
import { DEFAULT_MESSAGE_SAVING_SAFE_LIMIT } from '../../WebSocketInterceptorImplementation';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareMessageSavingWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { platform, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  describe('Enabled', () => {
    it.each([{ NODE_ENV: 'development' }, { NODE_ENV: 'test' }, { NODE_ENV: 'production' }])(
      'should have the correct default message saving configuration if none is provided (NODE_ENV: %s)',
      (environment) => {
        const processEnvSpy = vi.spyOn(process, 'env', 'get').mockReturnValue(environment);

        try {
          const interceptor = createWebSocketInterceptor<MessageSchema>({
            ...interceptorOptions,
            messageSaving: undefined,
          });

          expect(interceptor.messageSaving).toEqual<WebSocketInterceptorMessageSaving>({
            enabled: platform === 'node' && environment.NODE_ENV === 'test',
            safeLimit: DEFAULT_MESSAGE_SAVING_SAFE_LIMIT,
          });
        } finally {
          processEnvSpy.mockRestore();
        }
      },
    );

    it('should save intercepted messages if enabled', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true } },
        async (interceptor) => {
          expect(interceptor.messageSaving.enabled).toBe(true);

          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'server', index: 1 }),
            interceptor,
          );
          expect(handler.messages).toHaveLength(0);

          const serverMessages = interceptor.server.messages;
          const numberOfMessages = 5;

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(1);
            });

            const [clientHandle] = interceptor.clients;
            const clientMessages = clientHandle.messages;

            for (let index = 0; index < numberOfMessages; index++) {
              const messagePromise = waitForWebSocketClientMessage(client);

              client.send(JSON.stringify({ type: 'client', index }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
            }

            expect(handler.messages).toHaveLength(numberOfMessages);

            expect(interceptor.server.messages).toBe(serverMessages);
            expect(serverMessages).toHaveLength(numberOfMessages);

            expect(clientHandle.messages).toBe(clientMessages);
            expect(clientMessages).toHaveLength(numberOfMessages);
          });
        },
      );
    });

    it('should not save intercepted messages if disabled', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: false } },
        async (interceptor) => {
          expect(interceptor.messageSaving.enabled).toBe(false);

          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'server', index: 1 }),
            interceptor,
          );

          const error = new DisabledMessageSavingError();

          expect(() => handler.messages).toThrow(error);

          const numberOfMessages = 5;

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            for (let index = 0; index < numberOfMessages; index++) {
              const messagePromise = waitForWebSocketClientMessage(client);

              client.send(JSON.stringify({ type: 'client', index }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
            }

            expect(() => handler.messages).toThrow(error);
          });
        },
      );
    });
  });

  describe('Safe limit', () => {
    const safeLimit = 5;

    it('should not show a warning if messages are not being saved, even if the safe limit would be exceeded if so', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: false, safeLimit } },
        async (interceptor) => {
          expect(interceptor.messageSaving.enabled).toBe(false);
          expect(interceptor.messageSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'server', index: 1 }),
            interceptor,
          );

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            await usingIgnoredConsole(['warn'], async (console) => {
              const numberOfMessages = safeLimit * 2;
              expect(numberOfMessages).toBeGreaterThan(safeLimit);

              for (let index = 0; index < numberOfMessages; index++) {
                const messagePromise = waitForWebSocketClientMessage(client);

                client.send(JSON.stringify({ type: 'client', index }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
              }

              expect(() => handler.messages).toThrow(new DisabledMessageSavingError());

              expect(console.warn).toHaveBeenCalledTimes(0);
            });
          });
        },
      );
    });

    it('should not show a warning if the number of saved messages is below the safe limit', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          expect(interceptor.messageSaving.enabled).toBe(true);
          expect(interceptor.messageSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'server', index: 1 }),
            interceptor,
          );
          expect(handler.messages).toHaveLength(0);

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            await usingIgnoredConsole(['warn'], async (console) => {
              const numberOfMessages = safeLimit - 1;
              expect(numberOfMessages).toBeLessThan(safeLimit);

              for (let index = 0; index < numberOfMessages; index++) {
                const messagePromise = waitForWebSocketClientMessage(client);

                client.send(JSON.stringify({ type: 'client', index }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
              }

              expect(handler.messages).toHaveLength(numberOfMessages);

              expect(console.warn).toHaveBeenCalledTimes(0);
            });
          });
        },
      );
    });

    it('should not show a warning if the number of saved messages reaches the safe limit', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          expect(interceptor.messageSaving.enabled).toBe(true);
          expect(interceptor.messageSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'server', index: 1 }),
            interceptor,
          );
          expect(handler.messages).toHaveLength(0);

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            await usingIgnoredConsole(['warn'], async (console) => {
              const numberOfMessages = safeLimit;
              expect(numberOfMessages).toBe(safeLimit);

              for (let index = 0; index < numberOfMessages; index++) {
                const messagePromise = waitForWebSocketClientMessage(client);

                client.send(JSON.stringify({ type: 'client', index }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
              }

              expect(handler.messages).toHaveLength(numberOfMessages);

              expect(console.warn).toHaveBeenCalledTimes(0);
            });
          });
        },
      );
    });

    it('should show a warning if the number of saved messages exceeds the safe limit', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          expect(interceptor.messageSaving.enabled).toBe(true);
          expect(interceptor.messageSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'server', index: 1 }),
            interceptor,
          );
          expect(handler.messages).toHaveLength(0);

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            await usingIgnoredConsole(['warn'], async (console) => {
              const numberOfMessages = safeLimit * 2;
              expect(numberOfMessages).toBeGreaterThan(safeLimit);

              for (let index = 0; index < numberOfMessages; index++) {
                const messagePromise = waitForWebSocketClientMessage(client);

                client.send(JSON.stringify({ type: 'client', index }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
              }

              expect(handler.messages).toHaveLength(numberOfMessages);

              const numberOfExceedingMessages = numberOfMessages - safeLimit;
              expect(console.warn).toHaveBeenCalledTimes(numberOfExceedingMessages);

              for (const [index, call] of console.warn.mock.calls.entries()) {
                const numberOfSavedMessagesAtCall = safeLimit + index + 1;
                const error = new MessageSavingSafeLimitExceededError(numberOfSavedMessagesAtCall, safeLimit);
                expect(call).toEqual([error]);
              }
            });
          });
        },
      );
    });

    it('should show a warning if the number of saved messages exceeds the safe limit, considering the sum of all handlers', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          expect(interceptor.messageSaving.enabled).toBe(true);
          expect(interceptor.messageSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(
            interceptor.message().with({ type: 'client', index: 1 }).respond({ type: 'server', index: 1 }),
            interceptor,
          );
          expect(handler.messages).toHaveLength(0);

          const otherHandler = await promiseIfRemote(
            interceptor.message().with({ type: 'client', index: 2 }).respond({ type: 'server', index: 2 }),
            interceptor,
          );
          expect(otherHandler.messages).toHaveLength(0);

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            await usingIgnoredConsole(['warn'], async (console) => {
              const numberOfMessagesPerHandler = safeLimit - 1;
              expect(numberOfMessagesPerHandler).toBeLessThan(safeLimit);

              const numberOfMessages = numberOfMessagesPerHandler * 2;
              expect(numberOfMessages).toBeGreaterThan(safeLimit);

              for (let index = 0; index < numberOfMessagesPerHandler; index++) {
                const messagePromise = waitForWebSocketClientMessage(client);
                client.send(JSON.stringify({ type: 'client', index: 1 }));
                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

                const otherMessagePromise = waitForWebSocketClientMessage(client);
                client.send(JSON.stringify({ type: 'client', index: 2 }));
                await expect(otherMessagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
              }

              expect(handler.messages).toHaveLength(numberOfMessagesPerHandler);
              expect(otherHandler.messages).toHaveLength(numberOfMessagesPerHandler);

              const numberOfExceedingMessages = numberOfMessages - safeLimit;
              expect(console.warn).toHaveBeenCalledTimes(numberOfExceedingMessages);

              for (const [index, call] of console.warn.mock.calls.entries()) {
                const numberOfSavedMessagesAtCall = safeLimit + index + 1;
                const error = new MessageSavingSafeLimitExceededError(numberOfSavedMessagesAtCall, safeLimit);
                expect(call).toEqual([error]);
              }
            });
          });
        },
      );
    });

    it('should not show a warning if the number of saved messages does not exceed the safe limit due to interceptor clearing', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          expect(interceptor.messageSaving.enabled).toBe(true);
          expect(interceptor.messageSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(interceptor.message(), interceptor);
          expect(handler.messages).toHaveLength(0);

          await usingIgnoredConsole(['warn'], async (console) => {
            const numberOfMessages = safeLimit * 2;
            expect(numberOfMessages).toBeGreaterThan(safeLimit);

            for (let index = 0; index < numberOfMessages; index++) {
              await promiseIfRemote(interceptor.clear(), interceptor);
              await promiseIfRemote(handler.respond({ type: 'server', index: 1 }), interceptor);

              // Clearing the interceptor drops its tracked clients, so each message needs a new connection.
              await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
                const messagePromise = waitForWebSocketClientMessage(client);

                client.send(JSON.stringify({ type: 'client', index }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
              });
            }

            expect(handler.messages).toHaveLength(1);

            expect(console.warn).toHaveBeenCalledTimes(0);
          });
        },
      );
    });

    it('should not show a warning if the number of saved messages does not exceed the safe limit due to handler clearing', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          expect(interceptor.messageSaving.enabled).toBe(true);
          expect(interceptor.messageSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(interceptor.message(), interceptor);
          expect(handler.messages).toHaveLength(0);

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            await usingIgnoredConsole(['warn'], async (console) => {
              const numberOfMessages = safeLimit * 2;
              expect(numberOfMessages).toBeGreaterThan(safeLimit);

              for (let index = 0; index < numberOfMessages; index++) {
                await promiseIfRemote(handler.clear(), handler);
                await promiseIfRemote(handler.respond({ type: 'server', index: 1 }), interceptor);

                const messagePromise = waitForWebSocketClientMessage(client);

                client.send(JSON.stringify({ type: 'client', index }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
              }

              expect(handler.messages).toHaveLength(1);

              expect(console.warn).toHaveBeenCalledTimes(0);
            });
          });
        },
      );
    });

    it('should not show a warning if the number of saved messages does not exceed the safe limit due to new response declarations', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          expect(interceptor.messageSaving.enabled).toBe(true);
          expect(interceptor.messageSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(interceptor.message(), interceptor);
          expect(handler.messages).toHaveLength(0);

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            await usingIgnoredConsole(['warn'], async (console) => {
              const numberOfMessages = safeLimit * 2;
              expect(numberOfMessages).toBeGreaterThan(safeLimit);

              for (let index = 0; index < numberOfMessages; index++) {
                await promiseIfRemote(handler.respond({ type: 'server', index: 1 }), interceptor);

                const messagePromise = waitForWebSocketClientMessage(client);

                client.send(JSON.stringify({ type: 'client', index }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
              }

              expect(handler.messages).toHaveLength(1);

              expect(console.warn).toHaveBeenCalledTimes(0);
            });
          });
        },
      );
    });

    // Connections are long-lived, so messages from a disconnected client stay saved and count toward the limit.
    it('should show a warning if the number of saved messages exceeds the safe limit, considering disconnected clients', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'server', index: 1 }),
            interceptor,
          );

          await usingIgnoredConsole(['warn'], async (console) => {
            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              for (let index = 0; index < safeLimit; index++) {
                const messagePromise = waitForWebSocketClientMessage(client);

                client.send(JSON.stringify({ type: 'client', index }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
              }
            });

            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(0);
            });

            expect(handler.messages).toHaveLength(safeLimit);
            expect(console.warn).toHaveBeenCalledTimes(0);

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              const messagePromise = waitForWebSocketClientMessage(client);

              client.send(JSON.stringify({ type: 'client', index: safeLimit }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
            });

            expect(handler.messages).toHaveLength(safeLimit + 1);

            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith(
              new MessageSavingSafeLimitExceededError(safeLimit + 1, safeLimit),
            );
          });
        },
      );
    });
  });

  it('should support changing the message saving configuration after created', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

        expect(interceptor.messageSaving).toEqual<WebSocketInterceptorMessageSaving>({
          enabled: true,
          safeLimit: DEFAULT_MESSAGE_SAVING_SAFE_LIMIT,
        });

        interceptor.messageSaving.enabled = false;

        expect(interceptor.messageSaving).toEqual<WebSocketInterceptorMessageSaving>({
          enabled: false,
          safeLimit: DEFAULT_MESSAGE_SAVING_SAFE_LIMIT,
        });

        interceptor.messageSaving.safeLimit = 500;

        expect(interceptor.messageSaving).toEqual<WebSocketInterceptorMessageSaving>({
          enabled: false,
          safeLimit: 500,
        });

        const error = new DisabledMessageSavingError();

        expect(() => handler.messages).toThrow(error);

        const numberOfMessages = 5;

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          for (let index = 0; index < numberOfMessages; index++) {
            const messagePromise = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'client', index }));

            await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
          }

          expect(() => handler.messages).toThrow(error);

          expect(interceptor.messageSaving).toEqual<WebSocketInterceptorMessageSaving>({
            enabled: false,
            safeLimit: 500,
          });

          interceptor.messageSaving = { enabled: true, safeLimit: 1500 };

          expect(interceptor.messageSaving).toEqual<WebSocketInterceptorMessageSaving>({
            enabled: true,
            safeLimit: 1500,
          });

          expect(handler.messages).toHaveLength(0);

          for (let index = 0; index < numberOfMessages; index++) {
            const messagePromise = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'client', index }));

            await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
          }

          expect(handler.messages).toHaveLength(numberOfMessages);
        });
      },
    );
  });
}
