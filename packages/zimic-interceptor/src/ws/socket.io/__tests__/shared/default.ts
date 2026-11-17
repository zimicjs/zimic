import type { HttpSchema } from '@zimic/http';
import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { ValidationError } from '@zimic/utils/validation';
import { WebSocketClient, type WebSocketSchema, type WebSocketSchemaMessage } from '@zimic/ws';
import color from 'picocolors';
import {
  Manager,
  type ManagerOptions,
  type NodeXHR,
  type Socket,
  type WebSocket as SocketIOWebSocketTransport,
  type XHR,
} from 'socket.io-client';
import msgpackParser from 'socket.io-msgpack-parser';
import * as defaultParser from 'socket.io-parser';
import type { Packet } from 'socket.io-parser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createHttpInterceptor } from '@/http';
import { removeTrailingSlash } from '@/utils/urls';
import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { waitForWebSocketClientClose } from '@tests/utils/webSocket';

import { createWebSocketInterceptor } from '../../../interceptor/factory';
import type { WebSocketInterceptorClient } from '../../../interceptor/types/messages';
import type { WebSocketInterceptorPlatform, WebSocketInterceptorType } from '../../../interceptor/types/options';
import type {
  LocalWebSocketInterceptor,
  RemoteWebSocketInterceptor,
  WebSocketInterceptor,
} from '../../../interceptor/types/public';
import DuplicateSocketIONamespaceError from '../../errors/DuplicateSocketIONamespaceError';
import InvalidSocketIOPollingInterceptorError from '../../errors/InvalidSocketIOPollingInterceptorError';
import MismatchedSocketIOProtocolOptionsError from '../../errors/MismatchedSocketIOProtocolOptionsError';
import SharedSocketIOProtocolError from '../../errors/SharedSocketIOProtocolError';
import { createSocketIOProtocol } from '../../factory';
import type { SocketIOMessage } from '../../types/messages';
import type { SocketIOParser, SocketIOProtocolOptions } from '../../types/options';
import type { SocketIOPollingSchema } from '../../types/polling';
import type { SocketIOSchema } from '../../types/schema';

/* eslint-disable @typescript-eslint/naming-convention -- Socket.IO event names commonly use colons. */
interface ServerToClientEvents {
  'user:created': (user: { id: string }, source: string) => void;
}

interface ClientToServerEvents {
  'user:join': (input: { name: string }) => void;
  'user:notify': (input: { name: string }, priority: number, channel: string) => void;
  'user:create': (input: { name: string }, ack: (user: { id: string }, source: string) => void) => void;
  'user:ping': (ack: () => void) => void;
}

interface BinaryServerToClientEvents {
  'file:copy': (file: ArrayBuffer) => void;
}

interface BinaryClientToServerEvents {
  file: (file: ArrayBuffer) => void;
}
/* eslint-enable @typescript-eslint/naming-convention */

type ChatSchema = SocketIOSchema<ServerToClientEvents, ClientToServerEvents>;

type ChatInterceptor = LocalWebSocketInterceptor<ChatSchema> | RemoteWebSocketInterceptor<ChatSchema>;

type BinarySchema = SocketIOSchema<BinaryServerToClientEvents, BinaryClientToServerEvents>;

type AnySchema = SocketIOSchema;

type AnySocketIOInterceptor = LocalWebSocketInterceptor<AnySchema> | RemoteWebSocketInterceptor<AnySchema>;

type SocketIOTestInterceptor = Pick<WebSocketInterceptor<AnySchema>, 'clear' | 'stop'>;

type PlainSchema = WebSocketSchema<{ '/': { message: string } }>;

type HealthSchema = HttpSchema<{
  '/health': { GET: { response: { 204: { body: null } } } };
}>;

interface SharedSocketIOTestsOptions {
  platform: WebSocketInterceptorPlatform;
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
  getAuthenticatedBaseURL: () => string;
  getValidToken: () => string;
  PollingTransport: typeof NodeXHR | typeof XHR;
  WebSocketTransport: typeof SocketIOWebSocketTransport;
}

const PING_INTERVAL = 25000;

const POLLING_PACKET_SEPARATOR = '\x1e';

async function usingSocketManager(
  baseURL: string,
  options: Partial<ManagerOptions>,
  callback: (manager: Manager) => Promise<void>,
) {
  const { origin, pathname } = new URL(baseURL);

  const manager = new Manager(origin.replace(/^ws/, 'http'), {
    path: `${removeTrailingSlash(pathname)}/`,
    reconnection: false,
    ...options,
  });

  try {
    await callback(manager);
  } finally {
    const { engine } = manager;

    if (engine.readyState !== 'closed') {
      const closePromise = new Promise<void>((resolve) => {
        engine.once('close', () => resolve());
      });

      engine.close();
      await closePromise;
    }
  }
}

async function usingSocket(
  baseURL: string,
  options: Partial<ManagerOptions> & { nsp?: string },
  callback: (socket: Socket) => Promise<void>,
) {
  const { nsp = '/', ...managerOptions } = options;

  await usingSocketManager(baseURL, managerOptions, async (manager) => {
    const socket = manager.socket(nsp);

    try {
      await callback(socket);
    } finally {
      socket.disconnect();
    }
  });
}

