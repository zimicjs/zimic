import type { Packet } from 'socket.io-parser';

import type { SocketIOPollingInterceptor } from './polling';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#custom-parsers Custom Socket.IO parsers}
 */
export interface SocketIOParser {
  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#custom-parsers Custom Socket.IO parsers} */
  Encoder: new () => { encode: (packet: Packet) => unknown };

  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#custom-parsers Custom Socket.IO parsers} */
  Decoder: new () => {
    add: (chunk: unknown) => void;
    on: (event: 'decoded', listener: (packet: Packet) => void) => unknown;
  };
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#creating-a-socketio-interceptor Creating a Socket.IO interceptor}
 */
export interface SocketIOProtocolOptions {
  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#namespaces Socket.IO namespaces} */
  namespace?: string;

  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#polling Socket.IO polling} */
  polling?: SocketIOPollingInterceptor;

  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#custom-parsers Custom Socket.IO parsers} */
  parser?: SocketIOParser;
}
