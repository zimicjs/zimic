import { HttpSearchParams } from '@zimic/utils/http';
import { waitFor } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DisabledConnectionSavingError from '@/ws/connectionHandler/errors/DisabledConnectionSavingError';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import {
  expectWebSocketConnectionToBeRefused,
  expectWebSocketConnectionToOpen,
  usingWebSocketClient,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import ConnectionSavingSafeLimitExceededError from '../../errors/ConnectionSavingSafeLimitExceededError';
import MessageSavingSafeLimitExceededError from '../../errors/MessageSavingSafeLimitExceededError';
import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorOptions } from '../../types/options';
import { WebSocketInterceptorConnectionSaving } from '../../types/public';
import { DEFAULT_CONNECTION_SAVING_SAFE_LIMIT } from '../../WebSocketInterceptorImplementation';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type Message = { type: 'client'; index: number } | { type: 'server'; index: number };

type MessageSchema = WebSocketSchema<{
  '/': { message: Message };
  '/accepted': { connection: { protocols: 'chat' }; message: Message };
  '/rejected': { message: Message };
  '/first': { message: Message };
  '/second': { message: Message };
}>;

export function declareConnectionSavingWebSocketInterceptorTests(
  options: RuntimeSharedWebSocketInterceptorTestsOptions,
) {
  const { platform, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  describe('Enabled', () => {
    it.each([{ NODE_ENV: 'development' }, { NODE_ENV: 'test' }, { NODE_ENV: 'production' }])(
      'should have the correct default connection saving configuration if none is provided (NODE_ENV: %s)',
      (environment) => {
        const processEnvSpy = vi.spyOn(process, 'env', 'get').mockReturnValue(environment);

        try {
          const interceptor = createWebSocketInterceptor<MessageSchema>({
            ...interceptorOptions,
            connectionSaving: undefined,
          });

          expect(interceptor.connectionSaving).toEqual<WebSocketInterceptorConnectionSaving>({
            enabled: platform === 'node' && environment.NODE_ENV === 'test',
            safeLimit: DEFAULT_CONNECTION_SAVING_SAFE_LIMIT,
          });
          expect(interceptor.connectionSaving).toEqual(interceptor.messageSaving);
        } finally {
          processEnvSpy.mockRestore();
        }
      },
    );

    it('should save intercepted connections if enabled', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true } },
        async (interceptor) => {
          expect(interceptor.connectionSaving.enabled).toBe(true);

          const acceptingHandler = await promiseIfRemote(interceptor.connection('/accepted'), interceptor);
          expect(acceptingHandler.connections).toHaveLength(0);

          const rejectingHandler = await promiseIfRemote(
            interceptor.connection('/rejected').respond({ action: 'reject' }),
            interceptor,
          );
          expect(rejectingHandler.connections).toHaveLength(0);

          await expectWebSocketConnectionToOpen(`${baseURL}/accepted`, ['chat']);
          await expectWebSocketConnectionToBeRefused(`${baseURL}/rejected`);

          expect(acceptingHandler.connections).toEqual([
            {
              url: new URL(`${baseURL}/accepted`).href,
              protocols: ['chat'],
              searchParams: new HttpSearchParams(),
              pathParams: {},
            },
          ]);
          expect(rejectingHandler.connections).toEqual([
            {
              url: new URL(`${baseURL}/rejected`).href,
              protocols: [],
              searchParams: new HttpSearchParams(),
              pathParams: {},
            },
          ]);
        },
      );
    });

    it('should not save intercepted connections if disabled', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: false } },
        async (interceptor) => {
          expect(interceptor.connectionSaving.enabled).toBe(false);

          const handler = await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }), interceptor);

          const error = new DisabledConnectionSavingError();
          expect(() => handler.connections).toThrow(error);

          await expectWebSocketConnectionToBeRefused(baseURL);

          expect(() => handler.connections).toThrow(error);

          interceptor.connectionSaving.enabled = true;
          expect(handler.connections).toHaveLength(0);
        },
      );
    });

    it('should save intercepted connections if message saving is disabled', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true }, messageSaving: { enabled: false } },
        async (interceptor) => {
          const handler = await promiseIfRemote(interceptor.connection(), interceptor);

          await expectWebSocketConnectionToOpen(baseURL);

          expect(handler.connections).toHaveLength(1);
        },
      );
    });

    it('should save intercepted messages if connection saving is disabled', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: false }, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'server', index: 1 }),
            interceptor,
          );

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            const messagePromise = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'client', index: 0 }));

            await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
          });

          expect(handler.messages).toHaveLength(1);
        },
      );
    });
  });

  describe('Safe limit', () => {
    const safeLimit = 5;

    it('should not show a warning if connections are not being saved, even if the safe limit would be exceeded if so', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: false, safeLimit } },
        async (interceptor) => {
          expect(interceptor.connectionSaving.enabled).toBe(false);
          expect(interceptor.connectionSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(interceptor.connection(), interceptor);

          await usingIgnoredConsole(['warn'], async (console) => {
            const numberOfConnections = safeLimit * 2;
            expect(numberOfConnections).toBeGreaterThan(safeLimit);

            for (let index = 0; index < numberOfConnections; index++) {
              await expectWebSocketConnectionToOpen(baseURL);
            }

            expect(() => handler.connections).toThrow(new DisabledConnectionSavingError());

            expect(console.warn).toHaveBeenCalledTimes(0);
          });
        },
      );
    });

    it('should not show a warning if the number of saved connections is below the safe limit', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          expect(interceptor.connectionSaving.enabled).toBe(true);
          expect(interceptor.connectionSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(interceptor.connection(), interceptor);
          expect(handler.connections).toHaveLength(0);

          await usingIgnoredConsole(['warn'], async (console) => {
            const numberOfConnections = safeLimit - 1;
            expect(numberOfConnections).toBeLessThan(safeLimit);

            for (let index = 0; index < numberOfConnections; index++) {
              await expectWebSocketConnectionToOpen(baseURL);
            }

            expect(handler.connections).toHaveLength(numberOfConnections);

            expect(console.warn).toHaveBeenCalledTimes(0);
          });
        },
      );
    });

    it('should not show a warning if the number of saved connections reaches the safe limit', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          expect(interceptor.connectionSaving.enabled).toBe(true);
          expect(interceptor.connectionSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(interceptor.connection(), interceptor);
          expect(handler.connections).toHaveLength(0);

          await usingIgnoredConsole(['warn'], async (console) => {
            const numberOfConnections = safeLimit;
            expect(numberOfConnections).toBe(safeLimit);

            for (let index = 0; index < numberOfConnections; index++) {
              await expectWebSocketConnectionToOpen(baseURL);
            }

            expect(handler.connections).toHaveLength(numberOfConnections);

            expect(console.warn).toHaveBeenCalledTimes(0);
          });
        },
      );
    });

    it('should show a warning if the number of saved connections exceeds the safe limit', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          expect(interceptor.connectionSaving.enabled).toBe(true);
          expect(interceptor.connectionSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(interceptor.connection(), interceptor);
          expect(handler.connections).toHaveLength(0);

          await usingIgnoredConsole(['warn'], async (console) => {
            const numberOfConnections = safeLimit * 2;
            expect(numberOfConnections).toBeGreaterThan(safeLimit);

            for (let index = 0; index < numberOfConnections; index++) {
              await expectWebSocketConnectionToOpen(baseURL);
            }

            expect(handler.connections).toHaveLength(numberOfConnections);

            const numberOfExceedingConnections = numberOfConnections - safeLimit;
            expect(console.warn).toHaveBeenCalledTimes(numberOfExceedingConnections);

            for (const [index, call] of console.warn.mock.calls.entries()) {
              const numberOfSavedConnectionsAtCall = safeLimit + index + 1;
              const error = new ConnectionSavingSafeLimitExceededError(numberOfSavedConnectionsAtCall, safeLimit);
              expect(call).toEqual([error]);
            }
          });
        },
      );
    });

    it('should show a warning if the number of saved connections exceeds the safe limit, considering the sum of all handlers', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          expect(interceptor.connectionSaving.enabled).toBe(true);
          expect(interceptor.connectionSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(interceptor.connection('/first'), interceptor);
          expect(handler.connections).toHaveLength(0);

          const otherHandler = await promiseIfRemote(interceptor.connection('/second'), interceptor);
          expect(otherHandler.connections).toHaveLength(0);

          await usingIgnoredConsole(['warn'], async (console) => {
            const numberOfConnectionsPerHandler = safeLimit - 1;
            expect(numberOfConnectionsPerHandler).toBeLessThan(safeLimit);

            const numberOfConnections = numberOfConnectionsPerHandler * 2;
            expect(numberOfConnections).toBeGreaterThan(safeLimit);

            for (let index = 0; index < numberOfConnectionsPerHandler; index++) {
              await expectWebSocketConnectionToOpen(`${baseURL}/first`);
              await expectWebSocketConnectionToOpen(`${baseURL}/second`);
            }

            expect(handler.connections).toHaveLength(numberOfConnectionsPerHandler);
            expect(otherHandler.connections).toHaveLength(numberOfConnectionsPerHandler);

            const numberOfExceedingConnections = numberOfConnections - safeLimit;
            expect(console.warn).toHaveBeenCalledTimes(numberOfExceedingConnections);

            for (const [index, call] of console.warn.mock.calls.entries()) {
              const numberOfSavedConnectionsAtCall = safeLimit + index + 1;
              const error = new ConnectionSavingSafeLimitExceededError(numberOfSavedConnectionsAtCall, safeLimit);
              expect(call).toEqual([error]);
            }
          });
        },
      );
    });

    it('should not show a warning if the number of saved connections does not exceed the safe limit due to interceptor clearing', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          expect(interceptor.connectionSaving.enabled).toBe(true);
          expect(interceptor.connectionSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(interceptor.connection(), interceptor);
          expect(handler.connections).toHaveLength(0);

          await usingIgnoredConsole(['warn'], async (console) => {
            const numberOfConnections = safeLimit * 2;
            expect(numberOfConnections).toBeGreaterThan(safeLimit);

            for (let index = 0; index < numberOfConnections; index++) {
              await promiseIfRemote(interceptor.clear(), interceptor);
              await promiseIfRemote(handler.respond({ action: 'accept' }), interceptor);

              await expectWebSocketConnectionToOpen(baseURL);
            }

            expect(handler.connections).toHaveLength(1);

            expect(console.warn).toHaveBeenCalledTimes(0);
          });
        },
      );
    });

    it('should not show a warning if the number of saved connections does not exceed the safe limit due to handler clearing', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          expect(interceptor.connectionSaving.enabled).toBe(true);
          expect(interceptor.connectionSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(interceptor.connection(), interceptor);
          expect(handler.connections).toHaveLength(0);

          await usingIgnoredConsole(['warn'], async (console) => {
            const numberOfConnections = safeLimit * 2;
            expect(numberOfConnections).toBeGreaterThan(safeLimit);

            for (let index = 0; index < numberOfConnections; index++) {
              await promiseIfRemote(handler.clear(), handler);
              await promiseIfRemote(handler.respond({ action: 'accept' }), interceptor);

              await expectWebSocketConnectionToOpen(baseURL);
            }

            expect(handler.connections).toHaveLength(1);

            expect(console.warn).toHaveBeenCalledTimes(0);
          });
        },
      );
    });

    it('should not show a warning if the number of saved connections does not exceed the safe limit due to new response declarations', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          expect(interceptor.connectionSaving.enabled).toBe(true);
          expect(interceptor.connectionSaving.safeLimit).toBe(safeLimit);

          const handler = await promiseIfRemote(interceptor.connection(), interceptor);
          expect(handler.connections).toHaveLength(0);

          await usingIgnoredConsole(['warn'], async (console) => {
            const numberOfConnections = safeLimit * 2;
            expect(numberOfConnections).toBeGreaterThan(safeLimit);

            for (let index = 0; index < numberOfConnections; index++) {
              await promiseIfRemote(handler.respond({ action: 'accept' }), interceptor);

              await expectWebSocketConnectionToOpen(baseURL);
            }

            expect(handler.connections).toHaveLength(1);

            expect(console.warn).toHaveBeenCalledTimes(0);
          });
        },
      );
    });

    // Connections are long-lived, so connections from a disconnected client stay saved and count toward the limit.
    it('should show a warning if the number of saved connections exceeds the safe limit, considering disconnected clients', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          const handler = await promiseIfRemote(interceptor.connection(), interceptor);

          await usingIgnoredConsole(['warn'], async (console) => {
            for (let index = 0; index < safeLimit; index++) {
              await expectWebSocketConnectionToOpen(baseURL);
            }

            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(0);
            });

            expect(handler.connections).toHaveLength(safeLimit);
            expect(console.warn).toHaveBeenCalledTimes(0);

            await expectWebSocketConnectionToOpen(baseURL);

            expect(handler.connections).toHaveLength(safeLimit + 1);

            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith(
              new ConnectionSavingSafeLimitExceededError(safeLimit + 1, safeLimit),
            );
          });
        },
      );
    });

    it('should show a warning if the number of saved connections exceeds the safe limit, ignoring saved messages', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        {
          ...interceptorOptions,
          connectionSaving: { enabled: true, safeLimit },
          messageSaving: { enabled: true, safeLimit: safeLimit * 2 },
        },
        async (interceptor) => {
          await promiseIfRemote(interceptor.connection(), interceptor);
          await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

          await usingIgnoredConsole(['warn'], async (console) => {
            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              for (let index = 0; index < safeLimit; index++) {
                const messagePromise = waitForWebSocketClientMessage(client);

                client.send(JSON.stringify({ type: 'client', index }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
              }
            });

            const numberOfOtherConnections = safeLimit - 1;

            for (let index = 0; index < numberOfOtherConnections; index++) {
              await expectWebSocketConnectionToOpen(baseURL);
            }

            expect(console.warn).toHaveBeenCalledTimes(0);

            await expectWebSocketConnectionToOpen(baseURL);

            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith(
              new ConnectionSavingSafeLimitExceededError(safeLimit + 1, safeLimit),
            );
          });
        },
      );
    });

    it('should show a warning if the number of saved messages exceeds the safe limit, ignoring saved connections', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        {
          ...interceptorOptions,
          connectionSaving: { enabled: true, safeLimit: safeLimit * 2 },
          messageSaving: { enabled: true, safeLimit },
        },
        async (interceptor) => {
          await promiseIfRemote(interceptor.connection(), interceptor);
          await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

          await usingIgnoredConsole(['warn'], async (console) => {
            for (let index = 0; index < safeLimit; index++) {
              await expectWebSocketConnectionToOpen(baseURL);
            }

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              const numberOfMessages = safeLimit + 1;

              for (let index = 0; index < numberOfMessages; index++) {
                expect(console.warn).toHaveBeenCalledTimes(0);

                const messagePromise = waitForWebSocketClientMessage(client);

                client.send(JSON.stringify({ type: 'client', index }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
              }
            });

            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith(
              new MessageSavingSafeLimitExceededError(safeLimit + 1, safeLimit),
            );
          });
        },
      );
    });
  });

  it('should support changing the connection saving configuration after created', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, connectionSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.connection(), interceptor);

        expect(interceptor.connectionSaving).toEqual<WebSocketInterceptorConnectionSaving>({
          enabled: true,
          safeLimit: DEFAULT_CONNECTION_SAVING_SAFE_LIMIT,
        });

        interceptor.connectionSaving.enabled = false;

        expect(interceptor.connectionSaving).toEqual<WebSocketInterceptorConnectionSaving>({
          enabled: false,
          safeLimit: DEFAULT_CONNECTION_SAVING_SAFE_LIMIT,
        });

        interceptor.connectionSaving.safeLimit = 500;

        expect(interceptor.connectionSaving).toEqual<WebSocketInterceptorConnectionSaving>({
          enabled: false,
          safeLimit: 500,
        });

        const error = new DisabledConnectionSavingError();

        expect(() => handler.connections).toThrow(error);

        const numberOfConnections = 5;

        for (let index = 0; index < numberOfConnections; index++) {
          await expectWebSocketConnectionToOpen(baseURL);
        }

        expect(() => handler.connections).toThrow(error);

        expect(interceptor.connectionSaving).toEqual<WebSocketInterceptorConnectionSaving>({
          enabled: false,
          safeLimit: 500,
        });

        interceptor.connectionSaving = { enabled: true, safeLimit: 1500 };

        expect(interceptor.connectionSaving).toEqual<WebSocketInterceptorConnectionSaving>({
          enabled: true,
          safeLimit: 1500,
        });

        expect(handler.connections).toHaveLength(0);

        for (let index = 0; index < numberOfConnections; index++) {
          await expectWebSocketConnectionToOpen(baseURL);
        }

        expect(handler.connections).toHaveLength(numberOfConnections);
      },
    );
  });
}
