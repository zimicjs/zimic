import type { Packet } from 'socket.io-parser';

import type { SocketIOPollingInterceptor } from './polling';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A parser with the same shape as the `parser` option of `socket.io-client`, such as `socket.io-msgpack-parser`.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#custom-parsers Custom parsers}
 */
export interface SocketIOParser {
  /** Encodes a Socket.IO packet into an array of string or binary chunks. */
  Encoder: new () => { encode: (packet: Packet) => unknown };

  /** Decodes string or binary chunks, emitting `decoded` with each complete Socket.IO packet. */
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
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#createsocketioprotocol `createSocketIOProtocol` API reference}
 */
export interface SocketIOProtocolOptions {
  /** The namespace handled by the interceptor. Frames of other namespaces are ignored. Defaults to `'/'`. */
  namespace?: string;

  /**
   * The HTTP interceptor serving polling requests, on the WebSocket base URL with `http` instead of `ws`, or none to
   * disable polling.
   */
  polling?: SocketIOPollingInterceptor;

  /**
   * The parser used by the client, with the same shape as the `parser` option of `socket.io-client`. The protocols of
   * the namespaces on one base URL must use the same parser.
   */
  parser?: SocketIOParser;
}
