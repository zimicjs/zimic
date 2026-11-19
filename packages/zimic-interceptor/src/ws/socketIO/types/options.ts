import type { Packet } from 'socket.io-parser';

import type { SocketIOPollingInterceptor } from './polling';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A parser with the same shape as the `parser` option of `socket.io-client`, such as `socket.io-msgpack-parser`.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#custom-parsers Custom Socket.IO parsers}
 */
export interface SocketIOParser {
  /**
   * Encodes a Socket.IO packet into an array of string or binary chunks.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#custom-parsers Custom Socket.IO parsers}
   */
  Encoder: new () => { encode: (packet: Packet) => unknown };

  /**
   * Decodes string or binary chunks, emitting `decoded` with each complete Socket.IO packet.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#custom-parsers Custom Socket.IO parsers}
   */
  Decoder: new () => {
    add: (chunk: unknown) => void;
    on: (event: 'decoded', listener: (packet: Packet) => void) => unknown;
  };
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The options of {@link createSocketIOProtocol}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#creating-a-socketio-interceptor Creating a Socket.IO interceptor}
 */
export interface SocketIOProtocolOptions {
  /**
   * The namespace handled by the interceptor. Defaults to `'/'`.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#namespaces Socket.IO namespaces}
   */
  namespace?: string;

  /**
   * The HTTP interceptor serving polling requests, or none to disable polling.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#polling Socket.IO polling}
   */
  polling?: SocketIOPollingInterceptor;

  /**
   * The parser used by the client, with the same shape as the `parser` option of `socket.io-client`.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#custom-parsers Custom Socket.IO parsers}
   */
  parser?: SocketIOParser;
}
