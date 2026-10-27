import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import {
  expectWebSocketTimesCheckError,
  usingWebSocketClient,
  waitForWebSocketClientClose,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import LocalWebSocketMessageHandler from '../../../messageHandler/LocalWebSocketMessageHandler';
import RemoteWebSocketMessageHandler from '../../../messageHandler/RemoteWebSocketMessageHandler';
import { UnhandledMessageStrategy, WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;
type ChatMessage = WebSocketSchema<{ type: 'client'; text: string } | { type: 'server'; text: string }>;

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

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
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

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
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

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 2 }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
        });

        expect(otherHandler.messages).toHaveLength(1);
      },
    );
  });

  // No WebSocket counterpart for "should not consider handlers from before cleared when multiple paths matched
  // requests": WebSocket handlers have no per-handler paths.

  // No WebSocket counterpart for "should handle requests once after cleared and redeclared when multiple paths matched
  // requests": WebSocket handlers have no per-handler paths.

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

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
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
        const otherConnectionListener = vi.fn();
        otherInterceptor.on('connection', otherConnectionListener);

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

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
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
              expect(otherConnectionListener).toHaveBeenCalledTimes(1);
            });
          },
        );
      },
    );
  });

  // No HTTP counterpart: clearing a WebSocket interceptor detaches it from its connections, so it no longer decides the
  // strategy of their messages, while a cleared HTTP interceptor still decides it for requests.
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
            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
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

            await usingWebSocketClient<MessageSchema>(firstBaseURL, async (firstClient) => {
              await usingWebSocketClient<MessageSchema>(secondBaseURL, async (secondClient) => {
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

  // No HTTP counterpart: WebSocket connections are long-lived, so one can outlive the clear of an interceptor holding it.
  it('should clear only clients owned by the selected interceptor with the same base URL', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (firstInterceptor) => {
      await usingWebSocketInterceptor<MessageSchema>(
        interceptorOptions,
        { start: false },
        async (secondInterceptor) => {
          await usingWebSocketClient<MessageSchema>(baseURL, async (firstClient) => {
            await waitFor(() => {
              expect(firstInterceptor.clients).toHaveLength(1);
            });

            await secondInterceptor.start();
            await promiseIfRemote(secondInterceptor.message().respond({ type: 'server', index: 2 }), secondInterceptor);

            await usingWebSocketClient<MessageSchema>(baseURL, async (secondClient) => {
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

  // No HTTP counterpart: WebSocket connections are long-lived, so one can outlive the clear of an interceptor holding it.
  it('should keep connections shared with another interceptor open after cleared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (firstInterceptor) => {
      await promiseIfRemote(firstInterceptor.message().respond({ type: 'server', index: 1 }), firstInterceptor);

      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (secondInterceptor) => {
        await promiseIfRemote(secondInterceptor.message().respond({ type: 'server', index: 2 }), secondInterceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
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

          const sentMessage = JSON.stringify({ type: 'server', index: 3 } satisfies MessageSchema);

          const sentMessagePromise = waitForWebSocketClientMessage(client);
          firstInterceptor.server.send(sentMessage);
          await expect(sentMessagePromise).resolves.toBe(sentMessage);
        });
      });
    });
  });

  // No HTTP counterpart: WebSocket connections are long-lived, so one can outlive the clear of an interceptor holding it.
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

            await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
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

  // No HTTP counterpart: WebSocket connections are long-lived, so one can outlive the clear of an interceptor holding it.
  it('should close connections shared with other interceptors after all of them are cleared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (firstInterceptor) => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (secondInterceptor) => {
        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
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

  // No HTTP counterpart: WebSocket connection listeners run while a connection opens, so they can clear an interceptor
  // before it holds the connection.
  it('should keep connections open for the remaining interceptors if another one is cleared while they open', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (firstInterceptor) => {
      await promiseIfRemote(firstInterceptor.message().respond({ type: 'server', index: 1 }), firstInterceptor);

      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (secondInterceptor) => {
        const secondConnectionListener = vi.fn();
        secondInterceptor.on('connection', secondConnectionListener);

        let secondClearResult: PossiblePromise<void> | undefined;

        // The first interceptor started first, so its connection listeners run before the second one holds the
        // connection.
        firstInterceptor.once('connection', () => {
          secondClearResult = secondInterceptor.clear();
        });

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await waitFor(() => {
            expect(firstInterceptor.clients).toHaveLength(1);
          });

          await promiseIfRemote(secondClearResult, secondInterceptor);

          expect(secondInterceptor.clients).toHaveLength(0);
          expect(secondConnectionListener).not.toHaveBeenCalled();

          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));

          expect(client.readyState).toBe(WebSocketClient.OPEN);
          expect(firstInterceptor.clients).toHaveLength(1);
        });
      });
    });
  });

  // No HTTP counterpart: WebSocket connection listeners run while a connection opens, so they can clear an interceptor
  // before it holds the connection.
  it('should close connections if their only interceptor is cleared while they open', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      let clearResult: PossiblePromise<void> | undefined;

      const connectionListener = vi.fn(() => {
        clearResult = interceptor.clear();
      });
      interceptor.once('connection', connectionListener);

      const client = new WebSocketClient<MessageSchema>(baseURL);
      const closeEventPromise = waitForWebSocketClientClose(client);

      // The interceptor server completes the handshake before connecting the client to its interceptors, so only
      // remote clients open before closing. The close event is the outcome in both modes.
      const openPromise = client.open().catch(() => undefined);

      try {
        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);

        expect(connectionListener).toHaveBeenCalledTimes(1);
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

  it('should not handle messages after cleared while they are being matched', async () => {
    const restrictionStartedPromise = createPromiseWithResolvers<void>();
    const restrictionReleasedPromise = createPromiseWithResolvers<void>();

    const restriction = vi.fn(async () => {
      restrictionStartedPromise.resolve();
      await restrictionReleasedPromise;
      return true;
    });

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.message().with(restriction).respond({ type: 'server', index: 1 }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await restrictionStartedPromise;

          await promiseIfRemote(interceptor.clear(), interceptor);

          // Redeclaring the cleared handler would apply its new declarations to the message being matched.
          const effect = vi.fn();
          await promiseIfRemote(handler.effect(effect).times(1), interceptor);

          await promiseIfRemote(
            interceptor.message().with({ type: 'client', index: 0 }).respond({ type: 'server', index: 0 }),
            interceptor,
          );

          restrictionReleasedPromise.resolve();

          // Clearing closed the connection, so the probe is sent from a new client. The matching message finishes being
          // handled once its restriction is released, before the probe arrives.
          await usingWebSocketClient<MessageSchema>(baseURL, async (probeClient) => {
            const probeResponse = waitForWebSocketClientMessage(probeClient);
            probeClient.send(JSON.stringify({ type: 'client', index: 0 }));
            await expect(probeResponse).resolves.toBe(JSON.stringify({ type: 'server', index: 0 }));
          });

          expect(effect).not.toHaveBeenCalled();
          expect(restriction).toHaveBeenCalledTimes(1);
          expect(handler.messages).toHaveLength(0);
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 message, but got 0.',
          expectedNumberOfMessages: 1,
        });
      },
    );
  });

  // No HTTP counterpart: clearing a WebSocket interceptor closes its connections, so a message being handled has no
  // connection left, while an HTTP request being handled still needs a response.
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

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
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
        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          client.send(JSON.stringify({ type: 'client', index: 2 }));

          await waitFor(() => {
            expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
          });
          expect(onUnhandledMessage).toHaveBeenCalledWith({ type: 'client', index: 2 });
        });
      },
    );
  });
}
