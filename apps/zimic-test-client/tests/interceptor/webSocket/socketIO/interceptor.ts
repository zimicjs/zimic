import {
  createWebSocketInterceptor,
  WebSocketInterceptorClient,
  WebSocketInterceptorPlatform,
  WebSocketInterceptorType,
} from '@zimic/interceptor/experimental/ws';
import { waitFor } from '@zimic/utils/time';
import { JSONStringified } from '@zimic/ws';
import { io, ManagerOptions, Socket, WebSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { ZIMIC_SERVER_PORT } from '@tests/constants';
import { User } from '@tests/types/schema/entities';
import { SocketIOWebSocketSchema } from '@tests/types/schema/webSocket';

const ENGINE_IO_OPEN_PACKET = `0${JSON.stringify({
  sid: 'engine-io-session',
  upgrades: [],
  pingInterval: 60 * 1000,
  pingTimeout: 60 * 1000,
  maxPayload: 1000000,
})}` as const;

const SOCKET_IO_CONNECT_PACKET = `40${JSON.stringify({ sid: 'socket-io-session' })}` as const;

// The built-in transports keep the `WebSocket` constructor they find when the module loads, before local interceptors
// replace `globalThis.WebSocket`. Reading it on each connection lets local interceptors receive the socket.
class GlobalWebSocketTransport extends WebSocket {
  createSocket(url: string, protocols: string | string[] | undefined) {
    return new globalThis.WebSocket(url, protocols);
  }
}

function getBaseURL(type: WebSocketInterceptorType) {
  return type === 'local'
    ? 'ws://localhost:4003'
    : `ws://localhost:${ZIMIC_SERVER_PORT}/socket-io-${crypto.randomUUID()}`;
}

function sendEngineIOOpenPacket(client: WebSocketInterceptorClient<SocketIOWebSocketSchema>) {
  client.send(ENGINE_IO_OPEN_PACKET);
}

function connectSocket(baseURL: string, transports: ManagerOptions['transports']) {
  const { origin, pathname } = new URL(baseURL);

  const socket: Socket = io(origin.replace(/^ws/, 'http'), {
    path: `${pathname.replace(/\/$/, '')}/socket.io/`,
    transports,
    forceNew: true,
    reconnection: false,
  });

  return socket;
}

async function waitForConnection(socket: Socket) {
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

export function declareSocketIOInterceptorTests(options: { platform: WebSocketInterceptorPlatform }) {
  const { platform } = options;

  const interceptorTypes: WebSocketInterceptorType[] = ['local', 'remote'];

  describe.each(interceptorTypes)("socket.io client (type '%s')", (type) => {
    const interceptor = createWebSocketInterceptor<SocketIOWebSocketSchema>({
      type,
      baseURL: getBaseURL(type),
      messageSaving: { enabled: true },
    });

    const sockets: Socket[] = [];

    beforeAll(async () => {
      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe(platform);

      interceptor.on('connection', sendEngineIOOpenPacket);
    });

    beforeEach(async () => {
      await Promise.resolve(interceptor.clear());
    });

    afterEach(async () => {
      try {
        await interceptor.checkTimes();
      } finally {
        for (const socket of sockets) {
          socket.disconnect();
        }
        sockets.length = 0;

        await waitFor(() => expect(interceptor.clients).toHaveLength(0));
      }
    });

    afterAll(async () => {
      interceptor.off('connection', sendEngineIOOpenPacket);

      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);
    });

    const webSocketTransports: { transportName: string; transports: ManagerOptions['transports'] }[] = [
      { transportName: 'GlobalWebSocketTransport', transports: [GlobalWebSocketTransport] },
    ];

    // The built-in transport bypasses local interceptors. It uses the `ws` package in Node.js and, in browsers, the
    // `WebSocket` constructor found when the module loads, before local interceptors replace it.
    if (type === 'remote') {
      webSocketTransports.push({ transportName: "'websocket'", transports: ['websocket'] });
    }

    describe.each(webSocketTransports)('Transport $transportName', ({ transports }) => {
      it('should connect after the handlers reply with the Engine.IO open and socket.io connect packets', async () => {
        const connectHandler = await interceptor.message().with('40').respond(SOCKET_IO_CONNECT_PACKET).times(1);

        const socket = connectSocket(interceptor.baseURL, transports);
        sockets.push(socket);

        await waitForConnection(socket);
        expect(socket.connected).toBe(true);

        expect(interceptor.clients).toHaveLength(1);
        expect(interceptor.clients[0].url).toBe(`${interceptor.baseURL}/socket.io/?EIO=4&transport=websocket`);

        expect(connectHandler.messages).toHaveLength(1);
        expect(connectHandler.messages[0].data).toBe('40');
      });

      it('should respond to emitted events with event frames', async () => {
        const userId = crypto.randomUUID();

        await interceptor.message().with('40').respond(SOCKET_IO_CONNECT_PACKET).times(1);

        const deleteHandler = await interceptor
          .message()
          .with(`42["user:delete",${JSON.stringify({ id: userId })}]`)
          .respond(`42["user:delete:success",${JSON.stringify({ id: userId })}]` as const)
          .times(1);

        expectTypeOf(
          `42["user:delete",${JSON.stringify({ id: userId })}]` as const,
        ).toExtend<SocketIOWebSocketSchema>();
        expectTypeOf(
          `42["user:delete",${JSON.stringify({ userId })}]` as const,
        ).not.toExtend<SocketIOWebSocketSchema>();
        expectTypeOf(`42["user:delete",{"id":"${userId}"}]` as const).not.toExtend<SocketIOWebSocketSchema>();

        const socket = connectSocket(interceptor.baseURL, transports);
        sockets.push(socket);
        await waitForConnection(socket);

        const responsePromise = new Promise<{ id: string }>((resolve) => {
          socket.once('user:delete:success', (data: { id: string }) => resolve(data));
        });

        socket.emit('user:delete', { id: userId });

        expect(await responsePromise).toEqual({ id: userId });

        expect(deleteHandler.messages).toHaveLength(1);
        expectTypeOf(deleteHandler.messages[0].data).toEqualTypeOf<
          Extract<SocketIOWebSocketSchema, `42["user:delete",${JSONStringified<{ id: User['id'] }>}]`>
        >();
        expect(deleteHandler.messages[0].data).toBe(`42["user:delete",${JSON.stringify({ id: userId })}]`);
        expect(deleteHandler.messages[0].sender).toBe(interceptor.clients[0]);
      });
    });

    // Polling sends Engine.IO packets in HTTP requests, which WebSocket interceptors do not handle.
    it('should not connect with the polling transport without an HTTP interceptor', async () => {
      const socket = connectSocket(interceptor.baseURL, ['polling']);
      sockets.push(socket);

      await expect(waitForConnection(socket)).rejects.toThrow();
      expect(interceptor.clients).toHaveLength(0);
    });
  });
}
