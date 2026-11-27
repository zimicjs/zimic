import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import color from 'picocolors';
import type { ManagerOptions, Socket } from 'socket.io-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WebSocketInterceptorStore from '@/ws/interceptor/WebSocketInterceptorStore';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHeldInterceptorWorkerMessages, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import {
  usingSocket,
  usingSocketManager,
  waitForSocketConnection,
  waitForSocketDisconnection,
} from '@tests/utils/socketIO';
import { expectWebSocketTimesCheckError } from '@tests/utils/webSocket';

import type { SocketIOProtocolOptions } from '../../types/options';
import {
  AnySchema,
  createSocketIOInterceptorOptions,
  createSocketIOPollingInterceptor,
  getSocketIOBaseURL,
  getSocketIOTransportCases,
  SharedSocketIOProtocolTestsOptions,
  SocketIOPollingInterceptor,
  SocketIOTestInterceptor,
  SocketIOTestSavingOptions,
} from './utils';

const PING_INTERVAL = 25000;

export function declareClientsSocketIOProtocolTests(options: SharedSocketIOProtocolTestsOptions) {
  const { type, getBaseURL: getServerBaseURL, PollingTransport, WebSocketTransport } = options;

  const store = new WebSocketInterceptorStore();

  let baseURL: string;
  let polling: SocketIOPollingInterceptor;

  beforeEach(() => {
    baseURL = getSocketIOBaseURL(getServerBaseURL());
    polling = createSocketIOPollingInterceptor(type, baseURL);
  });

  function getSocketIOInterceptorOptions(
    protocolOptions?: SocketIOProtocolOptions,
    savingOptions?: SocketIOTestSavingOptions,
  ) {
    return createSocketIOInterceptorOptions({ type, baseURL, polling }, protocolOptions, savingOptions);
  }

  // `socket.io-client` hangs until its ping timeout if its upgrading WebSocket closes, so tests let go only after it.
  async function waitForSocketTransportUpgrade(socket: Socket, transports: ManagerOptions['transports']) {
    if (transports?.some((transport) => transport === WebSocketTransport)) {
      await waitFor(() => expect(socket.io.engine.transport.name).toBe('websocket'));
    }
  }

  // Local interceptors receive connections in the same process, so a connection sent before a clear cannot arrive after
  // it. Only connections sent over WebSocket are checked, because polling requests reach the server through another
  // worker connection.
  if (type === 'remote') {
    it('should not intercept connections sent before their handler is cleared and redeclared', async () => {
      await usingHeldInterceptorWorkerMessages(async (messages) => {
        await usingWebSocketInterceptor<AnySchema>(
          getSocketIOInterceptorOptions({}, { connectionSaving: { enabled: true } }),
          async (interceptor) => {
            const olderHandler = await interceptor.connection().respond({ action: 'accept' });
            const handler = await interceptor.connection().respond({ action: 'accept' });

            // Clients send their namespace connection in the first message after the WebSocket handshake.
            const heldMessagePromise = messages.hold((message) => {
              return message.channel === 'interceptors/ws/messages/handle';
            });

            await usingSocket(baseURL, { transports: [WebSocketTransport] }, async (socket) => {
              const connectionPromise = waitForSocketConnection(socket);
              await heldMessagePromise;

              await handler.clear().respond({ action: 'accept' });

              messages.release();

              await connectionPromise;

              expect(handler.connections).toHaveLength(0);
              expect(olderHandler.connections).toHaveLength(1);
            });
          },
        );
      });
    });
  }

  describe.each(getSocketIOTransportCases(options))('Transport: $transportName', ({ transports }) => {
    it.each([
      { lifecycleAction: 'cleared', letGo: (interceptor: SocketIOTestInterceptor) => interceptor.clear() },
      { lifecycleAction: 'stopped', letGo: (interceptor: SocketIOTestInterceptor) => interceptor.stop() },
    ])(
      'should not list a client whose interceptor is $lifecycleAction while its connection is decided',
      async ({ letGo }) => {
        const decisionStartedPromise = createPromiseWithResolvers<void>();
        const decisionReleasedPromise = createPromiseWithResolvers<void>();

        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          await interceptor.connection().with(async () => {
            decisionStartedPromise.resolve();
            await decisionReleasedPromise;
            return true;
          });

          await usingSocket(baseURL, { transports }, async (socket) => {
            await decisionStartedPromise;
            await waitForSocketTransportUpgrade(socket, transports);
            await letGo(interceptor);
            decisionReleasedPromise.resolve();
          });

          await interceptor.start();

          await usingSocket(baseURL, { transports }, async (nextSocket) => {
            await waitForSocketConnection(nextSocket);

            // The next connection opens after the decision of the first one ends, so only its client is listed.
            expect(interceptor.clients).toHaveLength(1);
          });
        });
      },
    );

    it.each([
      { lifecycleAction: 'cleared', letGo: (interceptor: SocketIOTestInterceptor) => interceptor.clear() },
      { lifecycleAction: 'stopped', letGo: (interceptor: SocketIOTestInterceptor) => interceptor.stop() },
    ])(
      'should close connections whose only namespace is $lifecycleAction while its connection is decided',
      async ({ letGo }) => {
        const decisionStartedPromise = createPromiseWithResolvers<void>();
        const decisionReleasedPromise = createPromiseWithResolvers<void>();

        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          await interceptor.connection().with(async () => {
            decisionStartedPromise.resolve();
            await decisionReleasedPromise;
            return true;
          });

          await usingSocket(baseURL, { transports }, async (socket) => {
            const closePromise = new Promise<void>((resolve) => {
              socket.io.once('close', () => resolve());
            });

            await decisionStartedPromise;
            await waitForSocketTransportUpgrade(socket, transports);
            await letGo(interceptor);
            decisionReleasedPromise.resolve();

            await closePromise;
            expect(socket.io.engine.readyState).toBe('closed');
          });
        });
      },
    );

    it('should ping clients every ping interval', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

      try {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            const pingPromise = new Promise<void>((resolve) => {
              socket.io.once('ping', () => resolve());
            });

            vi.advanceTimersByTime(PING_INTERVAL);
            await pingPromise;

            expect(socket.connected).toBe(true);
          });
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('should remove the client of a socket that disconnects', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingSocket(baseURL, { transports }, async (socket) => {
          await waitForSocketConnection(socket);
          expect(interceptor.clients).toHaveLength(1);

          socket.disconnect();

          await waitFor(() => expect(interceptor.clients).toHaveLength(0));
        });
      });
    });

    it('should remove the client of a connection closed without disconnecting its socket', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingSocketManager(baseURL, { transports }, async (manager) => {
          const socket = manager.socket('/');
          await waitForSocketConnection(socket);
          await waitForSocketTransportUpgrade(socket, transports);
          expect(interceptor.clients).toHaveLength(1);

          manager.engine.close();

          await waitFor(() => expect(interceptor.clients).toHaveLength(0));
        });
      });
    });

    it('should disconnect a socket when its client is closed', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingSocket(baseURL, { transports }, async (socket) => {
          await waitForSocketConnection(socket);

          const disconnectionPromise = waitForSocketDisconnection(socket);

          interceptor.clients[0].close();
          await disconnectionPromise;

          await waitFor(() => expect(interceptor.clients).toHaveLength(0));
        });
      });
    });

    it('should disconnect sockets when the interceptor is cleared', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingSocket(baseURL, { transports }, async (socket) => {
          await waitForSocketConnection(socket);

          const disconnectionPromise = waitForSocketDisconnection(socket);

          await interceptor.clear();
          await disconnectionPromise;

          expect(interceptor.clients).toHaveLength(0);
        });
      });
    });

    it('should expose the auth of a socket on its connection request', async () => {
      const auth = { token: 'abc' };
      const receivedAuths: unknown[] = [];

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await interceptor
          .connection()
          .with((request) => {
            receivedAuths.push(request.auth);
            return true;
          })
          .respond((request) => {
            receivedAuths.push(request.auth);
            return { action: 'accept' };
          })
          .effect((_client, request) => {
            receivedAuths.push(request.auth);
          });

        await usingSocket(baseURL, { transports, auth }, async (socket) => {
          await waitForSocketConnection(socket);

          await waitFor(() => expect(receivedAuths).toEqual([auth, auth, auth]));
        });
      });
    });

    it('should expose the auth of a socket on its client', async () => {
      const auth = { token: 'abc' };
      const effectClientAuthPromise = createPromiseWithResolvers<unknown>();

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await interceptor.connection().effect((client) => {
          effectClientAuthPromise.resolve(client.auth);
        });

        await usingSocket(baseURL, { transports, auth }, async (socket) => {
          await waitForSocketConnection(socket);

          expect(await effectClientAuthPromise).toEqual(auth);
          expect(interceptor.clients[0].auth).toEqual(auth);
        });
      });
    });

    it('should expose an empty auth for a socket that sends none', async () => {
      const requestAuthPromise = createPromiseWithResolvers<unknown>();

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await interceptor.connection().effect((_client, request) => {
          requestAuthPromise.resolve(request.auth);
        });

        await usingSocket(baseURL, { transports }, async (socket) => {
          await waitForSocketConnection(socket);

          expect(await requestAuthPromise).toEqual({});
          expect(interceptor.clients[0].auth).toEqual({});
        });
      });
    });

    it('should save the auth of a socket in the connections of its handler', async () => {
      const auth = { token: 'abc' };

      await usingWebSocketInterceptor<AnySchema>(
        getSocketIOInterceptorOptions({}, { connectionSaving: { enabled: true } }),
        async (interceptor) => {
          const handler = await interceptor.connection().times(1);

          await usingSocket(baseURL, { transports, auth }, async (socket) => {
            await waitForSocketConnection(socket);

            expect(handler.connections).toHaveLength(1);
            expect(handler.connections[0].auth).toEqual(auth);
          });
        },
      );
    });

    it.each([{ exact: false }, { exact: undefined }])(
      'should match only specific connections if contains a declared response, a static auth restriction, and exact $exact',
      async ({ exact }) => {
        await usingWebSocketInterceptor<AnySchema>(
          getSocketIOInterceptorOptions({}, { connectionSaving: { enabled: true } }),
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ auth: { token: 'abc' }, exact })
              .respond({ action: 'reject' });

            for (const matchingAuth of [{ token: 'abc' }, { token: 'abc', user: 'u' }]) {
              await usingSocket(baseURL, { transports, auth: matchingAuth }, async (socket) => {
                await expect(waitForSocketConnection(socket)).rejects.toThrow('Connection rejected');
              });
            }

            expect(handler.connections.map((connection) => connection.auth)).toEqual([
              { token: 'abc' },
              { token: 'abc', user: 'u' },
            ]);

            for (const mismatchingAuth of [{ token: 'xyz' }, {}]) {
              await usingSocket(baseURL, { transports, auth: mismatchingAuth }, async (socket) => {
                await waitForSocketConnection(socket);
              });
            }

            expect(handler.connections).toHaveLength(2);
          },
        );
      },
    );

    it.each([{ exact: true }])(
      'should match only specific connections if contains a declared response, a static auth restriction, and exact $exact',
      async ({ exact }) => {
        await usingWebSocketInterceptor<AnySchema>(
          getSocketIOInterceptorOptions({}, { connectionSaving: { enabled: true } }),
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ auth: { token: 'abc' }, exact })
              .respond({ action: 'reject' });

            await usingSocket(baseURL, { transports, auth: { token: 'abc' } }, async (socket) => {
              await expect(waitForSocketConnection(socket)).rejects.toThrow('Connection rejected');
            });

            expect(handler.connections).toHaveLength(1);
            expect(handler.connections[0].auth).toEqual({ token: 'abc' });

            for (const mismatchingAuth of [{ token: 'abc', user: 'u' }, { token: 'xyz' }, {}]) {
              await usingSocket(baseURL, { transports, auth: mismatchingAuth }, async (socket) => {
                await waitForSocketConnection(socket);
              });
            }

            expect(handler.connections).toHaveLength(1);
          },
        );
      },
    );

    it('should consider connections unmatched due to auth restrictions in times check errors', async () => {
      await usingWebSocketInterceptor<AnySchema>(
        getSocketIOInterceptorOptions({}, { connectionSaving: { enabled: true } }),
        async (interceptor) => {
          const handler = await interceptor
            .connection()
            .with({ auth: { token: 'abc' } })
            .respond({ action: 'reject' })
            .times(1);

          await usingSocket(baseURL, { transports, auth: { token: 'xyz' } }, async (socket) => {
            await waitForSocketConnection(socket);

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              handler: 'connection',
              message: [
                'Expected exactly 1 matching connection, but got 0.',
                '',
                'Connections evaluated by this handler:',
                '',
                `  ${color.green('- Expected')}`,
                `  ${color.red('+ Received')}`,
                '',
                `1: ${interceptor.clients[0].url}`,
                '     Auth:',
                `       ${color.green('- { "token": "abc" }')}`,
                `       ${color.red('+ { "token": "xyz" }')}`,
              ].join('\n'),
              expectedNumberOfMatches: 1,
            });
          });
        },
      );
    });

    it('should match only messages from a restricted sender if contains a static auth restriction', async () => {
      await usingWebSocketInterceptor<AnySchema>(
        getSocketIOInterceptorOptions({}, { messageSaving: { enabled: true } }),
        async (interceptor) => {
          const fallbackHandler = await interceptor.message().with({ type: 'event' });
          const handler = await interceptor
            .message()
            .from({ auth: { token: 'abc' } })
            .with({ type: 'event' });

          const socketAuths = [{ token: 'abc' }, { token: 'abc', user: 'u' }, { token: 'xyz' }, {}];

          for (const [index, auth] of socketAuths.entries()) {
            await usingSocket(baseURL, { transports, auth }, async (socket) => {
              await waitForSocketConnection(socket);

              socket.emit('event', 'data');

              await waitFor(() => {
                expect(handler.messages.length + fallbackHandler.messages.length).toBe(index + 1);
              });
            });
          }

          expect(handler.messages.map((message) => message.sender.auth)).toEqual([
            { token: 'abc' },
            { token: 'abc', user: 'u' },
          ]);
          expect(fallbackHandler.messages.map((message) => message.sender.auth)).toEqual([{ token: 'xyz' }, {}]);
        },
      );
    });

    it('should consider messages unmatched due to static sender auth restrictions in times check errors', async () => {
      await usingWebSocketInterceptor<AnySchema>(
        getSocketIOInterceptorOptions({}, { messageSaving: { enabled: true } }),
        async (interceptor) => {
          const handler = await interceptor
            .message()
            .from({ auth: { token: 'abc' } })
            .times(1);

          await usingSocket(baseURL, { transports, auth: { token: 'xyz' } }, async (socket) => {
            await waitForSocketConnection(socket);

            socket.emit('event', 'data');

            await waitFor(() =>
              expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                handler: 'message',
                message: [
                  'Expected exactly 1 matching message, but got 0.',
                  '',
                  'Messages evaluated by this handler:',
                  '',
                  `  ${color.green('- Expected')}`,
                  `  ${color.red('+ Received')}`,
                  '',
                  '1: { "type": "event", "data": "data" }',
                  '     Sender:',
                  '       Auth:',
                  `         ${color.green('- { "token": "abc" }')}`,
                  `         ${color.red('+ { "token": "xyz" }')}`,
                ].join('\n'),
                expectedNumberOfMatches: 1,
              }),
            );
          });
        },
      );
    });

    const rejectionError = { message: 'Token has expired', data: { code: 'EXPIRED' } };

    it.each([
      { declarationKind: 'static', declaration: { action: 'reject' as const, error: rejectionError } },
      { declarationKind: 'computed', declaration: () => ({ action: 'reject' as const, error: rejectionError }) },
    ])(
      'should fail with connect_error of the declared error the sockets whose connection handler rejects them ($declarationKind)',
      async ({ declaration }) => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          await interceptor.connection().respond(declaration);

          await usingSocket(baseURL, { transports }, async (socket) => {
            // As in `socket.io-client`, the error of `connect_error` carries the data of the rejection.
            const expectedConnectError = Object.assign(new Error(rejectionError.message), {
              data: rejectionError.data,
            });

            await expect(waitForSocketConnection(socket)).rejects.toThrow(expectedConnectError);
          });
        });
      },
    );

    it('should fail with connect_error without data the sockets whose connection handler rejects them with an error without data', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await interceptor.connection().respond({ action: 'reject', error: { message: 'Token has expired' } });

        await usingSocket(baseURL, { transports }, async (socket) => {
          const expectedConnectError = Object.assign(new Error('Token has expired'), { data: undefined });
          await expect(waitForSocketConnection(socket)).rejects.toThrow(expectedConnectError);
        });
      });
    });
  });

  const pollingTransports: ManagerOptions['transports'] = [PollingTransport];

  it('should run connection effects with the polling client', async () => {
    await usingWebSocketInterceptor<AnySchema>(
      getSocketIOInterceptorOptions({}, { connectionSaving: { enabled: true } }),
      async (interceptor) => {
        const handler = await interceptor
          .connection()
          .effect((client) => client.send({ type: 'welcome', data: 'hello' }))
          .times(1);

        await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
          const welcomePromise = new Promise<string>((resolve) => {
            socket.once('welcome', resolve);
          });

          await waitForSocketConnection(socket);

          expect(await welcomePromise).toBe('hello');
          expect(handler.connections).toHaveLength(1);
        });
      },
    );
  });

  // Only remote interceptors connect to an interceptor server, through which they serve WebSocket clients.
  if (type === 'remote') {
    it('should stop pinging WebSocket clients after the connection to the interceptor server drops', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

      try {
        await usingIgnoredConsole(['warn', 'error'], async (console) => {
          await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
            await usingSocket(baseURL, { transports: [WebSocketTransport] }, async (socket) => {
              await waitForSocketConnection(socket);

              // No public path drops only the worker socket, as a crashed server or lost network does.
              const worker = store.getRemoteWorker(new URL(baseURL), { auth: undefined });
              // eslint-disable-next-line @typescript-eslint/dot-notation
              worker?.webSocketClient['socket']?.close();

              // The worker warns once it observes the server disconnection.
              await waitFor(() => expect(console.warn).toHaveBeenCalled());

              await vi.advanceTimersByTimeAsync(PING_INTERVAL);

              expect(console.error).not.toHaveBeenCalled();
            });
          });
        });
      } finally {
        vi.useRealTimers();
      }
    });
  }
}
