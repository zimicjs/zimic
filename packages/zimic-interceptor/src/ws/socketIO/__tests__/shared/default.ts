import type { HttpSchema } from '@zimic/http';
import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { io, Manager, type ManagerOptions, type NodeXHR, Socket, type XHR } from 'socket.io-client';
import msgpackParser from 'socket.io-msgpack-parser';
import { describe, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor, usingWebSocketInterceptor } from '@tests/utils/interceptors';

import type { WebSocketInterceptorClient } from '../../../interceptor/types/messages';
import type { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { WebSocketInterceptor } from '../../../interceptor/types/public';
import { createSocketIOProtocol } from '../../createSocketIOProtocol';
import { GlobalWebSocketTransport } from '../../GlobalWebSocketTransport';
import type { SocketIOMessage, SocketIOParser, SocketIOSchema } from '../../types';

/* eslint-disable @typescript-eslint/naming-convention -- Socket.IO event names commonly use colons. */
interface ServerToClientEvents {
  'user:created': (user: { id: string }, source: string) => void;
}

interface ClientToServerEvents {
  'user:create': (input: { name: string }, ack: (user: { id: string }, source: string) => void) => void;
  'user:notify': (input: { name: string }, priority: number) => void;
}
/* eslint-enable @typescript-eslint/naming-convention */

type ChatSchema = SocketIOSchema<ServerToClientEvents, ClientToServerEvents>;

type AnySchema = SocketIOSchema;

type SocketIOTestInterceptor = Pick<WebSocketInterceptor<AnySchema>, 'clear' | 'stop'>;

type HealthSchema = HttpSchema<{ '/health': { GET: { response: { 204: { body: null } } } } }>;

interface SharedSocketIOTestsOptions {
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
  PollingTransport: typeof NodeXHR | typeof XHR;
}

const PING_INTERVAL = 50;

async function usingSocket(
  baseURL: string,
  options: Partial<ManagerOptions> & { nsp?: string },
  callback: (socket: Socket) => Promise<void>,
) {
  const { origin, pathname } = new URL(baseURL);
  const { nsp = '', ...managerOptions } = options;

  const socket = io(`${origin.replace(/^ws/, 'http')}${nsp}`, {
    path: `${pathname.replace(/\/$/, '')}/socket.io/`,
    forceNew: true,
    reconnection: false,
    ...managerOptions,
  });

  try {
    await callback(socket);
  } finally {
    socket.disconnect();
  }
}

// Sockets of one manager share its Engine.IO connection, each on its own namespace.
async function usingSocketManager(
  baseURL: string,
  options: Partial<ManagerOptions>,
  callback: (manager: Manager) => Promise<void>,
) {
  const { origin, pathname } = new URL(baseURL);

  const manager = new Manager(origin.replace(/^ws/, 'http'), {
    path: `${pathname.replace(/\/$/, '')}/socket.io/`,
    reconnection: false,
    ...options,
  });

  try {
    await callback(manager);
  } finally {
    manager.engine.close();
  }
}

async function waitForSocketConnection(socket: Socket) {
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

export function declareSocketIOProtocolTests(options: SharedSocketIOTestsOptions) {
  const { type, getBaseURL, PollingTransport } = options;

  const transportCases: { transportName: string; transports: ManagerOptions['transports'] }[] = [
    { transportName: 'websocket', transports: [GlobalWebSocketTransport] },
    { transportName: 'polling', transports: [PollingTransport] },
    { transportName: 'polling with upgrade', transports: [PollingTransport, GlobalWebSocketTransport] },
  ];

  describe.each(transportCases)('Transport: $transportName', ({ transports }) => {
    it('should normalize the first argument as data and omit args when there are no others', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<ChatSchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          const handler = await interceptor.message().with({ type: 'user:create' }).times(1);

          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            socket.emit('user:create', { name: 'Name' });

            await waitFor(() => expect(handler.messages).toHaveLength(1));
            expect(handler.messages[0].data).toStrictEqual({ type: 'user:create', data: { name: 'Name' } });
          });
        },
      );
    });

    it('should normalize the remaining arguments as args', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<ChatSchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          const handler = await interceptor.message().with({ type: 'user:notify' }).times(1);

          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            socket.emit('user:notify', { name: 'Name' }, 2, 'extra');

            await waitFor(() => expect(handler.messages).toHaveLength(1));
            expect(handler.messages[0].data).toStrictEqual({
              type: 'user:notify',
              data: { name: 'Name' },
              args: [2, 'extra'],
            });
          });
        },
      );
    });

    it('should send event responses with their first argument and args', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<ChatSchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          await interceptor
            .message()
            .with({ type: 'user:notify' })
            .respond({ type: 'user:created', data: { id: '1' }, args: ['server'] })
            .times(1);

          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            const responsePromise = new Promise<unknown[]>((resolve) => {
              socket.once('user:created', (...args: unknown[]) => resolve(args));
            });
            socket.emit('user:notify', { name: 'Name' }, 2);

            expect(await responsePromise).toEqual([{ id: '1' }, 'server']);
          });
        },
      );
    });

    it('should expose the ack ID of events sent with an ack callback', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<ChatSchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          const handler = await interceptor.message().with({ type: 'user:create' }).times(1);

          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            socket.emit('user:create', { name: 'Name' }, vi.fn());

            await waitFor(() => expect(handler.messages).toHaveLength(1));
            expect(handler.messages[0].data).toEqual({
              type: 'user:create',
              data: { name: 'Name' },
              ackId: expect.any(Number) as number,
            });
          });
        },
      );
    });

    it('should acknowledge events by responding with their ack ID', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<ChatSchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          await interceptor
            .message()
            .with({ type: 'user:create' })
            .respond((message) => ({ ackId: message.ackId!, data: { id: '1' }, args: ['server'] }))
            .times(1);

          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            const ackPromise = new Promise<unknown[]>((resolve) => {
              socket.emit('user:create', { name: 'Name' }, (...args: unknown[]) => resolve(args));
            });

            expect(await ackPromise).toEqual([{ id: '1' }, 'server']);
          });
        },
      );
    });

    it('should acknowledge events without arguments', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          await interceptor
            .message()
            .with({ type: 'event' })
            .respond((message) => ({ ackId: message.ackId! }))
            .times(1);

          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            const ackPromise = new Promise<unknown[]>((resolve) => {
              socket.emit('event', (...args: unknown[]) => resolve(args));
            });

            expect(await ackPromise).toEqual([]);
          });
        },
      );
    });

    it('should send binary attachments and receive them as array buffers', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          const handler = await interceptor
            .message()
            .with({ type: 'file' })
            .respond({ type: 'file:copy', data: new Uint8Array([0xff, 0x00]).buffer })
            .times(1);

          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            const responsePromise = new Promise<ArrayBuffer>((resolve) => {
              socket.once('file:copy', resolve);
            });
            socket.emit('file', new Uint8Array([0x00, 0xff]).buffer);

            const response = await responsePromise;
            expect(Array.from(new Uint8Array(response))).toEqual([0xff, 0x00]);

            const received = handler.messages[0].data as SocketIOMessage;
            expect(received.data).toBeInstanceOf(ArrayBuffer);
            expect(Array.from(new Uint8Array(received.data as ArrayBuffer))).toEqual([0x00, 0xff]);
          });
        },
      );
    });

    it('should encode and decode events with a custom parser', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<ChatSchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol({ parser: msgpackParser as unknown as SocketIOParser }),
        },
        async (interceptor) => {
          await interceptor
            .message()
            .with({ type: 'user:notify', data: { name: 'Name' } })
            .respond({ type: 'user:created', data: { id: '1' }, args: ['server'] })
            .times(1);

          await usingSocket(baseURL, { transports, parser: msgpackParser }, async (socket) => {
            await waitForSocketConnection(socket);

            const responsePromise = new Promise<unknown[]>((resolve) => {
              socket.once('user:created', (...args: unknown[]) => resolve(args));
            });
            socket.emit('user:notify', { name: 'Name' }, 2);

            expect(await responsePromise).toEqual([{ id: '1' }, 'server']);
          });
        },
      );
    });

    it('should handle each namespace with its own interceptor', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (rootInterceptor) => {
          await usingWebSocketInterceptor<AnySchema>(
            {
              type,
              baseURL,
              messageSaving: { enabled: true },
              connectionSaving: { enabled: true },
              protocol: createSocketIOProtocol({ namespace: '/admin' }),
            },
            async (adminInterceptor) => {
              const rootHandler = await rootInterceptor
                .message()
                .with({ type: 'event' })
                .respond({ type: 'reply', data: 'root' })
                .times(1);
              const adminHandler = await adminInterceptor
                .message()
                .with({ type: 'event' })
                .respond({ type: 'reply', data: 'admin' })
                .times(1);

              await usingSocket(baseURL, { transports, forceNew: false, nsp: '/admin' }, async (adminSocket) => {
                await waitForSocketConnection(adminSocket);

                const replyPromise = new Promise<string>((resolve) => {
                  adminSocket.once('reply', resolve);
                });
                adminSocket.emit('event', 'data');

                expect(await replyPromise).toBe('admin');
                expect(adminHandler.messages).toHaveLength(1);
                expect(rootHandler.messages).toHaveLength(0);

                await rootHandler.clear();
              });
            },
          );
        },
      );
    });

    it('should list a client only in the interceptors of the namespaces it joined', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (rootInterceptor) => {
          await usingWebSocketInterceptor<AnySchema>(
            {
              type,
              baseURL,
              messageSaving: { enabled: true },
              connectionSaving: { enabled: true },
              protocol: createSocketIOProtocol({ namespace: '/admin' }),
            },
            async (adminInterceptor) => {
              await usingSocketManager(baseURL, { transports }, async (manager) => {
                await waitForSocketConnection(manager.socket('/'));

                expect(rootInterceptor.clients).toHaveLength(1);
                expect(adminInterceptor.clients).toHaveLength(0);

                await waitForSocketConnection(manager.socket('/admin'));

                expect(rootInterceptor.clients).toHaveLength(1);
                expect(adminInterceptor.clients).toHaveLength(1);
              });
            },
          );
        },
      );
    });

    it('should run connection handlers only for the namespaces a client joined', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (rootInterceptor) => {
          await usingWebSocketInterceptor<AnySchema>(
            {
              type,
              baseURL,
              messageSaving: { enabled: true },
              connectionSaving: { enabled: true },
              protocol: createSocketIOProtocol({ namespace: '/admin' }),
            },
            async (adminInterceptor) => {
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
        },
      );
    });

    it('should open one Engine.IO connection for the namespaces of a manager', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async () => {
          await usingWebSocketInterceptor<AnySchema>(
            {
              type,
              baseURL,
              messageSaving: { enabled: true },
              connectionSaving: { enabled: true },
              protocol: createSocketIOProtocol({ namespace: '/admin' }),
            },
            async () => {
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
            },
          );
        },
      );
    });

    it('should remove only the client of the namespace a socket disconnects from', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (rootInterceptor) => {
          await usingWebSocketInterceptor<AnySchema>(
            {
              type,
              baseURL,
              messageSaving: { enabled: true },
              connectionSaving: { enabled: true },
              protocol: createSocketIOProtocol({ namespace: '/admin' }),
            },
            async (adminInterceptor) => {
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
        },
      );
    });

    it('should keep other namespaces connected when the interceptor of one namespace is cleared', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (rootInterceptor) => {
          await usingWebSocketInterceptor<AnySchema>(
            {
              type,
              baseURL,
              messageSaving: { enabled: true },
              connectionSaving: { enabled: true },
              protocol: createSocketIOProtocol({ namespace: '/admin' }),
            },
            async (adminInterceptor) => {
              const rootHandler = await rootInterceptor.message().with({ type: 'event' }).times(1);

              await usingSocketManager(baseURL, { transports }, async (manager) => {
                const rootSocket = manager.socket('/');
                const adminSocket = manager.socket('/admin');

                await Promise.all([waitForSocketConnection(rootSocket), waitForSocketConnection(adminSocket)]);

                const adminDisconnectPromise = new Promise<void>((resolve) => {
                  adminSocket.once('disconnect', () => resolve());
                });

                await Promise.resolve(adminInterceptor.clear());
                await adminDisconnectPromise;

                expect(rootSocket.connected).toBe(true);

                rootSocket.emit('event', 'data');
                await waitFor(() => expect(rootHandler.messages).toHaveLength(1));
              });
            },
          );
        },
      );
    });

    it.each([
      { lifecycleAction: 'cleared', letGo: (interceptor: SocketIOTestInterceptor) => interceptor.clear() },
      { lifecycleAction: 'stopped', letGo: (interceptor: SocketIOTestInterceptor) => interceptor.stop() },
    ])(
      'should keep namespaces joined after the connection opened when the interceptor that held it is $lifecycleAction',
      async ({ letGo }) => {
        const baseURL = getBaseURL();

        await usingWebSocketInterceptor<AnySchema>(
          {
            type,
            baseURL,
            messageSaving: { enabled: true },
            connectionSaving: { enabled: true },
            protocol: createSocketIOProtocol(),
          },
          async (rootInterceptor) => {
            await usingSocketManager(baseURL, { transports }, async (manager) => {
              const rootSocket = manager.socket('/');
              await waitForSocketConnection(rootSocket);

              // Started after the connection opened, so the root interceptor was its only holder when it connected.
              await usingWebSocketInterceptor<AnySchema>(
                {
                  type,
                  baseURL,
                  messageSaving: { enabled: true },
                  connectionSaving: { enabled: true },
                  protocol: createSocketIOProtocol({ namespace: '/admin' }),
                },
                async (adminInterceptor) => {
                  const adminHandler = await adminInterceptor.message().with({ type: 'event' }).times(1);

                  const adminSocket = manager.socket('/admin');
                  await waitForSocketConnection(adminSocket);

                  const rootDisconnectPromise = new Promise<void>((resolve) => {
                    rootSocket.once('disconnect', () => resolve());
                  });

                  await letGo(rootInterceptor);
                  await rootDisconnectPromise;

                  adminSocket.emit('event', 'data');
                  await waitFor(() => expect(adminHandler.messages).toHaveLength(1));

                  expect(adminSocket.connected).toBe(true);
                },
              );
            });
          },
        );
      },
    );

    it('should close connections that joined no namespace when the last interceptor stops', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
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
        },
      );
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
        const baseURL = getBaseURL();

        await usingWebSocketInterceptor<AnySchema>(
          {
            type,
            baseURL,
            messageSaving: { enabled: true },
            connectionSaving: { enabled: true },
            protocol: createSocketIOProtocol(),
          },
          async () => {
            await usingWebSocketInterceptor<AnySchema>(
              {
                type,
                baseURL,
                messageSaving: { enabled: true },
                connectionSaving: { enabled: true },
                protocol: createSocketIOProtocol({ namespace: '/admin' }),
              },
              async (adminInterceptor) => {
                // The root namespace keeps the connection open after the admin namespace is cleared.
                await usingSocketManager(baseURL, { transports }, async (manager) => {
                  const rootSocket = manager.socket('/');
                  const adminSocket = manager.socket('/admin');

                  await Promise.all([waitForSocketConnection(rootSocket), waitForSocketConnection(adminSocket)]);

                  const retainedClient = adminInterceptor.clients[0];

                  const adminDisconnectPromise = new Promise<void>((resolve) => {
                    adminSocket.once('disconnect', () => resolve());
                  });

                  await Promise.resolve(adminInterceptor.clear());
                  await adminDisconnectPromise;

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

                  // Packets on a connection arrive in order, so the marker being the only event received means that the
                  // retained client sent nothing to the reconnected socket before it.
                  expect(receivedEventTypes).toEqual(['marker']);
                  expect(adminSocket.connected).toBe(true);
                });
              },
            );
          },
        );
      },
    );

    it('should fail with connect_error only the namespace whose connection handler rejects it', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async () => {
          await usingWebSocketInterceptor<AnySchema>(
            {
              type,
              baseURL,
              messageSaving: { enabled: true },
              connectionSaving: { enabled: true },
              protocol: createSocketIOProtocol({ namespace: '/admin' }),
            },
            async (adminInterceptor) => {
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
            },
          );
        },
      );
    });

    it('should fail with connect_error the connections to a namespace without an interceptor', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          await usingSocket(baseURL, { transports, nsp: '/unknown' }, async (socket) => {
            await expect(waitForSocketConnection(socket)).rejects.toThrow('Invalid namespace');
            expect(interceptor.clients).toHaveLength(0);
          });
        },
      );
    });

    it.each([
      { lifecycleAction: 'cleared', letGo: (interceptor: SocketIOTestInterceptor) => interceptor.clear() },
      { lifecycleAction: 'stopped', letGo: (interceptor: SocketIOTestInterceptor) => interceptor.stop() },
    ])(
      'should not list a client whose interceptor is $lifecycleAction while its connection is decided',
      async ({ letGo }) => {
        const baseURL = getBaseURL();

        const decisionStartedPromise = createPromiseWithResolvers<void>();
        const decisionReleasedPromise = createPromiseWithResolvers<void>();

        await usingWebSocketInterceptor<AnySchema>(
          {
            type,
            baseURL,
            messageSaving: { enabled: true },
            connectionSaving: { enabled: true },
            protocol: createSocketIOProtocol(),
          },
          async (interceptor) => {
            await interceptor.connection().with(async () => {
              decisionStartedPromise.resolve();
              await decisionReleasedPromise;
              return true;
            });

            await usingSocket(baseURL, { transports }, async () => {
              await decisionStartedPromise;
              await letGo(interceptor);
              decisionReleasedPromise.resolve();
            });

            // A stopped interceptor starts again to accept the next connection.
            await interceptor.start();

            await usingSocket(baseURL, { transports }, async (nextSocket) => {
              await waitForSocketConnection(nextSocket);

              // The next connection opens after the decision of the first one ends, so only its client is listed.
              expect(interceptor.clients).toHaveLength(1);
            });
          },
        );
      },
    );

    it.each([
      { lifecycleAction: 'cleared', letGo: (interceptor: SocketIOTestInterceptor) => interceptor.clear() },
      { lifecycleAction: 'stopped', letGo: (interceptor: SocketIOTestInterceptor) => interceptor.stop() },
    ])(
      'should close connections whose only namespace is $lifecycleAction while its connection is decided',
      async ({ letGo }) => {
        const baseURL = getBaseURL();

        const decisionStartedPromise = createPromiseWithResolvers<void>();
        const decisionReleasedPromise = createPromiseWithResolvers<void>();

        await usingWebSocketInterceptor<AnySchema>(
          {
            type,
            baseURL,
            messageSaving: { enabled: true },
            connectionSaving: { enabled: true },
            protocol: createSocketIOProtocol(),
          },
          async (interceptor) => {
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
              await letGo(interceptor);
              decisionReleasedPromise.resolve();

              await closePromise;
              expect(socket.io.engine.readyState).toBe('closed');
            });
          },
        );
      },
    );

    it('should send pings without user handlers', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol({ pingInterval: PING_INTERVAL }),
        },
        async () => {
          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            let numberOfPings = 0;
            socket.io.on('ping', () => numberOfPings++);

            await waitFor(() => expect(numberOfPings).toBeGreaterThanOrEqual(2));
            expect(socket.connected).toBe(true);
          });
        },
      );
    });

    it('should list a connected socket as one client and remove it when the socket disconnects', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);
            expect(interceptor.clients).toHaveLength(1);

            socket.disconnect();

            await waitFor(() => expect(interceptor.clients).toHaveLength(0));
          });
        },
      );
    });

    it('should disconnect a socket when its client is closed', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            const disconnectPromise = new Promise<void>((resolve) => {
              socket.once('disconnect', () => resolve());
            });

            interceptor.clients[0].close();
            await disconnectPromise;

            await waitFor(() => expect(interceptor.clients).toHaveLength(0));
          });
        },
      );
    });

    it('should disconnect sockets when the interceptor is cleared', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            const disconnectPromise = new Promise<void>((resolve) => {
              socket.once('disconnect', () => resolve());
            });

            await Promise.resolve(interceptor.clear());
            await disconnectPromise;

            expect(interceptor.clients).toHaveLength(0);
          });
        },
      );
    });

    it('should accept new connections after the interceptor is cleared', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          await Promise.resolve(interceptor.clear());

          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);
            expect(interceptor.clients).toHaveLength(1);
          });
        },
      );
    });
  });

  describe('Polling sessions', () => {
    const pollingTransports: ManagerOptions['transports'] = [PollingTransport];

    const upgradingTransports: ManagerOptions['transports'] = [PollingTransport, GlobalWebSocketTransport];

    it('should keep one client across the upgrade to WebSocket', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          const handler = await interceptor.message().with({ type: 'event' }).times(2);

          await usingSocket(baseURL, { transports: upgradingTransports }, async (socket) => {
            await waitForSocketConnection(socket);

            const client = interceptor.clients[0];
            socket.emit('event', 'before');
            await waitFor(() => expect(handler.messages).toHaveLength(1));

            await waitFor(() => expect(socket.io.engine.transport.name).toBe('websocket'));

            socket.emit('event', 'after');
            await waitFor(() => expect(handler.messages).toHaveLength(2));

            expect(interceptor.clients).toEqual([client]);
            expect(handler.messages[1].sender).toBe(client);
          });

          await waitFor(() => expect(interceptor.clients).toHaveLength(0));
        },
      );
    });

    it('should deliver messages sent while a client upgrades', async () => {
      const baseURL = getBaseURL();

      const socketConnectionPromise = createPromiseWithResolvers<void>();

      // The upgrade starts only once the socket joined its namespace, so the interceptor lists a client to send to.
      class UpgradeAfterConnectionTransport extends GlobalWebSocketTransport {
        doOpen() {
          void socketConnectionPromise.then(() => super.doOpen());
          return this;
        }
      }

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          const transports = [PollingTransport, UpgradeAfterConnectionTransport];

          await usingSocket(baseURL, { transports }, async (socket) => {
            socket.once('connect', () => socketConnectionPromise.resolve());

            const receivedEvents: unknown[] = [];
            socket.on('event', (data: unknown) => receivedEvents.push(data));

            socket.io.engine.once('upgrading', () => {
              interceptor.server.send({ type: 'event', data: 'during upgrade' });
            });

            await waitForSocketConnection(socket);

            await waitFor(() => expect(socket.io.engine.transport.name).toBe('websocket'));
            await waitFor(() => expect(receivedEvents).toEqual(['during upgrade']));
          });
        },
      );
    });

    it('should not connect WebSocket connections with an unknown session ID', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        { type, baseURL, protocol: createSocketIOProtocol() },
        async (interceptor) => {
          const socket = new WebSocket(`${baseURL}/socket.io/?EIO=4&transport=websocket&sid=unknown`);

          const closeEvent = await new Promise<CloseEvent>((resolve) => {
            socket.addEventListener('close', resolve, { once: true });
          });

          expect(closeEvent.reason).toBe('Session ID unknown');
          expect(interceptor.clients).toHaveLength(0);
        },
      );
    });

    it('should ignore polling packets without a session ID', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        { type, baseURL, protocol: createSocketIOProtocol() },
        async (interceptor) => {
          const response = await fetch(`${baseURL.replace(/^ws/, 'http')}/socket.io/?EIO=4&transport=polling`, {
            method: 'POST',
            body: '40',
          });

          expect(response.status).toBe(200);
          expect(interceptor.clients).toHaveLength(0);
        },
      );
    });

    it('should expose polling clients to server sends', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
            await waitForSocketConnection(socket);

            const eventPromise = new Promise<string>((resolve) => {
              socket.once('event', resolve);
            });
            interceptor.server.send({ type: 'event', data: 'polling' });

            expect(await eventPromise).toBe('polling');
          });
        },
      );
    });

    it('should run connection effects with the polling client', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
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

    it('should fail polling clients with a warning when polling is disabled', async () => {
      const baseURL = getBaseURL();

      await usingIgnoredConsole(['warn'], async (console) => {
        await usingWebSocketInterceptor<AnySchema>(
          {
            type,
            baseURL,
            messageSaving: { enabled: true },
            connectionSaving: { enabled: true },
            protocol: createSocketIOProtocol({ polling: false }),
          },
          async (interceptor) => {
            await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
              await expect(waitForSocketConnection(socket)).rejects.toThrow();

              expect(interceptor.clients).toHaveLength(0);
              const warnings = console.warn.mock.calls.map((call) => call.join(' '));
              const pollingWarnings = warnings.filter((warning) => warning.includes("`transports: ['websocket']`"));

              // Close requests still in flight from earlier tests on the same local base URL may also be rejected.
              expect(pollingWarnings).not.toHaveLength(0);
              expect(pollingWarnings[0]).toContain('[@zimic/interceptor]');
            });
          },
        );
      });
    });

    it('should connect WebSocket clients when polling is disabled', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol({ polling: false }),
        },
        async (interceptor) => {
          await usingSocket(baseURL, { transports: [GlobalWebSocketTransport] }, async (socket) => {
            await waitForSocketConnection(socket);
            expect(interceptor.clients).toHaveLength(1);
          });
        },
      );
    });

    it('should follow the polling option of the first interceptor started on a base URL', async () => {
      const baseURL = getBaseURL();

      await usingIgnoredConsole(['warn'], async () => {
        await usingWebSocketInterceptor<AnySchema>(
          {
            type,
            baseURL,
            messageSaving: { enabled: true },
            connectionSaving: { enabled: true },
            protocol: createSocketIOProtocol({ polling: false }),
          },
          async () => {
            await usingWebSocketInterceptor<AnySchema>(
              {
                type,
                baseURL,
                messageSaving: { enabled: true },
                connectionSaving: { enabled: true },
                protocol: createSocketIOProtocol({ namespace: '/admin', polling: true }),
              },
              async (adminInterceptor) => {
                await usingSocket(baseURL, { transports: pollingTransports, nsp: '/admin' }, async (socket) => {
                  await expect(waitForSocketConnection(socket)).rejects.toThrow('xhr poll error');
                  expect(adminInterceptor.clients).toHaveLength(0);
                });
              },
            );
          },
        );
      });
    });

    it('should answer polling requests with the supported protocol error for EIO=3', async () => {
      const baseURL = getBaseURL();

      await usingIgnoredConsole(['warn'], async (console) => {
        await usingWebSocketInterceptor<AnySchema>(
          {
            type,
            baseURL,
            messageSaving: { enabled: true },
            connectionSaving: { enabled: true },
            protocol: createSocketIOProtocol(),
          },
          async (interceptor) => {
            const response = await fetch(`${baseURL.replace(/^ws/, 'http')}/socket.io/?EIO=3&transport=polling`);

            expect(response.status).toBe(400);
            expect(await response.json()).toEqual({
              code: 5,
              message: 'Engine.IO protocol version 3 is not supported. Use version 4.',
            });
            expect(interceptor.clients).toHaveLength(0);
            expect(console.warn.mock.calls[0].join(' ')).toContain('protocol version 3');
          },
        );
      });
    });
  });

  describe('Unsupported versions', () => {
    it('should close WebSocket connections using EIO=3 naming the unsupported version', async () => {
      const baseURL = getBaseURL();

      await usingIgnoredConsole(['warn'], async (console) => {
        await usingWebSocketInterceptor<AnySchema>(
          {
            type,
            baseURL,
            messageSaving: { enabled: true },
            connectionSaving: { enabled: true },
            protocol: createSocketIOProtocol(),
          },
          async () => {
            const socket = new WebSocket(`${baseURL}/socket.io/?EIO=3&transport=websocket`);

            const closeEvent = await new Promise<CloseEvent>((resolve) => {
              socket.addEventListener('close', resolve, { once: true });
            });

            expect(closeEvent.code).toBe(4000);
            expect(closeEvent.reason).toBe('Engine.IO protocol version 3 is not supported. Use version 4.');
            expect(console.warn).toHaveBeenCalledTimes(1);
          },
        );
      });
    });

    it('should close WebSocket connections without an Engine.IO version', async () => {
      const baseURL = getBaseURL();

      await usingIgnoredConsole(['warn'], async () => {
        await usingWebSocketInterceptor<AnySchema>({ type, baseURL, protocol: createSocketIOProtocol() }, async () => {
          const socket = new WebSocket(`${baseURL}/socket.io/?transport=websocket`);

          const closeEvent = await new Promise<CloseEvent>((resolve) => {
            socket.addEventListener('close', resolve, { once: true });
          });

          expect(closeEvent.reason).toBe('Engine.IO protocol version unknown is not supported. Use version 4.');
        });
      });
    });
  });

  describe('Outgoing messages', () => {
    it('should reject messages without a type or ack ID', async () => {
      const baseURL = getBaseURL();

      await usingIgnoredConsole(['error'], async () => {
        await usingWebSocketInterceptor<AnySchema>(
          {
            type,
            baseURL,
            messageSaving: { enabled: true },
            connectionSaving: { enabled: true },
            protocol: createSocketIOProtocol(),
          },
          async (interceptor) => {
            await usingSocket(baseURL, { transports: [GlobalWebSocketTransport] }, async (socket) => {
              await waitForSocketConnection(socket);

              expect(() => {
                interceptor.clients[0].send('plain text' as never);
              }).toThrow('Socket.IO messages must be objects with `type` or `ackId`, but received: plain text.');
            });
          },
        );
      });
    });

    it('should reject binary attachments sent as blobs', async () => {
      const baseURL = getBaseURL();

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          await usingSocket(baseURL, { transports: [GlobalWebSocketTransport] }, async (socket) => {
            await waitForSocketConnection(socket);

            expect(() => {
              interceptor.clients[0].send({ type: 'file', data: new Blob(['data']) });
            }).toThrow('Socket.IO binary attachments sent by interceptors must be ArrayBuffers or views.');
          });
        },
      );
    });
  });

  describe('Protocol instances', () => {
    it('should not allow one protocol instance to be used by two running interceptors', async () => {
      const baseURL = getBaseURL();
      const protocol = createSocketIOProtocol();
      const otherBaseURL = `${baseURL}/other`;

      await usingWebSocketInterceptor<AnySchema>({ type, baseURL, protocol }, async (interceptor) => {
        await usingIgnoredConsole(['error'], async () => {
          await expect(
            usingWebSocketInterceptor<AnySchema>({ type, baseURL: otherBaseURL, protocol }, vi.fn()),
          ).rejects.toThrow('A Socket.IO protocol can be used by only one running interceptor.');
        });

        await usingSocket(baseURL, { transports: [GlobalWebSocketTransport] }, async (socket) => {
          await waitForSocketConnection(socket);
          expect(interceptor.clients).toHaveLength(1);
        });
      });
    });
  });

  describe('HTTP requests outside the Socket.IO path', () => {
    it('should not decide requests to other paths under the base URL', async () => {
      const baseURL = getBaseURL();
      const httpBaseURL = baseURL.replace(/^ws/, 'http');

      await usingWebSocketInterceptor<AnySchema>({ type, baseURL, protocol: createSocketIOProtocol() }, async () => {
        await usingHttpInterceptor<HealthSchema>(
          { type, baseURL: httpBaseURL, onUnhandledRequest: { action: 'reject', log: false } },
          async (httpInterceptor) => {
            await httpInterceptor.get('/health').respond({ status: 204, body: null }).times(1);

            const response = await fetch(`${httpBaseURL}/health`);
            expect(response.status).toBe(204);
          },
        );
      });
    });
  });
}
