import {
  createWebSocketInterceptor,
  WebSocketInterceptorPlatform,
  WebSocketInterceptorType,
} from '@zimic/interceptor/experimental/ws';
import { createHttpInterceptor } from '@zimic/interceptor/http';
import { waitFor } from '@zimic/utils/time';
import { io, ManagerOptions, NodeXHR, Socket, XHR } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ZIMIC_SERVER_PORT } from '@tests/constants';
import { UserSocketIOEvents, UserSocketIOWebSocketSchema } from '@tests/types/schema/webSocket';

import { createSocketIOMock, GlobalWebSocketTransport, SocketIOHttpSchema } from './utils';

// Short enough for a test to observe a connection outliving `pingInterval + pingTimeout`, with margin for slow runs.
// The shared matrix waits in real time because fake timers do not reach the remote interceptor server or browsers.
const PING_INTERVAL = 300;
const PING_TIMEOUT = 1000;

function getBaseURLPath(type: WebSocketInterceptorType) {
  return type === 'local' ? 'localhost:4003' : `localhost:${ZIMIC_SERVER_PORT}/socket-io-${crypto.randomUUID()}`;
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

// Receiving pings for longer than `pingInterval + pingTimeout` shows that the client did not time out.
async function waitForPingsOutlivingPingTimeout(socket: Socket) {
  const numberOfPingsOutlivingPingTimeout = Math.ceil((PING_INTERVAL + PING_TIMEOUT) / PING_INTERVAL) + 1;

  let numberOfPings = 0;
  socket.io.on('ping', () => numberOfPings++);

  await waitFor(() => expect(numberOfPings).toBeGreaterThanOrEqual(numberOfPingsOutlivingPingTimeout), {
    timeout: (numberOfPingsOutlivingPingTimeout + 2) * PING_INTERVAL + PING_TIMEOUT,
  });
}

async function waitForUserDeleteSuccess(socket: Socket) {
  return new Promise<UserSocketIOEvents['user:delete:success']>((resolve) => {
    socket.once('user:delete:success', resolve);
  });
}

export function declareSocketIOInterceptorTests(options: { platform: WebSocketInterceptorPlatform }) {
  const { platform } = options;

  const interceptorTypes: WebSocketInterceptorType[] = ['local', 'remote'];

  describe.each(interceptorTypes)("socket.io client (type '%s')", (type) => {
    const baseURLPath = getBaseURLPath(type);

    const webSocketInterceptor = createWebSocketInterceptor<UserSocketIOWebSocketSchema>({
      type,
      baseURL: `ws://${baseURLPath}`,
      messageSaving: { enabled: true },
    });

    const httpInterceptor = createHttpInterceptor<SocketIOHttpSchema>({
      type,
      baseURL: `http://${baseURLPath}`,
      requestSaving: { enabled: true },
    });

    // The built-in `websocket` transport bypasses local interceptors. It uses the `ws` package in Node.js and, in
    // browsers, the `WebSocket` constructor found when the module loads, before local interceptors replace it. Since
    // transport names and classes cannot be mixed, local interceptors also need the default polling class.
    const defaultTransports: ManagerOptions['transports'] =
      type === 'local' ? [platform === 'node' ? NodeXHR : XHR, GlobalWebSocketTransport] : undefined;

    const sockets: Socket[] = [];

    function connectTrackedSocket(transports: ManagerOptions['transports']) {
      const socket = connectSocket(webSocketInterceptor.baseURL, transports);
      sockets.push(socket);
      return socket;
    }

    beforeAll(async () => {
      await webSocketInterceptor.start();
      expect(webSocketInterceptor.isRunning).toBe(true);
      expect(webSocketInterceptor.platform).toBe(platform);
    });

    beforeEach(async () => {
      await Promise.resolve(webSocketInterceptor.clear());
    });

    afterEach(async () => {
      try {
        await webSocketInterceptor.checkTimes();
      } finally {
        for (const socket of sockets) {
          socket.disconnect();
        }
        sockets.length = 0;

        await waitFor(() => expect(webSocketInterceptor.clients).toHaveLength(0));
      }
    });

    afterAll(async () => {
      await webSocketInterceptor.stop();
      expect(webSocketInterceptor.isRunning).toBe(false);
    });

    describe('Without an HTTP interceptor', () => {
      const socketIOMock = createSocketIOMock<UserSocketIOEvents>({
        webSocketInterceptor,
        upgrades: [],
        pingInterval: PING_INTERVAL,
        pingTimeout: PING_TIMEOUT,
      });

      beforeAll(() => {
        socketIOMock.start();
      });

      beforeEach(async () => {
        await socketIOMock.declareHandlers();
      });

      afterAll(() => {
        socketIOMock.stop();
      });

      const webSocketTransports: { transportName: string; transports: ManagerOptions['transports'] }[] = [
        { transportName: 'GlobalWebSocketTransport', transports: [GlobalWebSocketTransport] },
      ];

      // The built-in transport bypasses local interceptors, as the default transports above describe.
      if (type === 'remote') {
        webSocketTransports.push({ transportName: "'websocket'", transports: ['websocket'] });
      }

      describe.each(webSocketTransports)('Transport $transportName', ({ transports }) => {
        it('should connect after the handlers reply with the Engine.IO open and socket.io connect packets', async () => {
          const socket = connectTrackedSocket(transports);

          await waitForConnection(socket);
          expect(socket.connected).toBe(true);

          expect(webSocketInterceptor.clients).toHaveLength(1);
          expect(webSocketInterceptor.clients[0].url).toBe(
            `${webSocketInterceptor.baseURL}/socket.io/?EIO=4&transport=websocket`,
          );
          expect(webSocketInterceptor.clients[0].messages[0].data).toBe('40');
        });

        it('should respond to emitted events with event frames', async () => {
          const userId = crypto.randomUUID();

          const deleteHandler = await webSocketInterceptor
            .message()
            .with((frame) => socketIOMock.hasEvent(frame, 'user:delete'))
            .respond(socketIOMock.encodeEvent('user:delete:success', { id: userId }))
            .times(1);

          const socket = connectTrackedSocket(transports);
          await waitForConnection(socket);

          const responsePromise = waitForUserDeleteSuccess(socket);
          socket.emit('user:delete', { id: userId });

          expect(await responsePromise).toEqual({ id: userId });

          expect(deleteHandler.messages).toHaveLength(1);
          expect(socketIOMock.decodeEvents(deleteHandler.messages[0].data)).toEqual([
            { event: 'user:delete', data: { id: userId } },
          ]);
          expect(deleteHandler.messages[0].sender).toBe(webSocketInterceptor.clients[0]);
        });

        it('should stay connected past the ping timeout while the handlers ping the client', async () => {
          const socket = connectTrackedSocket(transports);
          await waitForConnection(socket);

          await waitForPingsOutlivingPingTimeout(socket);
          expect(socket.connected).toBe(true);
        });
      });

      // Polling sends Engine.IO packets in HTTP requests, which WebSocket interceptors do not handle.
      it('should not connect with the default transports', async () => {
        const socket = connectTrackedSocket(defaultTransports);

        await expect(waitForConnection(socket)).rejects.toThrow();
        expect(webSocketInterceptor.clients).toHaveLength(0);
      });
    });

    describe.each([
      { upgradeDescription: 'Polling without upgrades', upgrades: [] },
      { upgradeDescription: 'Polling with upgrades', upgrades: ['websocket'] },
    ] satisfies { upgradeDescription: string; upgrades: 'websocket'[] }[])('$upgradeDescription', ({ upgrades }) => {
      const socketIOMock = createSocketIOMock<UserSocketIOEvents>({
        webSocketInterceptor,
        httpInterceptor,
        upgrades,
        pingInterval: PING_INTERVAL,
        pingTimeout: PING_TIMEOUT,
      });

      beforeAll(async () => {
        await httpInterceptor.start();
        expect(httpInterceptor.isRunning).toBe(true);

        socketIOMock.start();
      });

      beforeEach(async () => {
        await httpInterceptor.clear();
        await socketIOMock.declareHandlers();
      });

      afterEach(async () => {
        await httpInterceptor.checkTimes();
      });

      afterAll(async () => {
        socketIOMock.stop();

        await httpInterceptor.stop();
        expect(httpInterceptor.isRunning).toBe(false);
      });

      it('should stay connected past the ping timeout while the handlers ping the client', async () => {
        const socket = connectTrackedSocket(defaultTransports);
        await waitForConnection(socket);

        await waitForPingsOutlivingPingTimeout(socket);
        expect(socket.connected).toBe(true);
      });

      // Without upgrades, events stay on polling and reach HTTP handlers. With upgrades, they move to the WebSocket
      // and reach WebSocket handlers.
      if (upgrades.length === 0) {
        it.each([
          { transportName: "'polling'", transports: ['polling'] satisfies ManagerOptions['transports'] },
          { transportName: 'the default transports', transports: defaultTransports },
        ])('should respond to emitted events over polling with $transportName', async ({ transports }) => {
          const userId = crypto.randomUUID();

          const deleteHandler = await httpInterceptor
            .post('/socket.io/')
            .with((request) => socketIOMock.hasEvent(request.body, 'user:delete'))
            .respond((request) => {
              socketIOMock.send(
                request.searchParams.get('sid'),
                socketIOMock.encodeEvent('user:delete:success', { id: userId }),
              );
              return { status: 200, body: 'ok' };
            })
            .times(1);

          const socket = connectTrackedSocket(transports);
          await waitForConnection(socket);
          expect(socket.io.engine.transport.name).toBe('polling');

          const responsePromise = waitForUserDeleteSuccess(socket);
          socket.emit('user:delete', { id: userId });

          expect(await responsePromise).toEqual({ id: userId });
          expect(socket.io.engine.transport.name).toBe('polling');

          expect(deleteHandler.requests).toHaveLength(1);
          expect(socketIOMock.decodeEvents(deleteHandler.requests[0].body)).toEqual([
            { event: 'user:delete', data: { id: userId } },
          ]);
          expect(webSocketInterceptor.clients).toHaveLength(0);
        });
      } else {
        it('should upgrade from polling and respond to emitted events over WebSocket with the default transports', async () => {
          const userId = crypto.randomUUID();

          const deleteHandler = await webSocketInterceptor
            .message()
            .with((frame) => socketIOMock.hasEvent(frame, 'user:delete'))
            .respond(socketIOMock.encodeEvent('user:delete:success', { id: userId }))
            .times(1);

          const socket = connectTrackedSocket(defaultTransports);
          await waitForConnection(socket);

          await waitFor(() => expect(socket.io.engine.transport.name).toBe('websocket'));

          const responsePromise = waitForUserDeleteSuccess(socket);
          socket.emit('user:delete', { id: userId });

          expect(await responsePromise).toEqual({ id: userId });

          expect(webSocketInterceptor.clients).toHaveLength(1);
          expect(new URL(webSocketInterceptor.clients[0].url).searchParams.get('sid')).toEqual(expect.any(String));

          expect(deleteHandler.messages).toHaveLength(1);
          expect(deleteHandler.messages[0].sender).toBe(webSocketInterceptor.clients[0]);
        });
      }
    });
  });
}
