import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import type { ManagerOptions, Socket } from 'socket.io-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import {
  usingSocket,
  usingSocketManager,
  waitForSocketConnection,
  waitForSocketDisconnection,
} from '@tests/utils/socketIO';

import type { SocketIOProtocolOptions } from '../../types/options';
import {
  AnySchema,
  CONNECTION_SAVING,
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

  // `socket.io-client` stops polling while it upgrades, and keeps the connection open until its ping timeout if the
  // upgrading WebSocket closes before the upgrade ends, as with Socket.IO servers that close mid-upgrade. Stopping a
  // remote interceptor closes that WebSocket, so connections are let go only after the upgrade.
  async function waitForSocketTransportUpgrade(socket: Socket, transports: ManagerOptions['transports']) {
    if (transports?.some((transport) => transport === WebSocketTransport)) {
      await waitFor(() => expect(socket.io.engine.transport.name).toBe('websocket'));
    }
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
          await waitForSocketConnection(manager.socket('/'));
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
  });

  const pollingTransports: ManagerOptions['transports'] = [PollingTransport];

  it('should run connection effects with the polling client', async () => {
    await usingWebSocketInterceptor<AnySchema>(
      getSocketIOInterceptorOptions({}, CONNECTION_SAVING),
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
}
