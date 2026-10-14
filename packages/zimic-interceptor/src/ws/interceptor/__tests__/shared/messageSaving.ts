import { waitFor } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import DisabledMessageSavingError from '@/ws/messageHandler/errors/DisabledMessageSavingError';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';

import MessageSavingSafeLimitExceededError from '../../errors/MessageSavingSafeLimitExceededError';
import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorMessageSaving, WebSocketInterceptorOptions } from '../../types/options';
import { DEFAULT_MESSAGE_SAVING_SAFE_LIMIT } from '../../WebSocketInterceptorImplementation';
import { RuntimeSharedWebSocketInterceptorTestsOptions, usingWebSocketClient, waitForWebSocketMessage } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareMessageSavingWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { platform, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it.each([{ NODE_ENV: 'development' }, { NODE_ENV: 'test' }, { NODE_ENV: 'production' }])(
    'should have the correct default message saving configuration if none is provided (NODE_ENV: $NODE_ENV)',
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

  it('should not warn if saved messages reach the safe limit without exceeding it', async () => {
    const safeLimit = 2;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await usingIgnoredConsole(['warn'], async (console) => {
            for (let index = 0; index < safeLimit; index++) {
              client.send(JSON.stringify({ type: 'client', index }));
            }

            await waitFor(() => {
              expect(handler.messages).toHaveLength(safeLimit);
            });

            expect(console.warn).toHaveBeenCalledTimes(0);
          });
        });
      },
    );
  });

  it('should not save or warn if message saving is disabled', async () => {
    const safeLimit = 2;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: false, safeLimit } },
      async (interceptor) => {
        expect(interceptor.messageSaving.enabled).toBe(false);
        expect(interceptor.messageSaving.safeLimit).toBe(safeLimit);

        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await usingIgnoredConsole(['warn'], async (console) => {
            const numberOfMessages = safeLimit + 1;

            for (let index = 0; index < numberOfMessages; index++) {
              const messagePromise = waitForWebSocketMessage(client);

              client.send(JSON.stringify({ type: 'client', index }));

              await expect(messagePromise).resolves.toEqual({ type: 'server', index: 1 });
            }

            expect(() => handler.messages).toThrow(new DisabledMessageSavingError());

            expect(console.warn).toHaveBeenCalledTimes(0);
          });
        });
      },
    );
  });

  it('should warn if saved messages exceed the safe limit', async () => {
    const safeLimit = 2;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await usingIgnoredConsole(['warn'], async (console) => {
            const numberOfMessages = safeLimit + 1;

            for (let index = 0; index < numberOfMessages; index++) {
              client.send(JSON.stringify({ type: 'client', index }));
            }

            await waitFor(() => {
              expect(handler.messages).toHaveLength(numberOfMessages);
            });

            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith(new MessageSavingSafeLimitExceededError(3, safeLimit));
          });
        });
      },
    );
  });

  it('should warn if saved messages exceed the safe limit considering the sum of all handlers', async () => {
    const safeLimit = 3;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
      async (interceptor) => {
        const firstHandler = await promiseIfRemote(
          interceptor.message().with({ type: 'client', index: 1 }).respond({ type: 'server', index: 1 }),
          interceptor,
        );
        const secondHandler = await promiseIfRemote(
          interceptor.message().with({ type: 'client', index: 2 }).respond({ type: 'server', index: 2 }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await usingIgnoredConsole(['warn'], async (console) => {
            client.send(JSON.stringify({ type: 'client', index: 1 }));
            client.send(JSON.stringify({ type: 'client', index: 2 }));
            client.send(JSON.stringify({ type: 'client', index: 1 }));
            client.send(JSON.stringify({ type: 'client', index: 2 }));

            await waitFor(() => {
              expect(firstHandler.messages).toHaveLength(2);
              expect(secondHandler.messages).toHaveLength(2);
            });

            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith(new MessageSavingSafeLimitExceededError(4, safeLimit));
          });
        });
      },
    );
  });

  it('should reset retained messages after handler reconfiguration and warn when the safe limit is exceeded again', async () => {
    const safeLimit = 1;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await usingIgnoredConsole(['warn'], async (console) => {
            for (let index = 0; index < 2; index++) {
              client.send(JSON.stringify({ type: 'client', index }));
            }

            await waitFor(() => {
              expect(handler.messages).toHaveLength(2);
            });

            expect(console.warn).toHaveBeenCalledTimes(1);

            const handlerMessages = handler.messages;
            const interceptorClient = interceptor.clients[0];
            const clientMessages = interceptorClient.messages;
            const serverMessages = interceptor.server.messages;

            await promiseIfRemote(handler.respond({ type: 'server', index: 2 }), interceptor);

            expect(handler.messages).toBe(handlerMessages);
            expect(handler.messages).toHaveLength(0);
            expect(interceptorClient.messages).toBe(clientMessages);
            expect(interceptorClient.messages).toHaveLength(0);
            expect(interceptor.server.messages).toBe(serverMessages);
            expect(interceptor.server.messages).toHaveLength(0);

            console.warn.mockClear();

            for (let index = 0; index < 2; index++) {
              client.send(JSON.stringify({ type: 'client', index }));
            }

            await waitFor(() => {
              expect(handler.messages).toHaveLength(2);
            });

            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith(new MessageSavingSafeLimitExceededError(2, safeLimit));
          });
        });
      },
    );
  });

  it('should retain disconnected client messages in safe-limit accounting', async () => {
    const safeLimit = 1;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

        let firstInterceptorClient!: (typeof interceptor.clients)[number];
        let firstClientMessages!: typeof firstInterceptorClient.messages;

        await usingWebSocketClient<MessageSchema>(baseURL, async (firstClient) => {
          firstClient.send(JSON.stringify({ type: 'client', index: 1 }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
            expect(interceptor.clients).toHaveLength(1);
          });

          firstInterceptorClient = interceptor.clients[0];
          firstClientMessages = firstInterceptorClient.messages;
        });

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(0);
        });

        expect(firstInterceptorClient.messages).toBe(firstClientMessages);
        expect(firstInterceptorClient.messages).toHaveLength(1);
        expect(interceptor.server.messages).toHaveLength(1);

        await usingIgnoredConsole(['warn'], async (console) => {
          await usingWebSocketClient<MessageSchema>(baseURL, async (secondClient) => {
            secondClient.send(JSON.stringify({ type: 'client', index: 2 }));

            await waitFor(() => {
              expect(handler.messages).toHaveLength(2);
            });

            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith(new MessageSavingSafeLimitExceededError(2, safeLimit));
          });
        });
      },
    );
  });

  it('should not show a warning if the number of saved messages does not exceed the safe limit due to interceptor clearing', async () => {
    const safeLimit = 2;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
      async (interceptor) => {
        expect(interceptor.messageSaving.enabled).toBe(true);
        expect(interceptor.messageSaving.safeLimit).toBe(safeLimit);

        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);
        expect(handler.messages).toHaveLength(0);

        await usingIgnoredConsole(['warn'], async (console) => {
          const numberOfMessages = safeLimit * 2;
          expect(numberOfMessages).toBeGreaterThan(safeLimit);

          for (let index = 0; index < numberOfMessages; index++) {
            await promiseIfRemote(interceptor.clear(), interceptor);
            await promiseIfRemote(handler.respond({ type: 'server', index: 1 }), interceptor);

            // Clearing drops the tracked clients, so each message needs a new connection.
            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              const messagePromise = waitForWebSocketMessage(client);

              client.send(JSON.stringify({ type: 'client', index }));

              await expect(messagePromise).resolves.toEqual({ type: 'server', index: 1 });
            });
          }

          expect(handler.messages).toHaveLength(1);

          expect(console.warn).toHaveBeenCalledTimes(0);
        });
      },
    );
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
            const messagePromise = waitForWebSocketMessage(client);

            client.send(JSON.stringify({ type: 'client', index }));

            await expect(messagePromise).resolves.toEqual({ type: 'server', index: 1 });
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
            const messagePromise = waitForWebSocketMessage(client);

            client.send(JSON.stringify({ type: 'client', index }));

            await expect(messagePromise).resolves.toEqual({ type: 'server', index: 1 });
          }

          expect(handler.messages).toHaveLength(numberOfMessages);
        });
      },
    );
  });
}