async function waitForSocketConnection(socket: Socket) {
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

async function waitForSocketDisconnection(socket: Socket) {
  await new Promise<void>((resolve) => {
    socket.once('disconnect', () => resolve());
  });
}

export function declareSocketIOProtocolTests(options: SharedSocketIOTestsOptions) {
  const {
    platform,
    type,
    getBaseURL: getServerBaseURL,
    getAuthenticatedBaseURL,
    getValidToken,
    PollingTransport,
    WebSocketTransport,
  } = options;

  // The base URLs of the WebSocket and polling interceptors end with the Socket.IO path, which is the `path` option of
  // the clients.
  function getBaseURL() {
    return `${getServerBaseURL()}/socket.io`;
  }

  function createPollingInterceptor(baseURL: string) {
    return createHttpInterceptor<SocketIOPollingSchema>({
      type,
      baseURL: baseURL.replace(/^ws/, 'http'),
      requestSaving: { enabled: false },
    });
  }

  let baseURL: string;
  let polling: ReturnType<typeof createPollingInterceptor>;

  beforeEach(() => {
    baseURL = getBaseURL();
    polling = createPollingInterceptor(baseURL);
  });

  function getSocketIOInterceptorOptions<Message extends SocketIOMessage = SocketIOMessage>(
    protocolOptions: SocketIOProtocolOptions = {},
  ) {
    return {
      type,
      baseURL,
      messageSaving: { enabled: true },
      connectionSaving: { enabled: true },
      protocol: createSocketIOProtocol<Message>({ polling, ...protocolOptions }),
    };
  }

  async function usingNamespaceInterceptors(
    callback: (rootInterceptor: AnySocketIOInterceptor, adminInterceptor: AnySocketIOInterceptor) => Promise<void>,
  ) {
    await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (rootInterceptor) => {
      await usingWebSocketInterceptor<AnySchema>(
        getSocketIOInterceptorOptions({ namespace: '/admin' }),
        async (adminInterceptor) => {
          await callback(rootInterceptor, adminInterceptor);
        },
      );
    });
  }

  const transportCases: { transportName: string; transports: ManagerOptions['transports'] }[] = [
    { transportName: 'polling', transports: [PollingTransport] },
  ];

  // Local interceptors serve Socket.IO over polling only.
  if (type === 'remote') {
    transportCases.push(
      { transportName: 'websocket', transports: [WebSocketTransport] },
      { transportName: 'polling with upgrade', transports: [PollingTransport, WebSocketTransport] },
    );
  }

  describe.each(transportCases)('Transport: $transportName', ({ transports }) => {
    it.each<{
      eventDescription: string;
      emit: (socket: Socket) => void;
      expectedMessage: Extract<WebSocketSchemaMessage<ChatSchema>, { type: string }>;
    }>([
      {
        eventDescription: 'one argument',
        emit: (socket) => socket.emit('user:join', { name: 'Name' }),
        expectedMessage: { type: 'user:join', data: { name: 'Name' } },
      },
      {
        eventDescription: 'several arguments',
        emit: (socket) => socket.emit('user:notify', { name: 'Name' }, 2, 'email'),
        expectedMessage: { type: 'user:notify', data: { name: 'Name' }, args: [2, 'email'] },
      },
      {
        eventDescription: 'an ack callback',
        emit: (socket) => socket.emit('user:create', { name: 'Name' }, vi.fn()),
        expectedMessage: { type: 'user:create', data: { name: 'Name' }, ackId: expect.any(Number) as number },
      },
    ])('should intercept events with $eventDescription as messages', async ({ emit, expectedMessage }) => {
      await usingWebSocketInterceptor<ChatSchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        const handler = await interceptor.message().with({ type: expectedMessage.type }).times(1);

        await usingSocket(baseURL, { transports }, async (socket) => {
          await waitForSocketConnection(socket);

          emit(socket);

          await waitFor(() => expect(handler.messages).toHaveLength(1));
          expect(handler.messages[0].data).toStrictEqual(expectedMessage);
        });
      });
    });

    it('should send event responses with their first argument and args', async () => {
      await usingWebSocketInterceptor<ChatSchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
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
          socket.emit('user:notify', { name: 'Name' }, 2, 'email');

          expect(await responsePromise).toEqual([{ id: '1' }, 'server']);
        });
      });
    });

    it.each<{
      ackDescription: string;
      declareHandler: (interceptor: ChatInterceptor) => PromiseLike<unknown> | object;
      emitWithAck: (socket: Socket, ack: (...args: unknown[]) => void) => void;
      expectedAckArguments: unknown[];
    }>([
      {
        ackDescription: 'arguments',
        declareHandler: (interceptor) =>
          interceptor
            .message()
            .with({ type: 'user:create' })
            .respond((message) => ({ ackId: message.ackId, data: { id: '1' }, args: ['server'] }))
            .times(1),
        emitWithAck: (socket, ack) => socket.emit('user:create', { name: 'Name' }, ack),
        expectedAckArguments: [{ id: '1' }, 'server'],
      },
      {
        ackDescription: 'no arguments',
        declareHandler: (interceptor) =>
          interceptor
            .message()
            .with({ type: 'user:ping' })
            .respond((message) => ({ ackId: message.ackId }))
            .times(1),
        emitWithAck: (socket, ack) => socket.emit('user:ping', ack),
        expectedAckArguments: [],
      },
    ])(
      'should acknowledge events with $ackDescription by responding with their ack ID',
      async ({ declareHandler, emitWithAck, expectedAckArguments }) => {
        await usingWebSocketInterceptor<ChatSchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          await declareHandler(interceptor);

          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            const ackPromise = new Promise<unknown[]>((resolve) => {
              emitWithAck(socket, (...args) => resolve(args));
            });

            expect(await ackPromise).toEqual(expectedAckArguments);
          });
        });
      },
    );

    it('should intercept binary attachments as array buffers', async () => {
      await usingWebSocketInterceptor<BinarySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        const handler = await interceptor.message().with({ type: 'file' }).times(1);

        await usingSocket(baseURL, { transports }, async (socket) => {
          await waitForSocketConnection(socket);

          socket.emit('file', new Uint8Array([0x00, 0xff]).buffer);

          await waitFor(() => expect(handler.messages).toHaveLength(1));

          const { data } = handler.messages[0].data;
          expect(data).toBeInstanceOf(ArrayBuffer);
          expect(Array.from(new Uint8Array(data))).toEqual([0x00, 0xff]);
        });
      });
    });

    it('should send binary attachments', async () => {
      await usingWebSocketInterceptor<BinarySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await interceptor
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
        });
      });
    });

    it('should encode and decode events with a custom parser', async () => {
      await usingWebSocketInterceptor<ChatSchema>(
        getSocketIOInterceptorOptions({ parser: msgpackParser }),
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
            socket.emit('user:notify', { name: 'Name' }, 2, 'email');

            expect(await responsePromise).toEqual([{ id: '1' }, 'server']);
          });
        },
      );
    });

    it('should handle each namespace with its own interceptor', async () => {
      await usingNamespaceInterceptors(async (rootInterceptor, adminInterceptor) => {
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
      });
    });

    it('should list a client only in the interceptors of the namespaces it joined', async () => {
      await usingNamespaceInterceptors(async (rootInterceptor, adminInterceptor) => {
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
      await usingNamespaceInterceptors(async (rootInterceptor, adminInterceptor) => {
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
      });
    });

    it('should open one Engine.IO connection for the namespaces of a manager', async () => {
      await usingNamespaceInterceptors(async () => {
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
      await usingNamespaceInterceptors(async (rootInterceptor, adminInterceptor) => {
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
      });
    });

    it('should keep other namespaces connected when the interceptor of one namespace is cleared', async () => {
      await usingNamespaceInterceptors(async (rootInterceptor, adminInterceptor) => {
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
              getSocketIOInterceptorOptions({ namespace: '/admin' }),
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
        await usingNamespaceInterceptors(async (_rootInterceptor, adminInterceptor) => {
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
      await usingNamespaceInterceptors(async (_rootInterceptor, adminInterceptor) => {
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

          await usingSocket(baseURL, { transports }, async () => {
            await decisionStartedPromise;
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
            await letGo(interceptor);
            decisionReleasedPromise.resolve();

            await closePromise;
            expect(socket.io.engine.readyState).toBe('closed');
          });
        });
      },
    );

    it('should send pings without user handlers', async () => {
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

    it('should list a connected socket as one client', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingSocket(baseURL, { transports }, async (socket) => {
          await waitForSocketConnection(socket);
          expect(interceptor.clients).toHaveLength(1);
        });
      });
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

  describe('Polling sessions', () => {
    const pollingTransports: ManagerOptions['transports'] = [PollingTransport];

    // Local interceptors serve Socket.IO over polling only, so only remote clients upgrade to WebSocket.
    if (type === 'remote') {
      // Holds the upgrade of polling clients until released, so tests decide when it happens.
      function createDeferredUpgradeTransports() {
        const upgradeReleasePromise = createPromiseWithResolvers<void>();

        class DeferredWebSocketTransport extends WebSocketTransport {
          doOpen() {
            void upgradeReleasePromise.then(() => super.doOpen());
            return this;
          }
        }

        return {
          transports: [PollingTransport, DeferredWebSocketTransport],
          releaseUpgrade: () => upgradeReleasePromise.resolve(),
        };
      }

      it('should keep one client across the upgrade to WebSocket', async () => {
        const { transports, releaseUpgrade } = createDeferredUpgradeTransports();

        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          const handler = await interceptor.message().with({ type: 'event' }).times(2);

          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);
            expect(socket.io.engine.transport.name).toBe('polling');

            socket.emit('event', 'before');
            await waitFor(() => expect(handler.messages).toHaveLength(1));

            releaseUpgrade();
            await waitFor(() => expect(socket.io.engine.transport.name).toBe('websocket'));

            socket.emit('event', 'after');
            await waitFor(() => expect(handler.messages).toHaveLength(2));

            expect(interceptor.clients).toHaveLength(1);
            expect(handler.messages[1].sender).toBe(handler.messages[0].sender);
          });
        });
      });

      it('should deliver messages sent while a client upgrades', async () => {
        const { transports, releaseUpgrade } = createDeferredUpgradeTransports();

        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          await usingSocket(baseURL, { transports }, async (socket) => {
            const receivedEvents: unknown[] = [];
            socket.on('event', (data: unknown) => receivedEvents.push(data));

            await waitForSocketConnection(socket);

            socket.io.engine.once('upgrading', () => {
              interceptor.server.send({ type: 'event', data: 'during upgrade' });
            });

            releaseUpgrade();

            await waitFor(() => expect(socket.io.engine.transport.name).toBe('websocket'));
            await waitFor(() => expect(receivedEvents).toEqual(['during upgrade']));
          });
        });
      });

      it('should not connect WebSocket connections with an unknown session ID', async () => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          const socket = new WebSocket(`${baseURL}/?EIO=4&transport=websocket&sid=unknown`);

          const closeEvent = await new Promise<CloseEvent>((resolve) => {
            socket.addEventListener('close', resolve, { once: true });
          });

          expect(closeEvent.reason).toBe('Session ID unknown');
          expect(interceptor.clients).toHaveLength(0);
        });
      });

      it('should close WebSocket connections opened while the last namespace stops', async () => {
        const pollingStopStartedPromise = createPromiseWithResolvers<void>();
        const pollingStopReleasedPromise = createPromiseWithResolvers<void>();
        const stopPolling = polling.stop.bind(polling);

        // No public call pauses a stop, so the polling interceptor holds it to open a connection while it runs.
        vi.spyOn(polling, 'stop').mockImplementation(async () => {
          pollingStopStartedPromise.resolve();
          await pollingStopReleasedPromise;
          await stopPolling();
        });

        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          const stopPromise = interceptor.stop();

          try {
            await pollingStopStartedPromise;

            const socket = new WebSocket(`${baseURL}/?EIO=4&transport=websocket`);

            const messageListener = vi.fn();
            socket.addEventListener('message', messageListener);

            const closeEvent = await new Promise<CloseEvent>((resolve) => {
              socket.addEventListener('close', resolve, { once: true });
            });

            expect(closeEvent.code).toBe(1005);
            expect(messageListener).not.toHaveBeenCalled();
            expect(interceptor.clients).toHaveLength(0);
          } finally {
            pollingStopReleasedPromise.resolve();
            await stopPromise;
          }
        });
      });
    }

    // Local interceptors serve Socket.IO over polling only, so they close WebSocket connections.
    if (type === 'local') {
      it('should close WebSocket connections naming polling as the supported transport', async () => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          const socket = new WebSocket(`${baseURL}/?EIO=4&transport=websocket`);

          const socketEvents: string[] = [];
          socket.addEventListener('open', () => socketEvents.push('open'), { once: true });

          const closeEvent = await new Promise<CloseEvent>((resolve) => {
            socket.addEventListener(
              'close',
              (event) => {
                socketEvents.push('close');
                resolve(event);
              },
              { once: true },
            );
          });

          expect(socketEvents).toEqual(['open', 'close']);
          expect(closeEvent.code).toBe(4002);
          expect(closeEvent.reason).toBe(
            'Local Socket.IO interceptors support polling; use a remote interceptor for WebSocket transports',
          );
          expect(interceptor.clients).toHaveLength(0);
        });
      });
    }

    // In Node.js, the default WebSocket transport of `socket.io-client` uses the `ws` package instead of the global
    // `WebSocket`, so local interceptors do not receive its upgrade probe.
    if (type === 'local' && platform === 'browser') {
      it('should keep clients with the default transports connected over polling after their upgrade fails', async () => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          const handler = await interceptor.message().with({ type: 'event' }).times(1);

          await usingSocket(baseURL, {}, async (socket) => {
            const upgradeErrorPromise = new Promise<void>((resolve) => {
              socket.io.engine.once('upgradeError', () => resolve());
            });

            await waitForSocketConnection(socket);
            await upgradeErrorPromise;

            socket.emit('event', 'after upgrade error');
            await waitFor(() => expect(handler.messages).toHaveLength(1));

            expect(handler.messages[0].data).toStrictEqual({ type: 'event', data: 'after upgrade error' });
            expect(socket.io.engine.transport.name).toBe('polling');
            expect(socket.connected).toBe(true);
          });
        });
      });
    }

    it('should ignore polling packets without a session ID', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        const response = await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling`, {
          method: 'POST',
          body: '40',
        });

        expect(response.status).toBe(200);
        expect(interceptor.clients).toHaveLength(0);
      });
    });

    it('should ignore polling packets without a body', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
          await waitForSocketConnection(socket);

          const response = await fetch(
            `${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling&sid=${socket.io.engine.id}`,
            { method: 'POST' },
          );

          expect(response.status).toBe(200);
          expect(await response.text()).toBe('ok');
          expect(interceptor.clients).toHaveLength(1);
          expect(socket.connected).toBe(true);
        });
      });
    });

    it('should answer overlapping polls with a bad request error', async () => {
      const pollingURL = `${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling`;

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
        const openPacket = await (await fetch(pollingURL)).text();
        const { sid } = JSON.parse(openPacket.slice(1)) as { sid: string };
        const sessionURL = `${pollingURL}&sid=${sid}`;

        // Either poll may reach the session first, and the other one overlaps it.
        const polls = [fetch(sessionURL), fetch(sessionURL)];

        const overlappingPoll = await Promise.race(polls);
        expect(overlappingPoll.status).toBe(400);
        expect(await overlappingPoll.json()).toEqual({ code: 3, message: 'Bad request' });

        await fetch(sessionURL, { method: 'POST', body: '1' });

        const pendingPoll = (await Promise.all(polls)).find((poll) => poll !== overlappingPoll);
        expect(pendingPoll?.status).toBe(200);
        expect(await pendingPoll?.text()).toBe('1');
      });
    });

    it('should keep one client when a socket sends a second connect packet for its namespace', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        const handler = await interceptor.message().with({ type: 'event' }).times(1);

        await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
          await waitForSocketConnection(socket);

          await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling&sid=${socket.io.engine.id}`, {
            method: 'POST',
            body: '40',
          });

          socket.emit('event', 'after second connect');
          await waitFor(() => expect(handler.messages).toHaveLength(1));

          expect(interceptor.clients).toHaveLength(1);
          expect(socket.connected).toBe(true);
        });
      });
    });

    it('should handle the packets after a malformed one in a polling payload', async () => {
      await usingIgnoredConsole(['error'], async (console) => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          const handler = await interceptor.message().with({ type: 'event' }).times(1);

          await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
            await waitForSocketConnection(socket);

            await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling&sid=${socket.io.engine.id}`, {
              method: 'POST',
              body: ['42[malformed', '42["event","valid"]'].join(POLLING_PACKET_SEPARATOR),
            });

            await waitFor(() => expect(handler.messages).toHaveLength(1));
            expect(handler.messages[0].data).toStrictEqual({ type: 'event', data: 'valid' });

            expect(console.error).toHaveBeenCalledWith(new Error('invalid payload'));
            expect(console.error).toHaveBeenCalledTimes(1);
          });
        });
      });
    });

    it('should ignore the packets after a close packet in a polling payload', async () => {
      const pollingURL = `${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling`;

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        const openPacket = await (await fetch(pollingURL)).text();
        const { sid } = JSON.parse(openPacket.slice(1)) as { sid: string };

        await fetch(`${pollingURL}&sid=${sid}`, {
          method: 'POST',
          body: ['1', '40'].join(POLLING_PACKET_SEPARATOR),
        });

        // Connections are decided in order, so the next socket connects after a connection from the payload would.
        await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
          await waitForSocketConnection(socket);
          expect(interceptor.clients).toHaveLength(1);
        });
      });
    });

    it('should not intercept events whose name is not a string', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        const handler = await interceptor.message();

        await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
          await waitForSocketConnection(socket);

          await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling&sid=${socket.io.engine.id}`, {
            method: 'POST',
            body: ['42[1,"numeric"]', '42["event","valid"]'].join(POLLING_PACKET_SEPARATOR),
          });

          await waitFor(() => expect(handler.messages).toHaveLength(1));
          expect(handler.messages[0].data).toStrictEqual({ type: 'event', data: 'valid' });
        });
      });
    });

    it('should not intercept events that the parser decodes without an array of arguments', async () => {
      // Decodes `bare` events without arguments, which the default parser never does.
      class BareEventDecoder {
        private decoder = new defaultParser.Decoder();

        add(chunk: unknown) {
          this.decoder.add(chunk);
        }

        on(event: 'decoded', listener: (packet: Packet) => void) {
          return this.decoder.on(event, (packet) => {
            const isBareEvent = Array.isArray(packet.data) && packet.data[0] === 'bare';
            listener(isBareEvent ? { ...packet, data: null } : packet);
          });
        }
      }

      const parser: SocketIOParser = { Encoder: defaultParser.Encoder, Decoder: BareEventDecoder };

      await usingIgnoredConsole(['error'], async (console) => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions({ parser }), async (interceptor) => {
          const handler = await interceptor.message();

          await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
            await waitForSocketConnection(socket);

            socket.emit('bare');
            socket.emit('event', 'valid');

            await waitFor(() => expect(handler.messages).toHaveLength(1));
            expect(handler.messages[0].data).toStrictEqual({ type: 'event', data: 'valid' });

            expect(console.error).not.toHaveBeenCalled();
          });
        });
      });
    });

    it('should not intercept acks sent by clients', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        const handler = await interceptor.message();

        await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
          await waitForSocketConnection(socket);

          await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling&sid=${socket.io.engine.id}`, {
            method: 'POST',
            body: ['431["ack"]', '42["event","valid"]'].join(POLLING_PACKET_SEPARATOR),
          });

          await waitFor(() => expect(handler.messages).toHaveLength(1));
          expect(handler.messages[0].data).toStrictEqual({ type: 'event', data: 'valid' });
        });
      });
    });

    it('should not intercept events of sessions that did not connect to the namespace', async () => {
      const pollingURL = `${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling`;

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        const handler = await interceptor.message();

        const openPacket = await (await fetch(pollingURL)).text();
        const { sid } = JSON.parse(openPacket.slice(1)) as { sid: string };
        const sessionURL = `${pollingURL}&sid=${sid}`;

        await fetch(sessionURL, { method: 'POST', body: '42["event","before connect"]' });
        await fetch(sessionURL, { method: 'POST', body: '40' });

        const connectReply = await (await fetch(sessionURL)).text();
        expect(connectReply).toMatch(/^40\{"sid":/);

        await fetch(sessionURL, { method: 'POST', body: '42["event","after connect"]' });

        await waitFor(() => expect(handler.messages).toHaveLength(1));
        expect(handler.messages[0].data).toStrictEqual({ type: 'event', data: 'after connect' });
      });
    });

    it('should not open polling sessions while the last namespace stops', async () => {
      const pollingStopStartedPromise = createPromiseWithResolvers<void>();
      const pollingStopReleasedPromise = createPromiseWithResolvers<void>();
      const stopPolling = polling.stop.bind(polling);

      // No public call pauses a stop, so the polling interceptor holds it to open a session while it runs.
      vi.spyOn(polling, 'stop').mockImplementation(async () => {
        pollingStopStartedPromise.resolve();
        await pollingStopReleasedPromise;
        await stopPolling();
      });

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        const stopPromise = interceptor.stop();

        try {
          await pollingStopStartedPromise;

          const response = await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling`);

          expect(response.status).toBe(403);
          expect(await response.json()).toEqual({ code: 4, message: 'Forbidden' });
        } finally {
          pollingStopReleasedPromise.resolve();
          await stopPromise;
        }
      });
    });

    it('should run connection effects with the polling client', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
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
      });
    });

    // Local interceptors serve Socket.IO over polling only, so only remote clients connect over WebSocket.
    if (type === 'remote') {
      it('should connect WebSocket clients without a polling interceptor', async () => {
        await usingWebSocketInterceptor<AnySchema>(
          { type, baseURL, connectionSaving: { enabled: true }, protocol: createSocketIOProtocol() },
          async (interceptor) => {
            await usingSocket(baseURL, { transports: [WebSocketTransport] }, async (socket) => {
              await waitForSocketConnection(socket);
              expect(interceptor.clients).toHaveLength(1);
            });
          },
        );
      });
    }

    it('should connect polling clients on a custom Socket.IO path', async () => {
      const customBaseURL = `${getServerBaseURL()}/custom/realtime`;
      const customPolling = createPollingInterceptor(customBaseURL);

      await usingWebSocketInterceptor<AnySchema>(
        {
          type,
          baseURL: customBaseURL,
          connectionSaving: { enabled: true },
          protocol: createSocketIOProtocol({ polling: customPolling }),
        },
        async (interceptor) => {
          await usingSocket(customBaseURL, { transports: pollingTransports }, async (socket) => {
            await waitForSocketConnection(socket);

            expect(socket.io.engine.transport.name).toBe('polling');
            expect(interceptor.clients).toHaveLength(1);
          });
        },
      );
    });

    it('should answer polling requests with the supported protocol error for EIO=3', async () => {
      await usingIgnoredConsole(['warn'], async (console) => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          const response = await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=3&transport=polling`);

          expect(response.status).toBe(400);
          expect(await response.json()).toEqual({
            code: 5,
            message: 'Engine.IO protocol version 3 is not supported. Use version 4.',
          });
          expect(interceptor.clients).toHaveLength(0);

          expect(console.warn).toHaveBeenCalledWith(
            color.cyan('[@zimic/interceptor]'),
            'Engine.IO protocol version 3 is not supported. Use version 4.',
          );
          expect(console.warn).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  // Local interceptors close every WebSocket connection before reading its Engine.IO version, because they serve
  // Socket.IO over polling only.
  if (type === 'remote') {
    describe('Unsupported versions', () => {
      it.each([
        { versionDescription: 'EIO=3', query: 'EIO=3&transport=websocket', version: '3' },
        { versionDescription: 'no Engine.IO version', query: 'transport=websocket', version: 'unknown' },
      ])(
        'should close WebSocket connections with an unsupported Engine.IO version ($versionDescription)',
        async ({ query, version }) => {
          const unsupportedVersionMessage = `Engine.IO protocol version ${version} is not supported. Use version 4.`;

          await usingIgnoredConsole(['warn'], async (console) => {
            await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
              const client = new WebSocketClient<PlainSchema>(`${baseURL}/?${query}`);

              try {
                const closeEventPromise = waitForWebSocketClientClose(client);
                await client.open();

                const closeEvent = await closeEventPromise;
                expect(closeEvent.code).toBe(4000);
                expect(closeEvent.reason).toBe(unsupportedVersionMessage);
              } finally {
                await client.close();
              }

              expect(console.warn).toHaveBeenCalledWith(color.cyan('[@zimic/interceptor]'), unsupportedVersionMessage);
              expect(console.warn).toHaveBeenCalledTimes(1);
            });
          });
        },
      );
    });
  }

  describe('Outgoing messages', () => {
    it.each([
      {
        messageDescription: 'a string',
        message: 'plain text',
        expectedError: new ValidationError(
          'Socket.IO messages must be objects with `type` or `ackId`, but received: plain text.',
        ),
      },
      {
        messageDescription: 'an object without a type or ack ID',
        message: { data: 1 },
        expectedError: new ValidationError(
          'Socket.IO messages must be objects with `type` or `ackId`, but received: {"data":1}.',
        ),
      },
      {
        messageDescription: 'null',
        message: null,
        expectedError: new ValidationError(
          'Socket.IO messages must be objects with `type` or `ackId`, but received: null.',
        ),
      },
      {
        messageDescription: 'a binary attachment as a blob',
        message: { type: 'file', data: new Blob(['data']) },
        expectedError: new ValidationError(
          'Socket.IO binary attachments sent by interceptors must be ArrayBuffers or views.',
        ),
      },
    ])('should reject sending $messageDescription', async ({ message, expectedError }) => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
          await waitForSocketConnection(socket);

          expect(() => {
            // @ts-expect-error The strings, objects without `type` or `ackId`, and `null` of the rows are invalid messages.
            interceptor.clients[0].send(message);
          }).toThrow(expectedError);
        });
      });
    });

    it('should reject messages that the parser does not encode into arrays of chunks', async () => {
      // Encodes events into a bare chunk, as parsers declaring `encode(): ArrayBuffer` describe their output.
      class BareChunkEventEncoder {
        private encoder = new defaultParser.Encoder();

        encode(packet: Packet): unknown {
          const chunks: unknown[] = this.encoder.encode(packet);
          return packet.type === defaultParser.PacketType.EVENT ? chunks[0] : chunks;
        }
      }

      const parser: SocketIOParser = { Encoder: BareChunkEventEncoder, Decoder: defaultParser.Decoder };

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions({ parser }), async (interceptor) => {
        await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
          await waitForSocketConnection(socket);

          expect(() => {
            interceptor.clients[0].send({ type: 'event', data: 'data' });
          }).toThrow(new ValidationError('Socket.IO parsers must encode packets into arrays of chunks.'));
        });
      });
    });

    it('should log the error of parsers that do not encode namespace connection replies into arrays of chunks', async () => {
      // Encodes connection replies into a bare chunk, as parsers declaring `encode(): ArrayBuffer` describe their output.
      class BareChunkConnectEncoder {
        private encoder = new defaultParser.Encoder();

        encode(packet: Packet): unknown {
          const chunks: unknown[] = this.encoder.encode(packet);
          return packet.type === defaultParser.PacketType.CONNECT ? chunks[0] : chunks;
        }
      }

      const parser: SocketIOParser = { Encoder: BareChunkConnectEncoder, Decoder: defaultParser.Decoder };

      await usingIgnoredConsole(['error'], async (console) => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions({ parser }), async () => {
          await usingSocket(baseURL, { transports: [PollingTransport] }, async () => {
            await waitFor(() => {
              expect(console.error).toHaveBeenCalledWith(
                new ValidationError('Socket.IO parsers must encode packets into arrays of chunks.'),
              );
            });
            expect(console.error).toHaveBeenCalledTimes(1);
          });
        });
      });
    });
  });

  describe('Protocol instances', () => {
    it('should not allow one protocol instance to be used by two running interceptors', async () => {
      const protocol = createSocketIOProtocol({ polling });
      const otherBaseURL = `${baseURL}/other`;

      await usingWebSocketInterceptor<AnySchema>({ type, baseURL, protocol }, async (interceptor) => {
        await usingIgnoredConsole(['error'], async () => {
          await expect(
            usingWebSocketInterceptor<AnySchema>({ type, baseURL: otherBaseURL, protocol }, vi.fn()),
          ).rejects.toThrow(new SharedSocketIOProtocolError());
        });

        await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
          await waitForSocketConnection(socket);
          expect(interceptor.clients).toHaveLength(1);
        });
      });
    });

    it('should not allow two running interceptors on the same namespace of a base URL', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingIgnoredConsole(['error'], async () => {
          await expect(usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), vi.fn())).rejects.toThrow(
            new DuplicateSocketIONamespaceError('/', interceptor.baseURL),
          );
        });

        await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
          await waitForSocketConnection(socket);
          expect(interceptor.clients).toHaveLength(1);
        });
      });
    });

    it('should not allow the namespaces of a base URL to use different parsers', async () => {
      const otherParser: SocketIOParser = { Encoder: defaultParser.Encoder, Decoder: defaultParser.Decoder };

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingIgnoredConsole(['error'], async () => {
          await expect(
            usingWebSocketInterceptor<AnySchema>(
              getSocketIOInterceptorOptions({ namespace: '/admin', parser: otherParser }),
              vi.fn(),
            ),
          ).rejects.toThrow(new MismatchedSocketIOProtocolOptionsError('parser', interceptor.baseURL));
        });
      });
    });

    it('should not allow the namespaces of a base URL to use different polling interceptors', async () => {
      const otherPolling = createPollingInterceptor(baseURL);

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingIgnoredConsole(['error'], async () => {
          await expect(
            usingWebSocketInterceptor<AnySchema>(
              getSocketIOInterceptorOptions({ namespace: '/admin', polling: otherPolling }),
              vi.fn(),
            ),
          ).rejects.toThrow(new MismatchedSocketIOProtocolOptionsError('polling', interceptor.baseURL));
        });

        expect(otherPolling.isRunning).toBe(false);
      });
    });
  });

  describe('Polling interceptors', () => {
    it('should not start with a polling interceptor of another type', async () => {
      const otherTypePolling = createHttpInterceptor<SocketIOPollingSchema>({
        type: type === 'local' ? 'remote' : 'local',
        baseURL: baseURL.replace(/^ws/, 'http'),
      });

      await usingIgnoredConsole(['error'], async () => {
        await expect(
          usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions({ polling: otherTypePolling }), vi.fn()),
        ).rejects.toThrow(
          new InvalidSocketIOPollingInterceptorError(
            `its type must be '${type}', the same as the WebSocket interceptor.`,
          ),
        );
      });

      expect(otherTypePolling.isRunning).toBe(false);
    });

    it('should not start with a polling interceptor on another base URL', async () => {
      const otherBaseURLPolling = createPollingInterceptor(`${baseURL}/other`);

      await usingIgnoredConsole(['error'], async () => {
        await expect(
          usingWebSocketInterceptor<AnySchema>(
            getSocketIOInterceptorOptions({ polling: otherBaseURLPolling }),
            vi.fn(),
          ),
        ).rejects.toThrow(
          new InvalidSocketIOPollingInterceptorError(
            `its base URL must be ${baseURL.replace(/^ws/, 'http')}, the WebSocket base URL with \`http\` instead of \`ws\`.`,
          ),
        );
      });

      expect(otherBaseURLPolling.isRunning).toBe(false);
    });

    it('should not start with a running polling interceptor', async () => {
      await usingHttpInterceptor<SocketIOPollingSchema>(
        { type, baseURL: baseURL.replace(/^ws/, 'http') },
        async (runningPolling) => {
          await usingIgnoredConsole(['error'], async () => {
            await expect(
              usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions({ polling: runningPolling }), vi.fn()),
            ).rejects.toThrow(
              new InvalidSocketIOPollingInterceptorError(
                'it must not be running, because the protocol starts and stops it.',
              ),
            );
          });

          expect(runningPolling.isRunning).toBe(true);
        },
      );
    });

    // Remote interceptors serve Socket.IO over WebSocket, so they do not need a polling interceptor.
    if (type === 'local') {
      it('should not start a local interceptor without a polling interceptor', async () => {
        await usingIgnoredConsole(['error'], async () => {
          await expect(
            usingWebSocketInterceptor<AnySchema>({ type, baseURL, protocol: createSocketIOProtocol() }, vi.fn()),
          ).rejects.toThrow(
            new InvalidSocketIOPollingInterceptorError(
              'local interceptors require one, because they serve Socket.IO over polling only.',
            ),
          );
        });
      });
    }

    // Local interceptors do not connect to an interceptor server, so they do not authenticate.
    if (type === 'remote') {
      it('should be able to start after adding required authentication to the polling interceptor', async () => {
        const authenticatedBaseURL = `${getAuthenticatedBaseURL()}/socket.io`;

        const authenticatedServerPolling = createHttpInterceptor<SocketIOPollingSchema>({
          type,
          baseURL: authenticatedBaseURL.replace(/^ws/, 'http'),
          requestSaving: { enabled: false },
        });

        const interceptor = createWebSocketInterceptor<AnySchema>({
          type,
          baseURL: authenticatedBaseURL,
          auth: { token: getValidToken() },
          protocol: createSocketIOProtocol({ polling: authenticatedServerPolling }),
        });

        await usingIgnoredConsole(['error'], async () => {
          await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);
        });

        expect(interceptor.isRunning).toBe(false);

        authenticatedServerPolling.auth = { token: getValidToken() };

        try {
          await interceptor.start();

          expect(interceptor.isRunning).toBe(true);
          expect(authenticatedServerPolling.isRunning).toBe(true);
        } finally {
          await interceptor.stop();
        }
      });
    }

    it('should stop the polling interceptor with the last namespace of a base URL', async () => {
      await usingNamespaceInterceptors(async (rootInterceptor, adminInterceptor) => {
        expect(polling.isRunning).toBe(true);

        await adminInterceptor.stop();
        expect(polling.isRunning).toBe(true);

        await rootInterceptor.stop();
        expect(polling.isRunning).toBe(false);
      });
    });

    it('should start after the polling interceptor of the last namespace of a base URL stops', async () => {
      const pollingStopStartedPromise = createPromiseWithResolvers<void>();
      const pollingStopReleasedPromise = createPromiseWithResolvers<void>();
      const stopPolling = polling.stop.bind(polling);

      // No public call pauses a stop, so the polling interceptor holds it to start another interceptor while it runs.
      vi.spyOn(polling, 'stop').mockImplementation(async () => {
        pollingStopStartedPromise.resolve();
        await pollingStopReleasedPromise;
        await stopPolling();
      });

      const stoppingInterceptor = createWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions());
      await stoppingInterceptor.start();

      const stopPromise = stoppingInterceptor.stop();
      await pollingStopStartedPromise;

      const nextInterceptorPromise = usingWebSocketInterceptor<AnySchema>(
        getSocketIOInterceptorOptions(),
        async (nextInterceptor) => {
          expect(polling.isRunning).toBe(true);

          await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
            await waitForSocketConnection(socket);
            expect(nextInterceptor.clients).toHaveLength(1);
          });
        },
      );

      pollingStopReleasedPromise.resolve();

      await Promise.all([stopPromise, nextInterceptorPromise]);
    });
  });

  // Local interceptors serve Socket.IO over polling only, so only remote WebSocket clients connect.
  if (type === 'remote') {
    describe('Overlapping base URLs', () => {
      it('should connect WebSocket clients through the interceptor of their Socket.IO path', async () => {
        const nestedBaseURL = `${baseURL}/nested`;
        const nestedPolling = createPollingInterceptor(nestedBaseURL);

        await usingWebSocketInterceptor<AnySchema>(
          {
            type,
            baseURL: nestedBaseURL,
            connectionSaving: { enabled: true },
            protocol: createSocketIOProtocol({ polling: nestedPolling }),
          },
          async (nestedInterceptor) => {
            // Started last, so it would claim the connection as its newest holder if its protocol served the nested path.
            await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
              await usingSocket(nestedBaseURL, { transports: [WebSocketTransport] }, async (socket) => {
                await waitForSocketConnection(socket);

                expect(nestedInterceptor.clients).toHaveLength(1);
                expect(interceptor.clients).toHaveLength(0);
              });
            });
          },
        );
      });
    });
  }

  describe('WebSocket connections outside the Socket.IO path', () => {
    it('should leave connections to other paths under the base URL to other interceptors', async () => {
      const chatBaseURL = `${baseURL}/chat`;

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingWebSocketInterceptor<PlainSchema>(
          { type, baseURL: chatBaseURL, connectionSaving: { enabled: true } },
          async (chatInterceptor) => {
            const socket = new WebSocket(chatBaseURL);

            try {
              await new Promise<void>((resolve) => {
                socket.addEventListener('open', () => resolve(), { once: true });
              });

              expect(chatInterceptor.clients).toHaveLength(1);
              expect(interceptor.clients).toHaveLength(0);
            } finally {
              socket.close();
            }
          },
        );
      });
    });
  });

  describe('HTTP requests outside the Socket.IO path', () => {
    it('should not decide requests to other paths under the base URL', async () => {
      const httpBaseURL = getServerBaseURL().replace(/^ws/, 'http');

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
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
