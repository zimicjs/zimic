import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import { usingIgnoredConsole } from '@tests/utils/console';
import { createInternalWebSocketInterceptor, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import {
  usingWebSocketClient,
  waitForWebSocketClientClose,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import {
  LocalWebSocketMessageHandler,
  SyncedRemoteWebSocketMessageHandler,
} from '../../../messageHandler/types/public';
import NotRunningWebSocketInterceptorError from '../../errors/NotRunningWebSocketInterceptorError';
import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareLifeCycleWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions, startServer, stopServer } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should ignore all handlers after restarted when intercepting messages', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);
        expect(handler.messages).toHaveLength(0);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
        });

        expect(handler.messages).toHaveLength(1);

        expect(interceptor.isRunning).toBe(true);
        await interceptor.stop();
        expect(interceptor.isRunning).toBe(false);

        expect(handler.messages).toHaveLength(0);

        await interceptor.start();
        expect(interceptor.isRunning).toBe(true);

        await promiseIfRemote(
          interceptor.message().with({ type: 'client', index: 0 }).respond({ type: 'server', index: 0 }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const probeResponse = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'client', index: 2 }));

          // Messages on a socket are delivered in order, so the probe response arriving first means that the handler
          // declared before the restart sent no response.
          client.send(JSON.stringify({ type: 'client', index: 0 }));

          await expect(probeResponse).resolves.toBe(JSON.stringify({ type: 'server', index: 0 }));
        });

        expect(handler.messages).toHaveLength(0);
      },
    );
  });

  it('should ignore all handlers after restarted when intercepting messages, even if another interceptor is still running', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);
        expect(handler.messages).toHaveLength(0);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
        });

        expect(handler.messages).toHaveLength(1);

        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, baseURL: `${baseURL}/other` },
          async (otherInterceptor) => {
            expect(interceptor.isRunning).toBe(true);
            expect(otherInterceptor.isRunning).toBe(true);

            await interceptor.stop();
            expect(interceptor.isRunning).toBe(false);
            expect(otherInterceptor.isRunning).toBe(true);

            expect(handler.messages).toHaveLength(0);

            await interceptor.start();
            expect(interceptor.isRunning).toBe(true);
            expect(otherInterceptor.isRunning).toBe(true);

            await promiseIfRemote(
              interceptor.message().with({ type: 'client', index: 0 }).respond({ type: 'server', index: 0 }),
              interceptor,
            );

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              const probeResponse = waitForWebSocketClientMessage(client);

              client.send(JSON.stringify({ type: 'client', index: 2 }));

              // Messages on a socket are delivered in order, so the probe response arriving first means that the
              // handler declared before the restart sent no response.
              client.send(JSON.stringify({ type: 'client', index: 0 }));

              await expect(probeResponse).resolves.toBe(JSON.stringify({ type: 'server', index: 0 }));
            });

            expect(handler.messages).toHaveLength(0);
          },
        );
      },
    );
  });

  it('should intercept messages with the newest handler if a restarted interceptor with the same base URL declares an older one', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, messageSaving: { enabled: true } },
          async (otherInterceptor) => {
            await interceptor.stop();
            await interceptor.start();

            const handler = await promiseIfRemote(
              interceptor.message().respond({ type: 'server', index: 2 }),
              interceptor,
            );

            const otherHandler = await promiseIfRemote(
              otherInterceptor.message().respond({ type: 'server', index: 1 }),
              otherInterceptor,
            );

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
              const messagePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
            });

            expect(handler.messages).toHaveLength(0);
            expect(otherHandler.messages).toHaveLength(1);
          },
        );
      },
    );
  });

  it('should not log a warning when stopped', async () => {
    await usingIgnoredConsole(['warn'], async (console) => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await interceptor.stop();
        expect(interceptor.isRunning).toBe(false);
      });

      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  // Only remote interceptors connect to an interceptor server, and browser tests cannot stop their shared server.
  if (type === 'remote' && platform === 'node') {
    it('should log a warning once if the interceptor server stops while running', async () => {
      await usingIgnoredConsole(['warn'], async (console) => {
        // Interceptors with the same server share one connection, so they should log a single warning.
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async () => {
          await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async () => {
            await stopServer?.();

            try {
              await waitFor(() => {
                expect(console.warn).toHaveBeenCalledTimes(1);
              });

              expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('[@zimic/interceptor]'),
                `Warning: The connection to the interceptor server ${new URL(baseURL).origin} was closed. ` +
                  'Restart your interceptors to reconnect.',
              );
            } finally {
              await startServer?.();
            }
          });
        });
      });
    });
  }

  // No HTTP counterpart: WebSocket connections are long-lived, so a client can stay open after its interceptor stops.
  it('should not handle messages from existing clients after stopped', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const closeEventPromise = waitForWebSocketClientClose(client);

        await interceptor.stop();
        expect(interceptor.clients).toHaveLength(0);

        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);

        const messageListener = vi.fn();
        client.addEventListener('message', messageListener);

        client.send(JSON.stringify({ type: 'client', index: 2 }));

        // A closed socket receives no further messages, so none can arrive after the close event.
        expect(messageListener).not.toHaveBeenCalled();

        expect(interceptor.clients).toHaveLength(0);
      });
    });
  });

  // No HTTP counterpart: WebSocket connections are long-lived, so one can outlive the stop of an interceptor holding it.
  it('should keep connections shared with another interceptor open after stopped', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (firstInterceptor) => {
      await promiseIfRemote(firstInterceptor.message().respond({ type: 'server', index: 1 }), firstInterceptor);

      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (secondInterceptor) => {
        await promiseIfRemote(secondInterceptor.message().respond({ type: 'server', index: 2 }), secondInterceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await waitFor(() => {
            expect(firstInterceptor.clients).toHaveLength(1);
            expect(secondInterceptor.clients).toHaveLength(1);
          });

          await secondInterceptor.stop();

          expect(secondInterceptor.clients).toHaveLength(0);
          expect(firstInterceptor.clients).toHaveLength(1);
          expect(client.readyState).toBe(WebSocketClient.OPEN);

          const handledMessagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await expect(handledMessagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

          const sentMessage = JSON.stringify({ type: 'server', index: 3 } satisfies MessageSchema);

          const sentMessagePromise = waitForWebSocketClientMessage(client);
          firstInterceptor.server.send(sentMessage);
          await expect(sentMessagePromise).resolves.toBe(sentMessage);
        });
      });
    });
  });

  // No HTTP counterpart: WebSocket connections are long-lived, so one can outlive the stop of an interceptor holding it.
  it('should close connections shared with other interceptors after all of them are stopped', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (firstInterceptor) => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (secondInterceptor) => {
        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await waitFor(() => {
            expect(firstInterceptor.clients).toHaveLength(1);
            expect(secondInterceptor.clients).toHaveLength(1);
          });

          const closeEventPromise = waitForWebSocketClientClose(client);

          await secondInterceptor.stop();
          expect(client.readyState).toBe(WebSocketClient.OPEN);

          await firstInterceptor.stop();

          const closeEvent = await closeEventPromise;
          expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);
          expect(firstInterceptor.clients).toHaveLength(0);
          expect(secondInterceptor.clients).toHaveLength(0);
        });
      });
    });
  });

  it('should throw an error when trying to create a message handler if not running', () => {
    const interceptor = createInternalWebSocketInterceptor<MessageSchema>(interceptorOptions);
    expect(interceptor.isRunning).toBe(false);

    expect(() => interceptor.message()).toThrow(new NotRunningWebSocketInterceptorError());
  });

  it('should throw an error when trying to create a message handler while stopping', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const stopPromise = interceptor.stop();

      expect(() => interceptor.message()).toThrow(new NotRunningWebSocketInterceptorError());

      await stopPromise;
    });
  });

  type DeclaredMessageHandler =
    LocalWebSocketMessageHandler<MessageSchema> | SyncedRemoteWebSocketMessageHandler<MessageSchema>;

  const redeclarations = [
    ['respond', (handler: DeclaredMessageHandler) => handler.respond({ type: 'server', index: 2 })],
    ['effect', (handler: DeclaredMessageHandler) => handler.effect(vi.fn())],
  ] as const;

  it.each(redeclarations)(
    'should throw an error when trying to redeclare a message handler while stopping (%s)',
    async (_method, redeclare) => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

        const stopPromise = interceptor.stop();

        expect(() => redeclare(handler)).toThrow(new NotRunningWebSocketInterceptorError());

        await stopPromise;
      });
    },
  );

  it.each(redeclarations)(
    'should throw an error when trying to redeclare a message handler after stopped (%s)',
    async (_method, redeclare) => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

        await interceptor.stop();

        expect(() => redeclare(handler)).toThrow(new NotRunningWebSocketInterceptorError());
      });
    },
  );
}
