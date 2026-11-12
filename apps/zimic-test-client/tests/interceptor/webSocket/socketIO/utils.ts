import type { WebSocketSchema } from '@zimic/ws';
import { io, ManagerOptions, Socket } from 'socket.io-client';

import type { ClientTestOptions, ClientTestWebSocket } from '../shared/client';

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

type ClientTestListener = (event: never) => void;

function createSocketIOTestSocket<Schema extends WebSocketSchema>(
  url: string,
  transports: ManagerOptions['transports'],
) {
  const { origin, pathname, searchParams } = new URL(url);

  const socket: Socket = io(origin.replace(/^ws/, 'http'), {
    path: `${pathname.replace(/\/$/, '')}/socket.io/`,
    query: Object.fromEntries(searchParams),
    transports,
    forceNew: true,
    reconnection: false,
  });

  const listeners = {
    open: new Set<ClientTestListener>(),
    error: new Set<ClientTestListener>(),
    close: new Set<ClientTestListener>(),
    message: new Set<ClientTestListener>(),
  };

  let readyState = CONNECTING;

  function dispatch(type: keyof typeof listeners, event: unknown) {
    for (const listener of listeners[type]) {
      listener(event as never);
    }
  }

  socket.on('connect', () => {
    readyState = OPEN;
    dispatch('open', {});
  });

  socket.on('connect_error', () => {
    readyState = CLOSED;
    dispatch('error', {});
    dispatch('close', { code: 1006, reason: '' });
  });

  socket.on('disconnect', (reason) => {
    readyState = CLOSED;
    dispatch('close', { code: 1000, reason });
  });

  socket.onAny((type: string, data: unknown) => {
    dispatch('message', { data: JSON.stringify({ type, data }) });
  });

  const testSocket = {
    binaryType: 'arraybuffer',
    protocol: '',
    url,
    CLOSED,

    get readyState() {
      return readyState;
    },

    send(message: unknown) {
      const { type, data } = JSON.parse(message as string) as { type: string; data: unknown };
      socket.emit(type, data);
    },

    close() {
      socket.disconnect();
    },

    addEventListener(type: keyof typeof listeners, listener: ClientTestListener) {
      listeners[type].add(listener);
    },

    removeEventListener(type: keyof typeof listeners, listener: ClientTestListener) {
      listeners[type].delete(listener);
    },
  };

  return testSocket as unknown as ClientTestWebSocket<Schema>;
}

export function createSocketIOClientTestOptions(
  transports: ManagerOptions['transports'],
): Pick<ClientTestOptions, 'openSocket' | 'createSocket'> {
  return {
    createSocket: (url) => createSocketIOTestSocket(url, transports),

    openSocket: async <Schema extends WebSocketSchema>(url: string) => {
      const socket = createSocketIOTestSocket<Schema>(url, transports);

      await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve);
        socket.addEventListener('error', reject);
      });

      return socket;
    },
  };
}
