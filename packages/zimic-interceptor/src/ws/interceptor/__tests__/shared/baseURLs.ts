import { waitFor, waitForNot } from '@zimic/utils/time';
import { UnsupportedURLProtocolError, joinURL } from '@zimic/utils/url';
import { ValidationError } from '@zimic/utils/validation';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import {
  usingWebSocketClient,
  waitForWebSocketClientClose,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { UnhandledMessageStrategy, WebSocketInterceptorOptions } from '../../types/options';
import { SUPPORTED_BASE_URL_PROTOCOLS } from '../../WebSocketInterceptorImplementation';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareBaseURLWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { type, getBaseURL, getOtherBaseURL, getInterceptorOptions } = options;

  let defaultBaseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    defaultBaseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should handle base URLs and paths correctly', async () => {
    const baseURLWithoutSlash = defaultBaseURL.replace(/\/$/, '');

    for (const { baseURL, path } of [
      { baseURL: baseURLWithoutSlash, path: 'path' },
      { baseURL: `${baseURLWithoutSlash}/`, path: 'path' },
      { baseURL: baseURLWithoutSlash, path: '/path' },
      { baseURL: `${baseURLWithoutSlash}/`, path: '/path' },
    ]) {
      await usingWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL }, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

        await usingWebSocketClient<MessageSchema>(joinURL(baseURL, path), async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));

          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
        });
      });
    }
  });

  it('should intercept messages sent to the base URL with a trailing slash', async () => {
    const baseURL = joinURL(defaultBaseURL.replace(/\/$/, ''), 'path');

    await usingWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

      await usingWebSocketClient<MessageSchema>(`${baseURL}/`, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
      });
    });
  });

  it('should intercept messages sent to URLs that extend the last path segment of the base URL', async () => {
    const baseURL = joinURL(defaultBaseURL, 'api');
    const extendedURL = `${baseURL}x`;

    await usingWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

      await usingWebSocketClient<MessageSchema>(extendedURL, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
      });
    });
  });

  it('should intercept messages sent to the base URL with search params', async () => {
    const baseURL = joinURL(defaultBaseURL, 'path');
    const urlWithSearchParams = `${baseURL}?search=value`;

    await usingWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

      await usingWebSocketClient<MessageSchema>(urlWithSearchParams, async (client) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
      });
    });
  });

  it('should not intercept messages sent to URLs not starting with the base URL', async () => {
    const baseURL = joinURL(defaultBaseURL, 'api');
    const otherURL = joinURL(defaultBaseURL, 'other');

    await usingWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

      const otherURLMessageListener = vi.fn();

      // Depending on the mode, the other URL either refuses the connection or accepts it without handling messages.
      await Promise.allSettled([
        usingWebSocketClient<MessageSchema>(otherURL, async (client) => {
          client.addEventListener('message', otherURLMessageListener);
          client.send(JSON.stringify({ type: 'client', index: 1 }));

          await waitForNot(() => {
            expect(otherURLMessageListener).toHaveBeenCalled();
          });
        }),
      ]);
      expect(otherURLMessageListener).not.toHaveBeenCalled();
      expect(interceptor.clients).toHaveLength(0);
    });
  });

  it('should not intercept messages sent to the base URL without its trailing slash', async () => {
    const baseURLWithoutSlash = joinURL(defaultBaseURL, 'path');
    const baseURL = `${baseURLWithoutSlash}/`;

    await usingWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL }, async (interceptor) => {
      await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

      // Depending on the mode, the interceptor server refuses the connection, or the connection reaches the network,
      // where no WebSocket server accepts it. Either way, the connection closes.
      await Promise.allSettled([
        usingWebSocketClient<MessageSchema>(baseURLWithoutSlash, async (client) => {
          await waitForWebSocketClientClose(client);
        }),
      ]);
      expect(interceptor.clients).toHaveLength(0);
    });
  });

  // Remote interceptors connect to an interceptor server at their base URL, so they cannot use a port where no server
  // listens.
  if (type === 'local') {
    it('should not intercept messages sent to another port starting with the base URL port', async () => {
      const { protocol, hostname, port } = new URL(defaultBaseURL);
      const otherPortBaseURL = `${protocol}//${hostname}:${port.slice(0, -1)}`;
      expect(defaultBaseURL.startsWith(otherPortBaseURL)).toBe(true);

      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, baseURL: otherPortBaseURL },
        async (interceptor) => {
          interceptor.message().respond({ type: 'server', index: 1 });

          // The connection reaches the network, where no WebSocket server accepts it.
          await Promise.allSettled([
            usingWebSocketClient<MessageSchema>(joinURL(defaultBaseURL, 'chat'), async (client) => {
              await waitForWebSocketClientClose(client);
            }),
          ]);
          expect(interceptor.clients).toHaveLength(0);
        },
      );
    });
  }

  it('should intercept messages sent to socket.io paths under the base URL', async () => {
    const socketIOBaseURL = joinURL(defaultBaseURL, 'socket.io/');
    const socketIOURL = joinURL(socketIOBaseURL, 'chat');

    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, baseURL: socketIOBaseURL },
        async (socketIOInterceptor) => {
          await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);
          await promiseIfRemote(
            socketIOInterceptor.message().respond({ type: 'server', index: 2 }),
            socketIOInterceptor,
          );

          await usingWebSocketClient<MessageSchema>(socketIOURL, async (client) => {
            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(1);
              expect(socketIOInterceptor.clients).toHaveLength(1);
            });

            const messagePromise = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify({ type: 'client', index: 1 }));

            await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
          });
        },
      );
    });
  });

  // MSW treats any character in place of the socket.io dot as part of a socket.io path.
  it.each(['socket.io/', 'socket.io', 'socket-io'])(
    'should intercept messages sent to socket.io paths under a socket.io base URL (%s)',
    async (socketIOBasePath) => {
      const socketIOBaseURL = joinURL(defaultBaseURL, socketIOBasePath);
      const socketIOURL = joinURL(socketIOBaseURL, 'chat');

      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, baseURL: socketIOBaseURL },
        async (socketIOInterceptor) => {
          await promiseIfRemote(
            socketIOInterceptor.message().respond({ type: 'server', index: 1 }),
            socketIOInterceptor,
          );

          await usingWebSocketClient<MessageSchema>(socketIOURL, async (client) => {
            await waitFor(() => {
              expect(socketIOInterceptor.clients).toHaveLength(1);
            });

            const messagePromise = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify({ type: 'client', index: 1 }));

            await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
          });
        },
      );
    },
  );

  it('should intercept messages sent to other paths only with their interceptor while a socket.io base URL interceptor is running', async () => {
    const otherBaseURL = joinURL(defaultBaseURL, 'other');
    const socketIOBaseURL = joinURL(defaultBaseURL, 'socket.io');

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, baseURL: otherBaseURL },
      async (otherInterceptor) => {
        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, baseURL: socketIOBaseURL },
          async (socketIOInterceptor) => {
            await promiseIfRemote(otherInterceptor.message().respond({ type: 'server', index: 1 }), otherInterceptor);
            await promiseIfRemote(
              socketIOInterceptor.message().respond({ type: 'server', index: 2 }),
              socketIOInterceptor,
            );

            await usingWebSocketClient<MessageSchema>(joinURL(otherBaseURL, 'chat'), async (client) => {
              await waitFor(() => {
                expect(otherInterceptor.clients).toHaveLength(1);
              });

              const messagePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
              expect(socketIOInterceptor.clients).toHaveLength(0);
            });
          },
        );
      },
    );
  });

  it.each(['socket.io/', 'socket.io'])(
    'should not intercept messages sent to a socket.io base URL without its socket.io path (%s)',
    async (socketIOBasePath) => {
      const socketIOBaseURL = joinURL(defaultBaseURL, socketIOBasePath);
      const urlWithoutSocketIOPath = joinURL(defaultBaseURL, 'chat');

      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, baseURL: socketIOBaseURL },
        async (socketIOInterceptor) => {
          await promiseIfRemote(
            socketIOInterceptor.message().respond({ type: 'server', index: 1 }),
            socketIOInterceptor,
          );

          // Depending on the mode, the interceptor server refuses the connection, or the connection reaches the network,
          // where no WebSocket server accepts it. Either way, the connection closes.
          await Promise.allSettled([
            usingWebSocketClient<MessageSchema>(urlWithoutSocketIOPath, async (client) => {
              await waitForWebSocketClientClose(client);
            }),
          ]);
          expect(socketIOInterceptor.clients).toHaveLength(0);
        },
      );
    },
  );

  // No HTTP counterpart: WebSocket handlers have no per-handler path, so base URL paths are the only way to route
  // messages by path.
  it('should route messages using path discriminators', async () => {
    const firstBaseURL = `${defaultBaseURL}/first`;
    const secondBaseURL = `${defaultBaseURL}/second`;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, baseURL: firstBaseURL },
      { start: false },
      async (firstInterceptor) => {
        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, baseURL: secondBaseURL },
          { start: false },
          async (secondInterceptor) => {
            await Promise.all([firstInterceptor.start(), secondInterceptor.start()]);
            await promiseIfRemote(firstInterceptor.message().respond({ type: 'server', index: 1 }), firstInterceptor);
            await promiseIfRemote(secondInterceptor.message().respond({ type: 'server', index: 2 }), secondInterceptor);

            await usingWebSocketClient<MessageSchema>(firstBaseURL, async (firstClient) => {
              await usingWebSocketClient<MessageSchema>(secondBaseURL, async (secondClient) => {
                const firstMessagePromise = waitForWebSocketClientMessage(firstClient);
                const secondMessagePromise = waitForWebSocketClientMessage(secondClient);

                firstClient.send(JSON.stringify({ type: 'client', index: 1 }));
                secondClient.send(JSON.stringify({ type: 'client', index: 2 }));

                await expect(firstMessagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
                await expect(secondMessagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
              });
            });
          },
        );
      },
    );
  });

  it('should intercept messages with the last started interceptor if multiple interceptors match', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        const olderHandler = await promiseIfRemote(
          olderInterceptor.message().respond({ type: 'server', index: 1 }),
          olderInterceptor,
        );

        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor.message().respond({ type: 'server', index: 2 }),
              interceptor,
            );

            await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
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

  it('should intercept messages with the last started interceptor if an older one declares its handlers later', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor.message().respond({ type: 'server', index: 2 }),
              interceptor,
            );

            const olderHandler = await promiseIfRemote(
              olderInterceptor.message().respond({ type: 'server', index: 1 }),
              olderInterceptor,
            );

            await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
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

  it('should intercept messages with an older interceptor that declares its handlers later if the last started one has no matching handlers', async () => {
    const restriction = vi.fn(() => false);

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor.message().with(restriction).respond({ type: 'server', index: 2 }),
              interceptor,
            );

            const olderHandler = await promiseIfRemote(
              olderInterceptor.message().respond({ type: 'server', index: 1 }),
              olderInterceptor,
            );

            await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
              const messagePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
            });

            expect(restriction).toHaveBeenCalledTimes(1);
            expect(handler.messages).toHaveLength(0);
            expect(olderHandler.messages).toHaveLength(1);
          },
        );
      },
    );
  });

  it('should intercept messages with an older interceptor if the last started one has no matching handlers', async () => {
    const restriction = vi.fn(() => false);

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        const olderHandler = await promiseIfRemote(
          olderInterceptor.message().respond({ type: 'server', index: 1 }),
          olderInterceptor,
        );

        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor.message().with(restriction).respond({ type: 'server', index: 2 }),
              interceptor,
            );

            await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
              const messagePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
            });

            expect(restriction).toHaveBeenCalledTimes(1);
            expect(handler.messages).toHaveLength(0);
            expect(olderHandler.messages).toHaveLength(1);
          },
        );
      },
    );
  });

  it('should intercept messages with an older interceptor if the last started one has a nested base URL and no matching handlers', async () => {
    const nestedBaseURL = joinURL(defaultBaseURL, 'nested');
    const restriction = vi.fn(() => false);

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        const olderHandler = await promiseIfRemote(
          olderInterceptor.message().respond({ type: 'server', index: 1 }),
          olderInterceptor,
        );

        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, baseURL: nestedBaseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor.message().with(restriction).respond({ type: 'server', index: 2 }),
              interceptor,
            );

            await usingWebSocketClient<MessageSchema>(nestedBaseURL, async (client) => {
              const messagePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
            });

            expect(restriction).toHaveBeenCalledTimes(1);
            expect(handler.messages).toHaveLength(0);
            expect(olderHandler.messages).toHaveLength(1);
          },
        );
      },
    );
  });

  it('should intercept messages with an older interceptor if they are sent outside the nested base URL of the last started one', async () => {
    const nestedBaseURL = joinURL(defaultBaseURL, 'nested');

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        const olderHandler = await promiseIfRemote(
          olderInterceptor.message().respond({ type: 'server', index: 1 }),
          olderInterceptor,
        );

        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, baseURL: nestedBaseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor.message().respond({ type: 'server', index: 2 }),
              interceptor,
            );

            await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
              const messagePromise = waitForWebSocketClientMessage(client);
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
            });

            expect(handler.messages).toHaveLength(0);
            expect(olderHandler.messages).toHaveLength(1);
          },
        );
      },
    );
  });

  it('should apply the unhandled message strategy of the last started interceptor once if no interceptor handles a message', async () => {
    const olderOnUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>();
    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true }, onUnhandledMessage: olderOnUnhandledMessage },
      async (olderInterceptor) => {
        const olderHandler = await promiseIfRemote(
          olderInterceptor
            .message()
            .with(() => false)
            .respond({ type: 'server', index: 1 }),
          olderInterceptor,
        );

        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, messageSaving: { enabled: true }, onUnhandledMessage },
          async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor
                .message()
                .with(() => false)
                .respond({ type: 'server', index: 2 }),
              interceptor,
            );

            await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
              client.send(JSON.stringify({ type: 'client', index: 1 }));

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

  it('should apply the unhandled message strategy of the last started interceptor once if it has a nested base URL and no handlers', async () => {
    const nestedBaseURL = joinURL(defaultBaseURL, 'nested');

    const olderOnUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>();
    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true }, onUnhandledMessage: olderOnUnhandledMessage },
      async (olderInterceptor) => {
        const olderHandler = await promiseIfRemote(
          olderInterceptor
            .message()
            .with(() => false)
            .respond({ type: 'server', index: 1 }),
          olderInterceptor,
        );

        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, baseURL: nestedBaseURL, onUnhandledMessage },
          async () => {
            await usingWebSocketClient<MessageSchema>(nestedBaseURL, async (client) => {
              client.send(JSON.stringify({ type: 'client', index: 1 }));

              await waitFor(() => {
                expect(onUnhandledMessage).toHaveBeenCalled();
              });

              // Unhandled messages have no reply, so no event signals that no other strategy will be applied.
              await waitForNot(() => {
                expect(olderOnUnhandledMessage).toHaveBeenCalled();
              });
            });

            expect(olderHandler.messages).toHaveLength(0);

            expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
            expect(olderOnUnhandledMessage).not.toHaveBeenCalled();
          },
        );
      },
    );
  });

  it('should apply the unhandled message strategy of the last started interceptor once if no interceptor has handlers', async () => {
    const olderOnUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>();
    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, onUnhandledMessage: olderOnUnhandledMessage },
      async () => {
        await usingWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, onUnhandledMessage }, async () => {
          await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
            client.send(JSON.stringify({ type: 'client', index: 1 }));

            await waitFor(() => {
              expect(onUnhandledMessage).toHaveBeenCalled();
            });

            // Unhandled messages have no reply, so no event signals that no other strategy will be applied.
            await waitForNot(() => {
              expect(olderOnUnhandledMessage).toHaveBeenCalled();
            });
          });

          expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
          expect(olderOnUnhandledMessage).not.toHaveBeenCalled();
        });
      },
    );
  });

  // Unlike HTTP, a message that a handler failed to handle is not unhandled, because there is no reply to reject.
  it('should not try older interceptors if the last started one throws while handling a message', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (olderInterceptor) => {
        const olderHandler = await promiseIfRemote(
          olderInterceptor.message().respond({ type: 'server', index: 1 }),
          olderInterceptor,
        );

        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, messageSaving: { enabled: true }, onUnhandledMessage: { log: true } },
          async (interceptor) => {
            const error = new Error('An error occurred.');

            const handler = await promiseIfRemote(
              interceptor.message().respond(() => {
                throw error;
              }),
              interceptor,
            );

            await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
              await usingIgnoredConsole(['error', 'warn'], async (console) => {
                const messageListener = vi.fn();
                client.addEventListener('message', messageListener);

                client.send(JSON.stringify({ type: 'client', index: 1 }));

                await waitFor(() => {
                  expect(console.error).toHaveBeenCalledWith(error);
                });

                await waitForNot(() => {
                  expect(messageListener).toHaveBeenCalled();
                });

                expect(console.error).toHaveBeenCalledTimes(1);
                expect(console.warn).toHaveBeenCalledTimes(0);
              });
            });

            expect(handler.messages).toHaveLength(0);
            expect(olderHandler.messages).toHaveLength(0);
          },
        );
      },
    );
  });

  // Authentication tokens apply only to remote interceptors, which share an interceptor server by token.
  if (type === 'remote') {
    const olderAuth = { token: 'older-token' };
    const auth = { token: 'token' };

    it('should apply the unhandled message strategy of the last started interceptor if only an older one using another authentication token has a matching handler', async () => {
      const olderOnUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>();
      const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

      await usingWebSocketInterceptor<MessageSchema>(
        {
          type: 'remote',
          baseURL: defaultBaseURL,
          auth: olderAuth,
          messageSaving: { enabled: true },
          onUnhandledMessage: olderOnUnhandledMessage,
        },
        async (olderInterceptor) => {
          const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

          await usingWebSocketInterceptor<MessageSchema>(
            { type: 'remote', baseURL: defaultBaseURL, auth, messageSaving: { enabled: true }, onUnhandledMessage },
            async (interceptor) => {
              const handler = await interceptor
                .message()
                .with({ type: 'client', index: 2 })
                .respond({ type: 'server', index: 2 });

              await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
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
      const olderRestriction = vi.fn<() => boolean>();

      await usingWebSocketInterceptor<MessageSchema>(
        { type: 'remote', baseURL: defaultBaseURL, auth: olderAuth, messageSaving: { enabled: true } },
        async (olderInterceptor) => {
          const olderConnectionListener = vi.fn();
          olderInterceptor.on('connection', olderConnectionListener);

          const olderHandler = await olderInterceptor
            .message()
            .with(olderRestriction)
            .respond({ type: 'server', index: 1 });

          await usingWebSocketInterceptor<MessageSchema>(
            { type: 'remote', baseURL: defaultBaseURL, auth, messageSaving: { enabled: true } },
            async (interceptor) => {
              const handler = await interceptor.message().respond({ type: 'server', index: 2 });

              await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
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
        { type: 'remote', baseURL: defaultBaseURL, auth: olderAuth, messageSaving: { enabled: true } },
        async (olderInterceptor) => {
          const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

          await usingWebSocketInterceptor<MessageSchema>(
            { type: 'remote', baseURL: defaultBaseURL, auth, messageSaving: { enabled: true } },
            async (interceptor) => {
              const handler = await interceptor.message().respond({ type: 'server', index: 2 });

              await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
                const messagePromise = waitForWebSocketClientMessage(client);
                client.send(JSON.stringify({ type: 'client', index: 1 }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
              });

              expect(handler.messages).toHaveLength(1);
              expect(olderHandler.messages).toHaveLength(0);

              await interceptor.stop();

              await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
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
      const otherBaseURL = joinURL(defaultBaseURL, 'other');

      await usingWebSocketInterceptor<MessageSchema>(
        { type: 'remote', baseURL: defaultBaseURL, auth: olderAuth, messageSaving: { enabled: true } },
        async (olderInterceptor) => {
          const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

          await usingWebSocketInterceptor<MessageSchema>(
            { type: 'remote', baseURL: otherBaseURL, auth },
            async (otherInterceptor) => {
              await usingWebSocketInterceptor<MessageSchema>(
                { type: 'remote', baseURL: defaultBaseURL, auth, messageSaving: { enabled: true } },
                async (interceptor) => {
                  await interceptor.message().respond({ type: 'server', index: 2 });

                  await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
                    const messagePromise = waitForWebSocketClientMessage(client);
                    client.send(JSON.stringify({ type: 'client', index: 1 }));

                    await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
                  });

                  await interceptor.stop();
                  expect(otherInterceptor.isRunning).toBe(true);

                  await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
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
        { type: 'remote', baseURL: defaultBaseURL, auth: olderAuth, messageSaving: { enabled: true } },
        async (olderInterceptor) => {
          const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

          await usingWebSocketInterceptor<MessageSchema>(
            { type: 'remote', baseURL: defaultBaseURL, auth, messageSaving: { enabled: true }, onUnhandledMessage },
            async (interceptor) => {
              await interceptor.message().respond({ type: 'server', index: 2 });

              await interceptor.clear();

              await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
                client.send(JSON.stringify({ type: 'client', index: 1 }));

                await waitFor(() => {
                  expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
                });
              });

              expect(olderHandler.messages).toHaveLength(0);

              const handler = await interceptor.message().respond({ type: 'server', index: 2 });

              await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
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
        { type: 'remote', baseURL: defaultBaseURL, auth: olderAuth, messageSaving: { enabled: true } },
        async (olderInterceptor) => {
          const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

          await usingWebSocketInterceptor<MessageSchema>(
            { type: 'remote', baseURL: defaultBaseURL, auth: olderAuth, messageSaving: { enabled: true } },
            async (otherOlderInterceptor) => {
              await otherOlderInterceptor.message().respond({ type: 'server', index: 3 });

              await usingWebSocketInterceptor<MessageSchema>(
                { type: 'remote', baseURL: defaultBaseURL, auth, messageSaving: { enabled: true } },
                async (interceptor) => {
                  const handler = await interceptor.message().respond({ type: 'server', index: 2 });

                  await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
                    const messagePromise = waitForWebSocketClientMessage(client);
                    client.send(JSON.stringify({ type: 'client', index: 1 }));

                    await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
                  });

                  await otherOlderInterceptor.clear();

                  await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
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
        { type: 'remote', baseURL: defaultBaseURL, auth: olderAuth, messageSaving: { enabled: true } },
        async (olderInterceptor) => {
          await olderInterceptor.message().respond({ type: 'server', index: 1 });

          await usingWebSocketInterceptor<MessageSchema>(
            { type: 'remote', baseURL: defaultBaseURL, auth, messageSaving: { enabled: true } },
            async (interceptor) => {
              const handler = await interceptor.message().respond({ type: 'server', index: 2 });

              await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
                const messagePromise = waitForWebSocketClientMessage(client);
                client.send(JSON.stringify({ type: 'client', index: 1 }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
              });

              await olderInterceptor.clear();

              const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

              await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
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
        { type: 'remote', baseURL: defaultBaseURL, auth: olderAuth, messageSaving: { enabled: true } },
        async (olderInterceptor) => {
          await usingWebSocketInterceptor<MessageSchema>(
            { type: 'remote', baseURL: defaultBaseURL, auth: olderAuth, messageSaving: { enabled: true } },
            async (otherOlderInterceptor) => {
              const otherOlderHandler = await otherOlderInterceptor.message().respond({ type: 'server', index: 3 });

              await usingWebSocketInterceptor<MessageSchema>(
                { type: 'remote', baseURL: defaultBaseURL, auth, messageSaving: { enabled: true } },
                async (interceptor) => {
                  const handler = await interceptor.message().respond({ type: 'server', index: 2 });

                  const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

                  await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
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
        { type: 'remote', baseURL: defaultBaseURL, auth: olderAuth, messageSaving: { enabled: true } },
        async (olderInterceptor) => {
          const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

          await usingWebSocketInterceptor<MessageSchema>(
            { type: 'remote', baseURL: defaultBaseURL, auth, messageSaving: { enabled: true } },
            async (interceptor) => {
              const handler = await interceptor.message().respond({ type: 'server', index: 2 });

              await olderInterceptor.message().respond({ type: 'server', index: 3 });

              await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
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

    it('should intercept messages with an interceptor using a newer authentication token after an interceptor using an older one starts later', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { type: 'remote', baseURL: defaultBaseURL, auth: olderAuth, messageSaving: { enabled: true } },
        async (olderInterceptor) => {
          const olderHandler = await olderInterceptor.message().respond({ type: 'server', index: 1 });

          await usingWebSocketInterceptor<MessageSchema>(
            { type: 'remote', baseURL: defaultBaseURL, auth, messageSaving: { enabled: true } },
            async (interceptor) => {
              const handler = await interceptor.message().respond({ type: 'server', index: 2 });

              await usingWebSocketInterceptor<MessageSchema>(
                { type: 'remote', baseURL: defaultBaseURL, auth: olderAuth, messageSaving: { enabled: true } },
                async (laterOlderInterceptor) => {
                  const laterOlderHandler = await laterOlderInterceptor.message().respond({ type: 'server', index: 3 });

                  await usingWebSocketClient<MessageSchema>(defaultBaseURL, async (client) => {
                    const messagePromise = waitForWebSocketClientMessage(client);
                    client.send(JSON.stringify({ type: 'client', index: 1 }));

                    await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
                  });

                  expect(handler.messages).toHaveLength(1);
                  expect(olderHandler.messages).toHaveLength(0);
                  expect(laterOlderHandler.messages).toHaveLength(0);
                },
              );
            },
          );
        },
      );
    });
  }

  it('should support changing the base URL after created', async () => {
    const baseURL = defaultBaseURL;

    await usingWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL }, async (interceptor) => {
      expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));

      await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
      });

      const newBaseURL = joinURL(baseURL, 'new');
      expect(newBaseURL).not.toBe(interceptor.baseURL);

      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);

      interceptor.baseURL = newBaseURL;
      expect(interceptor.baseURL).toBe(newBaseURL.replace(/\/$/, ''));

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);

      await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 2 }), interceptor);

      const oldBaseURLMessageListener = vi.fn();

      // Depending on the mode, the old base URL either refuses the connection or accepts it without handling messages.
      await Promise.allSettled([
        usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          client.addEventListener('message', oldBaseURLMessageListener);
          client.send(JSON.stringify({ type: 'client', index: 2 }));

          await waitForNot(() => {
            expect(oldBaseURLMessageListener).toHaveBeenCalled();
          });
        }),
      ]);
      expect(oldBaseURLMessageListener).not.toHaveBeenCalled();

      await usingWebSocketClient<MessageSchema>(newBaseURL, async (client) => {
        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'client', index: 2 }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
      });
    });
  });

  // WebSocket interceptors expose a long-lived server handle, which must follow every base URL component change.
  it.each([
    { component: 'hostname', initial: 'localhost', changed: '127.0.0.1' },
    { component: 'hostname', initial: '127.0.0.1', changed: 'localhost' },
    { component: 'protocol', initial: 'ws:', changed: 'wss:' },
    { component: 'protocol', initial: 'wss:', changed: 'ws:' },
    { component: 'port', initial: '43210', changed: '43211' },
    { component: 'port', initial: '43211', changed: '43210' },
    { component: 'pathname', initial: '/initial-path', changed: '/other-path' },
  ] as const)(
    'should support changing the base URL $component from $initial to $changed while stopped',
    ({ component, initial, changed }) => {
      const initialBaseURL = new URL(defaultBaseURL);
      initialBaseURL[component] = initial;

      const changedBaseURL = new URL(initialBaseURL);
      changedBaseURL[component] = changed;

      const interceptor = createWebSocketInterceptor<MessageSchema>({
        ...interceptorOptions,
        baseURL: initialBaseURL.href,
      });
      const server = interceptor.server;

      interceptor.baseURL = changedBaseURL.href;
      expect(interceptor.baseURL).toBe(changedBaseURL.href.replace(/\/$/, ''));
      expect(interceptor.server).toBe(server);
      expect(server.url).toBe(interceptor.baseURL);
    },
  );

  it('should not support changing the base URL while starting', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, { start: false }, async (interceptor) => {
      const startPromise = interceptor.start();

      expect(() => {
        interceptor.baseURL = getOtherBaseURL?.() ?? joinURL(defaultBaseURL, 'new');
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      await startPromise;

      expect(interceptor.baseURL).toBe(defaultBaseURL.replace(/\/$/, ''));
    });
  });

  it('should not support changing the base URL while stopping during startup', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, { start: false }, async (interceptor) => {
      const otherBaseURL = getOtherBaseURL?.() ?? joinURL(defaultBaseURL, 'new');
      expect(otherBaseURL).not.toBe(interceptor.baseURL);

      const startPromise = interceptor.start();
      const stopPromise = interceptor.stop();

      expect(() => {
        interceptor.baseURL = otherBaseURL;
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      await Promise.all([startPromise, stopPromise]);

      expect(interceptor.baseURL).toBe(defaultBaseURL.replace(/\/$/, ''));
    });
  });

  it('should not support changing the base URL if the interceptor is running', async () => {
    const baseURL = joinURL(defaultBaseURL, 'path');

    await usingWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL }, async (interceptor) => {
      expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));

      await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
      });

      // The current base URL intercepts every URL starting with it, so the new base URL must be outside of it.
      const newBaseURL = joinURL(defaultBaseURL, 'new');
      expect(newBaseURL).not.toBe(interceptor.baseURL);

      expect(interceptor.isRunning).toBe(true);

      expect(() => {
        interceptor.baseURL = newBaseURL;
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));

      const newBaseURLMessageListener = vi.fn();

      // Depending on the mode, the new base URL either refuses the connection or accepts it without handling messages.
      await Promise.allSettled([
        usingWebSocketClient<MessageSchema>(newBaseURL, async (client) => {
          client.addEventListener('message', newBaseURLMessageListener);
          client.send(JSON.stringify({ type: 'client', index: 1 }));

          await waitForNot(() => {
            expect(newBaseURLMessageListener).toHaveBeenCalled();
          });
        }),
      ]);
      expect(newBaseURLMessageListener).not.toHaveBeenCalled();

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
      });
    });
  });

  it('should throw an error if provided an invalid base URL', async () => {
    const handler = vi.fn();

    const invalidURL = 'invalid';

    await expect(async () => {
      await usingWebSocketInterceptor({ ...interceptorOptions, baseURL: invalidURL }, handler);
    }).rejects.toThrow(/Invalid URL/);

    expect(handler).not.toHaveBeenCalled();
  });

  const invalidBaseURLs = [
    { label: 'undefined', value: undefined, expectedType: 'undefined' },
    { label: 'null', value: null, expectedType: 'null' },
    { label: 'a number', value: 5, expectedType: 'number' },
    { label: 'a boolean', value: true, expectedType: 'boolean' },
    { label: 'an object', value: {}, expectedType: 'object' },
    { label: 'an array', value: [], expectedType: 'object' },
    { label: 'a URL', value: new URL('ws://localhost:3000'), expectedType: 'object' },
  ];

  it.each(invalidBaseURLs)(
    'should throw an error if provided a base URL that is not a string ($label)',
    async ({ value, expectedType }) => {
      const handler = vi.fn();

      // @ts-expect-error Forcing an invalid base URL type.
      const invalidBaseURL: string = value;

      await expect(async () => {
        await usingWebSocketInterceptor({ ...interceptorOptions, baseURL: invalidBaseURL }, handler);
      }).rejects.toThrow(new ValidationError(`Expected options.baseURL to be string, but got ${expectedType}.`));

      expect(handler).not.toHaveBeenCalled();
    },
  );

  if (type === 'remote' && getOtherBaseURL) {
    // WebSocket connections are long-lived and bound to the server that accepted them, so moving to another server
    // origin must stop handling connections on the previous one.
    it('should use a new server origin after the base URL changes', async () => {
      const baseURL = defaultBaseURL;
      const otherBaseURL = getOtherBaseURL();

      await usingWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL }, async (interceptor) => {
        await interceptor.stop();
        interceptor.baseURL = otherBaseURL;
        await interceptor.start();

        await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 2 }), interceptor);

        const oldOriginMessageListener = vi.fn();

        await Promise.allSettled([
          usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            client.addEventListener('message', oldOriginMessageListener);
            client.send(JSON.stringify({ type: 'client', index: 2 }));

            await waitForNot(() => {
              expect(oldOriginMessageListener).toHaveBeenCalled();
            });
          }),
        ]);
        expect(oldOriginMessageListener).not.toHaveBeenCalled();

        await usingWebSocketClient<MessageSchema>(otherBaseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 2 }));

          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
        });
      });
    });
  }

  it.each(SUPPORTED_BASE_URL_PROTOCOLS)(
    'should not throw an error if provided a supported base URL protocol (%s)',
    (supportedProtocol) => {
      const supportedBaseURL = defaultBaseURL.replace(/^ws/, supportedProtocol);

      const interceptor = createWebSocketInterceptor<MessageSchema>({
        ...interceptorOptions,
        baseURL: supportedBaseURL,
      });

      expect(interceptor.baseURL).toBe(supportedBaseURL.replace(/\/$/, ''));
    },
  );

  const exampleUnsupportedProtocols = ['http', 'https', 'ftp'];

  it.each(exampleUnsupportedProtocols)(
    'should throw an error if provided an unsupported base URL protocol (%s)',
    (unsupportedProtocol) => {
      expect(SUPPORTED_BASE_URL_PROTOCOLS).not.toContain(unsupportedProtocol);

      const unsupportedBaseURL = defaultBaseURL.replace(/^ws/, unsupportedProtocol);

      expect(() => {
        createWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL: unsupportedBaseURL });
      }).toThrow(new UnsupportedURLProtocolError(unsupportedProtocol, SUPPORTED_BASE_URL_PROTOCOLS));
    },
  );

  // WebSocket connection URLs commonly carry query parameters, which must not become part of the base URL.
  it('should exclude non-path base URL parameters', () => {
    const baseURLWithNonPathParameters = `${defaultBaseURL}?search=value#hash`;

    const interceptor = createWebSocketInterceptor<MessageSchema>({
      ...interceptorOptions,
      baseURL: baseURLWithNonPathParameters,
    });

    expect(interceptor.baseURL).toBe(defaultBaseURL.replace(/\/$/, ''));
  });
}
