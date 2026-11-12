import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { PossiblePromise } from '@zimic/utils/types';
import { WEB_SOCKET_CLOSE_CODES } from '@zimic/utils/ws';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import color from 'picocolors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import {
  expectWebSocketConnectionToBeRefused,
  expectWebSocketConnectionToOpen,
  expectWebSocketTimesCheckError,
  openWebSocketUntilSettled,
  usingWebSocketClient,
  waitForWebSocketClientClose,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import LocalWebSocketConnectionHandler from '../../../connectionHandler/LocalWebSocketConnectionHandler';
import RemoteWebSocketConnectionHandler from '../../../connectionHandler/RemoteWebSocketConnectionHandler';
import { InternalWebSocketConnectionHandler } from '../../../connectionHandler/types/public';
import LocalWebSocketMessageHandler from '../../../messageHandler/LocalWebSocketMessageHandler';
import RemoteWebSocketMessageHandler from '../../../messageHandler/RemoteWebSocketMessageHandler';
import { UnhandledMessageStrategy, WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type Message = { type: 'client'; index: number } | { type: 'server'; index: number };

type MessageSchema = WebSocketSchema<{
  '/': {
    connection: { searchParams: { value?: string }; protocols: 'legacy' };
    message: Message;
  };
  '/users': {
    connection: { searchParams: { value?: string } };
    message: Message;
  };
  '/:resource': {
    message: Message;
  };
}>;

type ChatMessage = WebSocketSchema<{
  '/': {
    message: { type: 'client'; text: string } | { type: 'server'; text: string };
  };
}>;

export function declareClearWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  const Handler = type === 'local' ? LocalWebSocketMessageHandler : RemoteWebSocketMessageHandler;
  const ConnectionHandler = type === 'local' ? LocalWebSocketConnectionHandler : RemoteWebSocketConnectionHandler;

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

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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

        await promiseIfRemote(
          interceptor.message().with({ type: 'client', index: 0 }).respond({ type: 'server', index: 0 }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
          const probeResponse = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'client', index: 2 }));

          // Messages on a socket are delivered in order, so the probe response arriving first means that the cleared
          // handler sent no response.
          client.send(JSON.stringify({ type: 'client', index: 0 }));

          await expect(probeResponse).resolves.toBe(JSON.stringify({ type: 'server', index: 0 }));

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

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 2 }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
        });

        expect(otherHandler.messages).toHaveLength(1);
      },
    );
  });

  // No WebSocket message counterpart for "should not consider handlers from before cleared when multiple paths matched
  // requests": message handlers have no per-handler paths.

  // No WebSocket message counterpart for "should handle requests once after cleared and redeclared when multiple paths
  // matched requests": message handlers have no per-handler paths.

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

          await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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

  it('should not consider handlers of another interceptor cleared while messages are being handled', async () => {
    const restrictionStartedPromise = createPromiseWithResolvers<void>();
    const restrictionReleasedPromise = createPromiseWithResolvers<void>();

    const restriction = vi.fn(async () => {
      restrictionStartedPromise.resolve();
      await restrictionReleasedPromise;
      return false;
    });

    const otherOnUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>();
    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, onUnhandledMessage: otherOnUnhandledMessage },
      async (otherInterceptor) => {
        const otherEffect = vi.fn();
        await promiseIfRemote(
          otherInterceptor.message().effect(otherEffect).respond({ type: 'server', index: 2 }),
          otherInterceptor,
        );

        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, onUnhandledMessage },
          async (interceptor) => {
            await promiseIfRemote(
              interceptor.message().with(restriction).respond({ type: 'server', index: 1 }),
              interceptor,
            );

            await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
              await waitFor(() => {
                expect(otherInterceptor.clients).toHaveLength(1);
                expect(interceptor.clients).toHaveLength(1);
              });

              client.send(JSON.stringify({ type: 'client', index: 1 }));
              await restrictionStartedPromise;

              await promiseIfRemote(otherInterceptor.clear(), otherInterceptor);
              restrictionReleasedPromise.resolve();

              await waitFor(() => {
                expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
              });

              expect(restriction).toHaveBeenCalledTimes(1);
              expect(otherEffect).not.toHaveBeenCalled();
              expect(otherOnUnhandledMessage).not.toHaveBeenCalled();

              expect(otherInterceptor.clients).toHaveLength(0);
            });
          },
        );
      },
    );
  });

  it('should apply the unhandled message strategy of an older interceptor if the last started one is cleared while messages are being handled', async () => {
    const restrictionStartedPromise = createPromiseWithResolvers<void>();
    const restrictionReleasedPromise = createPromiseWithResolvers<void>();

    const restriction = vi.fn(async () => {
      restrictionStartedPromise.resolve();
      await restrictionReleasedPromise;
      return false;
    });

    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));
    const otherOnUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>();

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, onUnhandledMessage },
      async (interceptor) => {
        await promiseIfRemote(
          interceptor.message().with(restriction).respond({ type: 'server', index: 1 }),
          interceptor,
        );

        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, onUnhandledMessage: otherOnUnhandledMessage },
          async (otherInterceptor) => {
            await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
              await waitFor(() => {
                expect(interceptor.clients).toHaveLength(1);
                expect(otherInterceptor.clients).toHaveLength(1);
              });

              client.send(JSON.stringify({ type: 'client', index: 1 }));
              await restrictionStartedPromise;

              await promiseIfRemote(otherInterceptor.clear(), otherInterceptor);
              restrictionReleasedPromise.resolve();

              await waitFor(() => {
                expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
              });

              expect(restriction).toHaveBeenCalledTimes(1);
              expect(otherOnUnhandledMessage).not.toHaveBeenCalled();
            });
          },
        );
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

            await usingWebSocketClient<MessageSchema, '/'>(firstBaseURL, async (firstClient) => {
              await usingWebSocketClient<MessageSchema, '/'>(secondBaseURL, async (secondClient) => {
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

  it('should clear only clients owned by the selected interceptor with the same base URL', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (firstInterceptor) => {
      await usingWebSocketInterceptor<MessageSchema>(
        interceptorOptions,
        { start: false },
        async (secondInterceptor) => {
          await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (firstClient) => {
            await waitFor(() => {
              expect(firstInterceptor.clients).toHaveLength(1);
            });

            await secondInterceptor.start();
            await promiseIfRemote(secondInterceptor.message().respond({ type: 'server', index: 2 }), secondInterceptor);

            await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (secondClient) => {
              await waitFor(() => {
                expect(firstInterceptor.clients).toHaveLength(2);
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
    });
  });

  it('should keep connections shared with another interceptor open after cleared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (firstInterceptor) => {
      await promiseIfRemote(firstInterceptor.message().respond({ type: 'server', index: 1 }), firstInterceptor);

      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (secondInterceptor) => {
        await promiseIfRemote(secondInterceptor.message().respond({ type: 'server', index: 2 }), secondInterceptor);

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
          await waitFor(() => {
            expect(firstInterceptor.clients).toHaveLength(1);
            expect(secondInterceptor.clients).toHaveLength(1);
          });

          await promiseIfRemote(secondInterceptor.clear(), secondInterceptor);

          expect(secondInterceptor.clients).toHaveLength(0);
          expect(firstInterceptor.clients).toHaveLength(1);
          expect(client.readyState).toBe(WebSocketClient.OPEN);

          const handledMessagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await expect(handledMessagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

          const sentMessage = JSON.stringify({ type: 'server', index: 3 } satisfies Message);

          const sentMessagePromise = waitForWebSocketClientMessage(client);
          firstInterceptor.server.send(sentMessage);
          await expect(sentMessagePromise).resolves.toBe(sentMessage);
        });
      });
    });
  });

  it('should apply the unhandled message strategy of an older interceptor to connections shared with it after the last started one is cleared', async () => {
    const firstOnUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));
    const secondOnUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>();

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, onUnhandledMessage: firstOnUnhandledMessage },
      async (firstInterceptor) => {
        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, onUnhandledMessage: secondOnUnhandledMessage },
          async (secondInterceptor) => {
            await promiseIfRemote(secondInterceptor.message().respond({ type: 'server', index: 2 }), secondInterceptor);

            await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
              await waitFor(() => {
                expect(firstInterceptor.clients).toHaveLength(1);
                expect(secondInterceptor.clients).toHaveLength(1);
              });

              await promiseIfRemote(secondInterceptor.clear(), secondInterceptor);

              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await waitFor(() => {
                expect(firstOnUnhandledMessage).toHaveBeenCalledTimes(1);
              });

              expect(secondOnUnhandledMessage).not.toHaveBeenCalled();
            });
          },
        );
      },
    );
  });

  it('should close connections shared with other interceptors after all of them are cleared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (firstInterceptor) => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (secondInterceptor) => {
        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
          await waitFor(() => {
            expect(firstInterceptor.clients).toHaveLength(1);
            expect(secondInterceptor.clients).toHaveLength(1);
          });

          const closeEventPromise = waitForWebSocketClientClose(client);

          await promiseIfRemote(secondInterceptor.clear(), secondInterceptor);
          expect(client.readyState).toBe(WebSocketClient.OPEN);

          await promiseIfRemote(firstInterceptor.clear(), firstInterceptor);

          const closeEvent = await closeEventPromise;
          expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);
          expect(firstInterceptor.clients).toHaveLength(0);
          expect(secondInterceptor.clients).toHaveLength(0);
        });
      });
    });
  });

  it('should keep connections open for the remaining interceptors if another one is cleared while they open', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (firstInterceptor) => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (secondInterceptor) => {
        let secondClearResult: PossiblePromise<void> | undefined;

        const firstConnectionEffect = vi.fn(() => {
          secondClearResult = secondInterceptor.clear();
        });

        await promiseIfRemote(firstInterceptor.message().respond({ type: 'server', index: 1 }), firstInterceptor);
        await promiseIfRemote(firstInterceptor.connection().effect(firstConnectionEffect), firstInterceptor);

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
          await waitFor(() => {
            expect(firstConnectionEffect).toHaveBeenCalledTimes(1);
          });

          await promiseIfRemote(secondClearResult, secondInterceptor);

          expect(secondInterceptor.clients).toHaveLength(0);

          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

          expect(client.readyState).toBe(WebSocketClient.OPEN);
          expect(firstInterceptor.clients).toHaveLength(1);
        });
      });
    });
  });

  it('should close connections if their only interceptor is cleared while they open', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      let clearResult: PossiblePromise<void> | undefined;

      const connectionEffect = vi.fn(() => {
        clearResult = interceptor.clear();
      });
      await promiseIfRemote(interceptor.connection().effect(connectionEffect), interceptor);

      const client = new WebSocketClient<MessageSchema, '/'>(baseURL);
      const closeEventPromise = waitForWebSocketClientClose(client);

      // The interceptor server completes the handshake of connections let go while they are set up and then closes
      // them, so only remote clients open before closing. The close event is the outcome in both modes.
      const openPromise = client.open().catch(() => undefined);

      try {
        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);

        expect(connectionEffect).toHaveBeenCalledTimes(1);
        await promiseIfRemote(clearResult, interceptor);
        expect(interceptor.clients).toHaveLength(0);
      } finally {
        await openPromise;
        await client.close();
      }
    });
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

  it.each([{ restrictionResult: true }, { restrictionResult: false }])(
    'should not handle messages after cleared while they are being matched (restriction result: $restrictionResult)',
    async ({ restrictionResult }) => {
      const restrictionStartedPromise = createPromiseWithResolvers<void>();
      const restrictionReleasedPromise = createPromiseWithResolvers<void>();

      const restriction = vi.fn(async () => {
        restrictionStartedPromise.resolve();
        await restrictionReleasedPromise;
        return restrictionResult;
      });

      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true } },
        async (olderInterceptor) => {
          // The older interceptor is not cleared, so it keeps holding the connection and its handler could still
          // respond if it were tried.
          const olderHandler = await promiseIfRemote(
            olderInterceptor.message().respond({ type: 'server', index: 2 }),
            olderInterceptor,
          );

          await usingWebSocketInterceptor<MessageSchema>(
            { ...interceptorOptions, messageSaving: { enabled: true } },
            async (interceptor) => {
              const handler = await promiseIfRemote(
                interceptor.message().with(restriction).respond({ type: 'server', index: 1 }),
                interceptor,
              );

              await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
                await waitFor(() => {
                  expect(olderInterceptor.clients).toHaveLength(1);
                  expect(interceptor.clients).toHaveLength(1);
                });

                client.send(JSON.stringify({ type: 'client', index: 1 }));
                await restrictionStartedPromise;

                await promiseIfRemote(interceptor.clear(), interceptor);

                // Redeclaring the cleared handler would apply its new declarations to the message being matched.
                const effect = vi.fn();
                await promiseIfRemote(handler.effect(effect).times(1), interceptor);

                await promiseIfRemote(
                  olderInterceptor.message().with({ type: 'client', index: 0 }).respond({ type: 'server', index: 0 }),
                  olderInterceptor,
                );

                const firstResponsePromise = waitForWebSocketClientMessage(client);

                restrictionReleasedPromise.resolve();

                // The matching message finishes being handled once its restriction is released, before the probe
                // arrives, so the probe response arriving first means that the matching message got no response.
                client.send(JSON.stringify({ type: 'client', index: 0 }));
                await expect(firstResponsePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 0 }));

                expect(effect).not.toHaveBeenCalled();
                expect(restriction).toHaveBeenCalledTimes(1);
                expect(handler.messages).toHaveLength(0);
                expect(olderHandler.messages).toHaveLength(0);
              });

              await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
                message: 'Expected exactly 1 message, but got 0.',
                expectedNumberOfMatches: 1,
              });
            },
          );
        },
      );
    },
  );

  it('should not record unmatched messages of handlers cleared while older handlers are matching them', async () => {
    const olderRestrictionStartedPromise = createPromiseWithResolvers<void>();
    const olderRestrictionReleasedPromise = createPromiseWithResolvers<void>();

    const olderRestriction = vi.fn(async () => {
      olderRestrictionStartedPromise.resolve();
      await olderRestrictionReleasedPromise;
      return false;
    });

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        const olderHandler = await promiseIfRemote(
          olderInterceptor.message().with(olderRestriction).respond({ type: 'server', index: 2 }).times(1),
          olderInterceptor,
        );

        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor.message().with({ type: 'client', index: 3 }).respond({ type: 'server', index: 3 }).times(1),
              interceptor,
            );

            await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
              await waitFor(() => {
                expect(olderInterceptor.clients).toHaveLength(1);
                expect(interceptor.clients).toHaveLength(1);
              });

              // The newer handler fails to match before the older one starts matching. Redeclaring it with a
              // restriction and a times limit makes it save any unmatched message still recorded for it.
              client.send(JSON.stringify({ type: 'client', index: 1 }));
              await olderRestrictionStartedPromise;

              await promiseIfRemote(interceptor.clear(), interceptor);

              await promiseIfRemote(
                handler.with({ type: 'client', index: 3 }).respond({ type: 'server', index: 3 }).times(1),
                interceptor,
              );

              await promiseIfRemote(
                olderInterceptor.message().with({ type: 'client', index: 0 }).respond({ type: 'server', index: 0 }),
                olderInterceptor,
              );

              const firstResponsePromise = waitForWebSocketClientMessage(client);

              olderRestrictionReleasedPromise.resolve();

              // The matching message finishes being handled once its restriction is released, before the probe
              // arrives.
              client.send(JSON.stringify({ type: 'client', index: 0 }));
              await expect(firstResponsePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 0 }));
            });

            await expectWebSocketTimesCheckError(() => promiseIfRemote(handler.checkTimes(), handler), {
              message: 'Expected exactly 1 matching message, but got 0.',
              expectedNumberOfMatches: 1,
            });

            await expectWebSocketTimesCheckError(() => promiseIfRemote(olderHandler.checkTimes(), olderHandler), {
              message: [
                'Expected exactly 1 matching message, but got 0.',
                '',
                'Messages evaluated by this handler:',
                '',
                `  ${color.green('- Expected')}`,
                `  ${color.red('+ Received')}`,
                '',
                '1: { "type": "client", "index": "1" }',
                '     Computed restriction:',
                `       ${color.green('- return true')}`,
                `       ${color.red('+ return false')}`,
              ].join('\n'),
              expectedNumberOfMatches: 1,
            });
          },
        );
      },
    );
  });

  it('should not apply the unhandled message strategy after cleared while a message is being handled', async () => {
    const restrictionStartedPromise = createPromiseWithResolvers<void>();
    const restrictionReleasedPromise = createPromiseWithResolvers<void>();

    const restriction = vi.fn(async () => {
      restrictionStartedPromise.resolve();
      await restrictionReleasedPromise;
      return false;
    });

    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, onUnhandledMessage },
      async (interceptor) => {
        await promiseIfRemote(
          interceptor.message().with(restriction).respond({ type: 'server', index: 1 }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
          const closeEventPromise = waitForWebSocketClientClose(client);

          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await restrictionStartedPromise;

          await promiseIfRemote(interceptor.clear(), interceptor);

          const closeEvent = await closeEventPromise;
          expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);

          restrictionReleasedPromise.resolve();
          expect(restriction).toHaveBeenCalledTimes(1);
        });

        // The cleared message finishes being handled once its restriction is released, so the strategy being applied
        // only to an unhandled message from a new client means that it was not applied to the cleared message.
        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
          client.send(JSON.stringify({ type: 'client', index: 2 }));

          await waitFor(() => {
            expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
          });
          expect(onUnhandledMessage).toHaveBeenCalledWith({ type: 'client', index: 2 });
        });
      },
    );
  });

  describe('Connections', () => {
    it('should ignore all handlers after cleared when intercepting connections', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }), interceptor);
          expect(handler.connections).toHaveLength(0);

          await expectWebSocketConnectionToBeRefused(baseURL);

          expect(handler.connections).toHaveLength(1);

          await promiseIfRemote(interceptor.clear(), interceptor);

          await expectWebSocketConnectionToOpen(baseURL);

          expect(handler.connections).toHaveLength(0);
        },
      );
    });

    it('should support creating new handlers after cleared', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true } },
        async (interceptor) => {
          await promiseIfRemote(interceptor.connection().respond({ action: 'accept' }), interceptor);

          await promiseIfRemote(interceptor.clear(), interceptor);

          const handler = await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }), interceptor);
          expect(handler.connections).toHaveLength(0);

          await expectWebSocketConnectionToBeRefused(baseURL);

          expect(handler.connections).toHaveLength(1);
        },
      );
    });

    it('should support reusing previous handlers after cleared', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await promiseIfRemote(interceptor.connection(), interceptor);

          await promiseIfRemote(handler.respond({ action: 'accept' }), interceptor);

          await promiseIfRemote(interceptor.clear(), interceptor);

          const otherHandler = await promiseIfRemote(handler.respond({ action: 'reject' }), interceptor);
          expect(otherHandler).toBeInstanceOf(ConnectionHandler);

          expect(handler.connections).toHaveLength(0);

          await expectWebSocketConnectionToBeRefused(baseURL);

          expect(otherHandler.connections).toHaveLength(1);
        },
      );
    });

    it('should not consider handlers from before cleared when multiple paths matched connections', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true } },
        async (interceptor) => {
          await promiseIfRemote(interceptor.connection('/users').respond({ action: 'reject' }), interceptor);
          await promiseIfRemote(interceptor.connection('/:resource').respond({ action: 'reject' }), interceptor);

          await promiseIfRemote(interceptor.clear(), interceptor);

          const handler = await promiseIfRemote(
            interceptor
              .connection('/users')
              .with({ searchParams: { value: '1' } })
              .respond({ action: 'reject' }),
            interceptor,
          );

          await expectWebSocketConnectionToOpen(`${baseURL}/users?value=2`);

          expect(handler.connections).toHaveLength(0);
        },
      );
    });

    it('should handle connections once after cleared and redeclared when multiple paths matched connections', async () => {
      const restriction = vi.fn(() => false);

      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true } },
        async (interceptor) => {
          await promiseIfRemote(interceptor.connection('/users').respond({ action: 'reject' }), interceptor);
          await promiseIfRemote(interceptor.connection('/:resource').respond({ action: 'reject' }), interceptor);

          await promiseIfRemote(interceptor.clear(), interceptor);

          const handler = await promiseIfRemote(
            interceptor.connection('/:resource').with(restriction).respond({ action: 'reject' }),
            interceptor,
          );

          await expectWebSocketConnectionToOpen(`${baseURL}/users`);

          expect(restriction).toHaveBeenCalledTimes(1);
          expect(handler.connections).toHaveLength(0);
        },
      );
    });

    it('should keep connections open for the remaining interceptors if another one is cleared while a connection handler decides them', async () => {
      const restrictionStartedPromise = createPromiseWithResolvers<void>();
      const restrictionReleasedPromise = createPromiseWithResolvers<void>();

      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true } },
        async (remainingInterceptor) => {
          await promiseIfRemote(
            remainingInterceptor.message().respond({ type: 'server', index: 1 }),
            remainingInterceptor,
          );

          // The remaining interceptor is not cleared, so its handler would refuse the connection if it were tried.
          const remainingHandler = await promiseIfRemote(
            remainingInterceptor.connection().respond({ action: 'reject' }),
            remainingInterceptor,
          );

          await usingWebSocketInterceptor<MessageSchema>(
            { ...interceptorOptions, connectionSaving: { enabled: true } },
            async (clearedInterceptor) => {
              const handler = await promiseIfRemote(
                clearedInterceptor
                  .connection()
                  .with(async () => {
                    restrictionStartedPromise.resolve();
                    await restrictionReleasedPromise;
                    return true;
                  })
                  .respond({ action: 'reject' }),
                clearedInterceptor,
              );

              const client = new WebSocketClient<MessageSchema, '/'>(baseURL);

              try {
                const openPromise = client.open();
                await restrictionStartedPromise;

                await promiseIfRemote(clearedInterceptor.clear(), clearedInterceptor);
                restrictionReleasedPromise.resolve();

                await openPromise;

                await waitFor(() => {
                  expect(remainingInterceptor.clients).toHaveLength(1);
                });

                expect(clearedInterceptor.clients).toHaveLength(0);
                expect(handler.connections).toHaveLength(0);
                expect(remainingHandler.connections).toHaveLength(0);

                const messagePromise = waitForWebSocketClientMessage(client);
                client.send(JSON.stringify({ type: 'client', index: 1 }));
                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
              } finally {
                await client.close();
              }
            },
          );
        },
      );
    });

    it('should keep connections open for the remaining interceptors if another one is cleared after a connection handler decides them', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (remainingInterceptor) => {
        await promiseIfRemote(
          remainingInterceptor.message().respond({ type: 'server', index: 1 }),
          remainingInterceptor,
        );

        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, connectionSaving: { enabled: true } },
          async (clearedInterceptor) => {
            const effect = vi.fn();

            const handler = await promiseIfRemote(
              clearedInterceptor.connection().effect(effect).respond({ action: 'accept' }),
              clearedInterceptor,
            );

            // No public callback runs between the last check of the decision and the worker listing the client, so
            // the interceptor is cleared when the decided connection is saved, right before the decision returns.
            const { implementation } = handler as unknown as InternalWebSocketConnectionHandler<MessageSchema>;
            const saveInterceptedConnection = implementation.saveInterceptedConnection.bind(implementation);

            vi.spyOn(implementation, 'saveInterceptedConnection').mockImplementationOnce((request) => {
              saveInterceptedConnection(request);
              void clearedInterceptor.clear();
            });

            await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
              await waitFor(() => {
                expect(remainingInterceptor.clients).toHaveLength(1);
              });

              expect(clearedInterceptor.clients).toHaveLength(0);
              expect(handler.connections).toHaveLength(0);

              const messagePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'client', index: 1 }));
              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

              expect(effect).not.toHaveBeenCalled();
            });
          },
        );
      });
    });

    it('should not save intercepted connections after cleared while a connection is being handled', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const responseStartedPromise = createPromiseWithResolvers<void>();
          const responseReleasedPromise = createPromiseWithResolvers<void>();

          const handler = await promiseIfRemote(
            interceptor.connection().respond(async (request) => {
              if (request.searchParams.get('value') === 'pending') {
                responseStartedPromise.resolve();
                await responseReleasedPromise;
              }
              return { action: 'accept' };
            }),
            interceptor,
          );

          await expectWebSocketConnectionToOpen(baseURL);

          const handlerConnections = handler.connections;
          expect(handlerConnections).toHaveLength(1);

          const pendingAttemptPromise = openWebSocketUntilSettled(`${baseURL}?value=pending`);
          await responseStartedPromise;

          await promiseIfRemote(interceptor.clear(), interceptor);

          const nextHandler = await promiseIfRemote(
            interceptor.connection().respond({ action: 'accept' }),
            interceptor,
          );

          responseReleasedPromise.resolve();

          const { socket: pendingSocket } = await pendingAttemptPromise;
          pendingSocket.close();

          await expectWebSocketConnectionToOpen(baseURL);

          expect(nextHandler.connections).toHaveLength(1);

          expect(handler.connections).toBe(handlerConnections);
          expect(handlerConnections).toEqual([]);
        },
      );
    });

    it.each([{ restrictionResult: true }, { restrictionResult: false }])(
      'should close connections if their only interceptor is cleared while a connection handler decides them (restriction result: $restrictionResult)',
      async ({ restrictionResult }) => {
        const restrictionStartedPromise = createPromiseWithResolvers<void>();
        const restrictionReleasedPromise = createPromiseWithResolvers<void>();

        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, connectionSaving: { enabled: true } },
          async (interceptor) => {
            const effect = vi.fn();

            const handler = await promiseIfRemote(
              interceptor
                .connection()
                .with(async () => {
                  restrictionStartedPromise.resolve();
                  await restrictionReleasedPromise;
                  return restrictionResult;
                })
                .effect(effect)
                .respond({ action: 'reject' }),
              interceptor,
            );

            const attemptPromise = openWebSocketUntilSettled(baseURL);
            await restrictionStartedPromise;

            await promiseIfRemote(interceptor.clear(), interceptor);
            restrictionReleasedPromise.resolve();

            // As when cleared while connections open, only remote clients open before closing, and the close event is
            // the outcome in both modes.
            const attempt = await attemptPromise;

            const closeEvent =
              attempt.closeEvent ??
              (await new Promise<CloseEvent>((resolve) => {
                attempt.socket.addEventListener('close', resolve, { once: true });
              }));
            expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);

            expect(interceptor.clients).toHaveLength(0);
            expect(handler.connections).toHaveLength(0);
            expect(effect).not.toHaveBeenCalled();
          },
        );
      },
    );

    it('should not record unmatched connections of handlers cleared while older handlers are matching them', async () => {
      const olderRestrictionStartedPromise = createPromiseWithResolvers<void>();
      const olderRestrictionReleasedPromise = createPromiseWithResolvers<void>();

      const olderRestriction = vi.fn(async () => {
        olderRestrictionStartedPromise.resolve();
        await olderRestrictionReleasedPromise;
        return false;
      });

      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, connectionSaving: { enabled: true } },
        async (olderInterceptor) => {
          const olderHandler = await promiseIfRemote(
            olderInterceptor.connection().with(olderRestriction).respond({ action: 'reject' }).times(1),
            olderInterceptor,
          );

          await usingWebSocketInterceptor<MessageSchema>(
            { ...interceptorOptions, connectionSaving: { enabled: true } },
            async (interceptor) => {
              const handler = await promiseIfRemote(
                interceptor
                  .connection()
                  .with({ protocols: ['legacy'] })
                  .respond({ action: 'reject' })
                  .times(1),
                interceptor,
              );

              // The newer handler fails to match before the older one starts matching. Redeclaring it with a
              // restriction and a times limit makes it save any unmatched connection still recorded for it.
              const attemptPromise = openWebSocketUntilSettled(baseURL);
              await olderRestrictionStartedPromise;

              await promiseIfRemote(interceptor.clear(), interceptor);

              await promiseIfRemote(
                handler
                  .with({ protocols: ['legacy'] })
                  .respond({ action: 'reject' })
                  .times(1),
                interceptor,
              );

              olderRestrictionReleasedPromise.resolve();

              const { socket, eventTypes } = await attemptPromise;
              socket.close();

              expect(eventTypes).toEqual(['open']);
              expect(olderRestriction).toHaveBeenCalledTimes(1);

              await expectWebSocketTimesCheckError(() => promiseIfRemote(handler.checkTimes(), handler), {
                message: 'Expected exactly 1 matching connection, but got 0.',
                expectedNumberOfMatches: 1,
              });

              await expectWebSocketTimesCheckError(() => promiseIfRemote(olderHandler.checkTimes(), olderHandler), {
                message: [
                  'Expected exactly 1 matching connection, but got 0.',
                  '',
                  'Connections evaluated by this handler:',
                  '',
                  `  ${color.green('- Expected')}`,
                  `  ${color.red('+ Received')}`,
                  '',
                  `1: ${socket.url}`,
                  '     Computed restriction:',
                  `       ${color.green('- return true')}`,
                  `       ${color.red('+ return false')}`,
                ].join('\n'),
                expectedNumberOfMatches: 1,
              });
            },
          );
        },
      );
    });
  });
}
