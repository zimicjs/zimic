import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import type { PacketType } from 'socket.io-parser';
import { beforeEach, describe, expect, it } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import {
  usingSocket,
  usingSocketManager,
  waitForSocketConnection,
  waitForSocketDisconnection,
} from '@tests/utils/socketIO';

import type { WebSocketInterceptorClient } from '../../../interceptor/types/messages';
import type { SocketIOProtocolOptions } from '../../types/options';
import {
  AnySchema,
  AnySocketIOInterceptor,
  createSocketIOInterceptorOptions,
  createSocketIOPollingInterceptor,
  getSocketIOBaseURL,
  getSocketIOTransportCases,
  SharedSocketIOProtocolTestsOptions,
  SocketIOPollingInterceptor,
  SocketIOTestInterceptor,
  SocketIOTestSavingOptions,
  usingSocketIONamespaceInterceptors,
} from './utils';

export function declareNamespacesSocketIOProtocolTests(options: SharedSocketIOProtocolTestsOptions) {
  const { type, getBaseURL: getServerBaseURL } = options;

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

  async function usingNamespaceInterceptors(
    savingOptions: SocketIOTestSavingOptions,
    callback: (rootInterceptor: AnySocketIOInterceptor, adminInterceptor: AnySocketIOInterceptor) => Promise<void>,
  ) {
    await usingSocketIONamespaceInterceptors({ type, baseURL, polling }, savingOptions, callback);
  }

  describe.each(getSocketIOTransportCases(options))('Transport: $transportName', ({ transports }) => {
    it('should handle each namespace with its own interceptor', async () => {
      await usingNamespaceInterceptors(
        { messageSaving: { enabled: true } },
        async (rootInterceptor, adminInterceptor) => {
          const rootHandler = await rootInterceptor
            .message()
            .with({ type: 'event' })
            .respond({ type: 'reply', data: 'root' });
          const adminHandler = await adminInterceptor
            .message()
            .with({ type: 'event' })
            .respond({ type: 'reply', data: 'admin' });

          await usingSocket(baseURL, { transports, nsp: '/admin' }, async (adminSocket) => {
            await waitForSocketConnection(adminSocket);

            const replyPromise = new Promise<string>((resolve) => {
              adminSocket.once('reply', resolve);
            });
            adminSocket.emit('event', 'data');

            expect(await replyPromise).toBe('admin');
            expect(adminHandler.messages).toHaveLength(1);
            expect(rootHandler.messages).toHaveLength(0);
          });
        },
      );
    });

    it('should list a client only in the interceptors of the namespaces it joined', async () => {
      await usingNamespaceInterceptors({}, async (rootInterceptor, adminInterceptor) => {
        await usingSocketManager(baseURL, { transports }, async (manager) => {
          await waitForSocketConnection(manager.socket('/'));

          expect(rootInterceptor.clients).toHaveLength(1);
          expect(adminInterceptor.clients).toHaveLength(0);

          await waitForSocketConnection(manager.socket('/admin'));

          expect(rootInterceptor.clients).toHaveLength(1);
          expect(adminInterceptor.clients).toHaveLength(1);
        });
      });
    });

    it('should run connection handlers only for the namespaces a client joined', async () => {
      await usingNamespaceInterceptors(
        { connectionSaving: { enabled: true } },
        async (rootInterceptor, adminInterceptor) => {
          const rootHandler = await rootInterceptor.connection().times(1);
          const adminHandler = await adminInterceptor.connection().times(1);

          await usingSocketManager(baseURL, { transports }, async (manager) => {
            await waitForSocketConnection(manager.socket('/'));

            expect(rootHandler.connections).toHaveLength(1);
            expect(adminHandler.connections).toHaveLength(0);

            await waitForSocketConnection(manager.socket('/admin'));

            expect(rootHandler.connections).toHaveLength(1);
            expect(adminHandler.connections).toHaveLength(1);
          });
        },
      );
    });

    it('should open one Engine.IO connection for the namespaces of a manager', async () => {
      await usingNamespaceInterceptors({}, async () => {
        await usingSocketManager(baseURL, { transports }, async (manager) => {
          let numberOfOpenPackets = 0;

          manager.engine.on('packet', (packet) => {
            if (packet.type === 'open') {
              numberOfOpenPackets++;
            }
          });

          await Promise.all([
            waitForSocketConnection(manager.socket('/')),
            waitForSocketConnection(manager.socket('/admin')),
          ]);

          expect(numberOfOpenPackets).toBe(1);
        });
      });
    });

    it('should remove only the client of the namespace a socket disconnects from', async () => {
      await usingNamespaceInterceptors(
        { messageSaving: { enabled: true } },
        async (rootInterceptor, adminInterceptor) => {
          const rootHandler = await rootInterceptor.message().with({ type: 'event' }).times(1);

          await usingSocketManager(baseURL, { transports }, async (manager) => {
            const rootSocket = manager.socket('/');
            const adminSocket = manager.socket('/admin');

            await Promise.all([waitForSocketConnection(rootSocket), waitForSocketConnection(adminSocket)]);

            adminSocket.disconnect();

            await waitFor(() => expect(adminInterceptor.clients).toHaveLength(0));
            expect(rootInterceptor.clients).toHaveLength(1);

            rootSocket.emit('event', 'data');
            await waitFor(() => expect(rootHandler.messages).toHaveLength(1));
          });
        },
      );
    });

    it('should keep other namespaces connected when the interceptor of one namespace is cleared', async () => {
      await usingNamespaceInterceptors(
        { messageSaving: { enabled: true } },
        async (rootInterceptor, adminInterceptor) => {
          const rootHandler = await rootInterceptor.message().with({ type: 'event' }).times(1);

          await usingSocketManager(baseURL, { transports }, async (manager) => {
            const rootSocket = manager.socket('/');
            const adminSocket = manager.socket('/admin');

            await Promise.all([waitForSocketConnection(rootSocket), waitForSocketConnection(adminSocket)]);

            const adminDisconnectionPromise = waitForSocketDisconnection(adminSocket);

            await adminInterceptor.clear();
            await adminDisconnectionPromise;

            expect(rootSocket.connected).toBe(true);

            rootSocket.emit('event', 'data');
            await waitFor(() => expect(rootHandler.messages).toHaveLength(1));
          });
        },
      );
    });

    it('should not disconnect a namespace whose interceptor is cleared while its connection is decided', async () => {
      const decisionStartedPromise = createPromiseWithResolvers<void>();
      const decisionReleasedPromise = createPromiseWithResolvers<void>();

      await usingNamespaceInterceptors({}, async (rootInterceptor, adminInterceptor) => {
        await adminInterceptor.connection().with(async () => {
          decisionStartedPromise.resolve();
          await decisionReleasedPromise;
          return true;
        });

        await usingSocketManager(baseURL, { transports }, async (manager) => {
          const rootSocket = manager.socket('/');
          await waitForSocketConnection(rootSocket);

          const adminPacketTypes: PacketType[] = [];
          manager.on('packet', (packet) => {
            if (packet.nsp === '/admin') {
              adminPacketTypes.push(packet.type);
            }
          });

          manager.socket('/admin');
          await decisionStartedPromise;

          await adminInterceptor.clear();
          decisionReleasedPromise.resolve();

          const markerPromise = new Promise<void>((resolve) => {
            rootSocket.once('marker', () => resolve());
          });
          rootInterceptor.server.send({ type: 'marker', data: 'root' });

          await markerPromise;

          // Packets arrive in order, so receiving the marker first proves the admin namespace received nothing.
          expect(adminPacketTypes).toEqual([]);
          expect(rootSocket.connected).toBe(true);
        });
      });
    });

    it.each([
      { lifecycleAction: 'cleared', letGo: (interceptor: SocketIOTestInterceptor) => interceptor.clear() },
      { lifecycleAction: 'stopped', letGo: (interceptor: SocketIOTestInterceptor) => interceptor.stop() },
    ])(
      'should keep namespaces joined after the connection opened when the interceptor that held it is $lifecycleAction',
      async ({ letGo }) => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (rootInterceptor) => {
          await usingSocketManager(baseURL, { transports }, async (manager) => {
            const rootSocket = manager.socket('/');
            await waitForSocketConnection(rootSocket);

            // Started after the connection opened, so the root interceptor was its only holder when it connected.
            await usingWebSocketInterceptor<AnySchema>(
              getSocketIOInterceptorOptions({ namespace: '/admin' }, { messageSaving: { enabled: true } }),
              async (adminInterceptor) => {
                const adminHandler = await adminInterceptor.message().with({ type: 'event' }).times(1);

                const adminSocket = manager.socket('/admin');
                await waitForSocketConnection(adminSocket);

                const rootDisconnectionPromise = waitForSocketDisconnection(rootSocket);

                await letGo(rootInterceptor);
                await rootDisconnectionPromise;

                adminSocket.emit('event', 'data');
                await waitFor(() => expect(adminHandler.messages).toHaveLength(1));

                expect(adminSocket.connected).toBe(true);
              },
            );
          });
        });
      },
    );

    it('should close connections that joined no namespace when the last interceptor stops', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        // A manager without sockets opens its Engine.IO connection without joining any namespace.
        await usingSocketManager(baseURL, { transports }, async (manager) => {
          await new Promise<void>((resolve) => {
            manager.once('open', () => resolve());
          });

          const closePromise = new Promise<void>((resolve) => {
            manager.once('close', () => resolve());
          });

          await interceptor.stop();
          await closePromise;

          expect(manager.engine.readyState).toBe('closed');
        });
      });
    });

    it.each([
      {
        method: 'send',
        callRetainedClient: (client: WebSocketInterceptorClient<AnySchema>) => {
          client.send({ type: 'event', data: 'retained' });
        },
      },
      {
        method: 'close',
        callRetainedClient: (client: WebSocketInterceptorClient<AnySchema>) => {
          client.close();
        },
      },
    ])(
      'should ignore $method calls of a client retained after its interceptor is cleared',
      async ({ callRetainedClient }) => {
        await usingNamespaceInterceptors({}, async (_rootInterceptor, adminInterceptor) => {
          // The root namespace keeps the connection open after the admin namespace is cleared.
          await usingSocketManager(baseURL, { transports }, async (manager) => {
            const rootSocket = manager.socket('/');
            const adminSocket = manager.socket('/admin');

            await Promise.all([waitForSocketConnection(rootSocket), waitForSocketConnection(adminSocket)]);

            const retainedClient = adminInterceptor.clients[0];

            const adminDisconnectionPromise = waitForSocketDisconnection(adminSocket);

            await adminInterceptor.clear();
            await adminDisconnectionPromise;

            adminSocket.connect();
            await waitForSocketConnection(adminSocket);

            const receivedEventTypes: string[] = [];
            adminSocket.onAny((eventType: string) => receivedEventTypes.push(eventType));

            callRetainedClient(retainedClient);

            const markerPromise = new Promise<void>((resolve) => {
              adminSocket.once('marker', () => resolve());
            });
            adminInterceptor.server.send({ type: 'marker', data: 'admin' });

            await markerPromise;

            // Packets arrive in order, so receiving only the marker proves the retained client sent nothing.
            expect(receivedEventTypes).toEqual(['marker']);
            expect(adminSocket.connected).toBe(true);
          });
        });
      },
    );

    it('should fail with connect_error only the namespace whose connection handler rejects it', async () => {
      await usingNamespaceInterceptors({}, async (_rootInterceptor, adminInterceptor) => {
        await adminInterceptor.connection().respond({ action: 'reject' }).times(1);

        await usingSocketManager(baseURL, { transports }, async (manager) => {
          const rootSocket = manager.socket('/');
          const adminSocket = manager.socket('/admin');

          await Promise.all([
            expect(waitForSocketConnection(rootSocket)).resolves.toBeUndefined(),
            expect(waitForSocketConnection(adminSocket)).rejects.toThrow('Connection rejected'),
          ]);

          expect(adminInterceptor.clients).toHaveLength(0);
          expect(rootSocket.connected).toBe(true);
        });
      });
    });

    it('should fail with connect_error the connections to a namespace without an interceptor', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingSocket(baseURL, { transports, nsp: '/unknown' }, async (socket) => {
          await expect(waitForSocketConnection(socket)).rejects.toThrow('Invalid namespace');
          expect(interceptor.clients).toHaveLength(0);
        });
      });
    });
  });
}
