import { createSocketIOProtocol, type SocketIOPollingSchema } from '@zimic/interceptor/experimental/socket.io';
import { createHttpInterceptor } from '@zimic/interceptor/http';
import { WEB_SOCKET_CLOSE_CODES } from '@zimic/utils/ws';
import type { WebSocketMessageData, WebSocketSchema, WebSocketSchemaMessage } from '@zimic/ws';
import { io } from 'socket.io-client';

import {
  ClientTestFramedProtocol,
  ClientTestWebSocket,
  ClientTestWebSocketCloseListener,
  ClientTestWebSocketLifecycleListener,
  ClientTestWebSocketMessageListener,
  waitForClientTestWebSocketOpen,
} from '../shared/client';

export function createSocketIOTestSocket<Schema extends WebSocketSchema>(url: string) {
  const { origin, pathname, searchParams } = new URL(url);

  const socket = io(origin.replace(/^ws/, 'http'), {
    path: `${pathname}/`,
    query: Object.fromEntries(searchParams),
    forceNew: true,
    reconnection: false,
  });

  const listeners = {
    open: new Set<ClientTestWebSocketLifecycleListener>(),
    error: new Set<ClientTestWebSocketLifecycleListener>(),
    close: new Set<ClientTestWebSocketCloseListener>(),
    message: new Set<ClientTestWebSocketMessageListener<Schema>>(),
  };

  let readyState: number = WebSocket.CONNECTING;

  function dispatchClose(code: number, reason: string) {
    readyState = WebSocket.CLOSED;

    for (const listener of listeners.close) {
      listener({ code, reason });
    }
  }

  socket.on('connect', () => {
    readyState = WebSocket.OPEN;

    for (const listener of listeners.open) {
      listener({});
    }
  });

  socket.on('connect_error', (error) => {
    for (const listener of listeners.error) {
      listener(error);
    }

    dispatchClose(WEB_SOCKET_CLOSE_CODES.ABNORMAL_CLOSURE, '');
  });

  socket.on('disconnect', (reason) => {
    dispatchClose(WEB_SOCKET_CLOSE_CODES.DEFAULT, reason);
  });

  socket.onAny((type: string, data: unknown) => {
    // Socket.IO events carry decoded arguments, which the shared cases read as the JSON frames of a raw WebSocket.
    const messageData = JSON.stringify({ type, data }) as WebSocketMessageData<WebSocketSchemaMessage<Schema>>;

    for (const listener of listeners.message) {
      listener({ data: messageData });
    }
  });

  type ClientTestListener = ClientTestWebSocketLifecycleListener &
    ClientTestWebSocketCloseListener &
    ClientTestWebSocketMessageListener<Schema>;

  // The overloads pair each event type with its listener type, which one implementation signature cannot express.
  const addEventListener = ((type: keyof typeof listeners, listener: ClientTestListener) => {
    listeners[type].add(listener);
  }) as ClientTestWebSocket<Schema>['addEventListener'];

  const removeEventListener = ((type: keyof typeof listeners, listener: ClientTestListener) => {
    listeners[type].delete(listener);
  }) as ClientTestWebSocket<Schema>['removeEventListener'];

  const testSocket: ClientTestWebSocket<Schema> = {
    binaryType: 'arraybuffer',
    protocol: '',
    url,
    CLOSED: WebSocket.CLOSED,

    get readyState() {
      return readyState;
    },

    send(message) {
      if (typeof message !== 'string') {
        throw new TypeError('Socket.IO test sockets send JSON messages only.');
      }

      const { type, data } = JSON.parse(message) as { type: string; data: unknown };
      socket.emit(type, data);
    },

    close() {
      socket.disconnect();
    },

    addEventListener,
    removeEventListener,
  };

  return testSocket;
}

export const socketIOFramedProtocol: ClientTestFramedProtocol = {
  path: '/socket.io',

  create: ({ type, baseURL }) =>
    createSocketIOProtocol({
      polling: createHttpInterceptor<SocketIOPollingSchema>({ type, baseURL: baseURL.replace(/^ws/, 'http') }),
    }),
};

export async function openSocketIOTestSocket<Schema extends WebSocketSchema>(url: string) {
  const socket = createSocketIOTestSocket<Schema>(url);
  await waitForClientTestWebSocketOpen(socket);
  return socket;
}
