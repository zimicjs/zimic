import { waitFor } from '@zimic/utils/time';
import { io, type ManagerOptions, Socket } from 'socket.io-client';
import msgpackParser from 'socket.io-msgpack-parser';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import type { WebSocketInterceptorType } from '../../../interceptor/types/options';
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

interface SharedSocketIOTestsOptions {
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
  PollingTransport: NonNullable<ManagerOptions['transports']>[number];
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

async function waitForSocketConnection(socket: Socket) {
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

export function declareSocketIOProtocolTests(options: SharedSocketIOTestsOptions) {
  const { type, getBaseURL, PollingTransport } = options;

  const transportCases = [
    { transportName: 'websocket', transports: [GlobalWebSocketTransport] },
    { transportName: 'polling', transports: [PollingTransport] },
    { transportName: 'polling with upgrade', transports: [PollingTransport, GlobalWebSocketTransport] },
  ] as ManagerOptions['transports'] extends infer _T
    ? { transportName: string; transports: ManagerOptions['transports'] }[]
    : never;

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

            socket.emit('user:create', { name: 'Name' }, () => undefined);

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

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol(),
        },
        async (interceptor) => {
          await usingSocket(baseURL, { transports: upgradingTransports }, async (socket) => {
            const receivedEvents: unknown[] = [];
            socket.on('event', (data: unknown) => receivedEvents.push(data));

            socket.io.engine.once('upgrading', () => {
              interceptor.server.send({ type: 'event', data: 'during upgrade' } as never);
            });

            await waitForSocketConnection(socket);

            await waitFor(() => expect(socket.io.engine.transport.name).toBe('websocket'));
            await waitFor(() => expect(receivedEvents).toEqual(['during upgrade']));
          });
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
            interceptor.server.send({ type: 'event', data: 'polling' } as never);

            expect(await eventPromise).toBe('polling');
          });
        },
      );
    });

    it('should refuse polling sessions rejected by a connection handler', async () => {
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
          await interceptor.connection().respond({ action: 'reject' }).times(1);

          await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
            await expect(waitForSocketConnection(socket)).rejects.toThrow();
            expect(interceptor.clients).toHaveLength(0);
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
            .effect((client) => client.send({ type: 'welcome', data: 'hello' } as never))
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
              interceptor.clients[0].send({ type: 'file', data: new Blob(['data']) } as never);
            }).toThrow('Socket.IO binary attachments sent by interceptors must be ArrayBuffers or views.');
          });
        },
      );
    });
  });

  it('should type event messages and acks from the event declarations', async () => {
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
        const handler = await interceptor.message().with({ type: 'user:create' }).times(0);

        expectTypeOf(handler.messages[0]?.data.type).toEqualTypeOf<'user:create'>();
        expectTypeOf(handler.messages[0]?.data.data).toEqualTypeOf<{ name: string }>();
      },
    );
  });
}
