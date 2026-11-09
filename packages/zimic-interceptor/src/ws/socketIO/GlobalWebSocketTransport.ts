import * as socketIOClient from 'socket.io-client';

type WebSocketWithBinaryType = Pick<globalThis.WebSocket, 'binaryType'>;

/* istanbul ignore next -- @preserve
 * The test matrix installs one version of `socket.io-client`, which exports its transports. */
class UnsupportedGlobalWebSocketTransport {
  constructor() {
    throw new Error('`GlobalWebSocketTransport` requires socket.io-client 4.8 or later.');
  }
}

// `socket.io-client` exports its transports since 4.8, and earlier versions accept only transport names. The fallback
// keeps this entry point importable on those versions, which remote interceptors support.
const socketIOClientExports: { WebSocket?: typeof socketIOClient.WebSocket } = socketIOClient;

const BaseWebSocketTransport =
  socketIOClientExports.WebSocket ??
  (UnsupportedGlobalWebSocketTransport as unknown as typeof socketIOClient.WebSocket);

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A `socket.io-client` transport that calls `new globalThis.WebSocket(...)` for each connection. Local interceptors
 * need it because the built-in `websocket` transport keeps the `WebSocket` constructor found when its module loads,
 * before interceptors replace it. Since transport names and classes cannot be mixed, also pass the polling class of
 * `socket.io-client` to keep polling enabled. Requires `socket.io-client` 4.8 or later.
 *
 * @example
 *   import { GlobalWebSocketTransport } from '@zimic/interceptor/experimental/socket.io';
 *   import { io, NodeXHR } from 'socket.io-client';
 *
 *   const socket = io('http://localhost:3000', { transports: [NodeXHR, GlobalWebSocketTransport] });
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#connecting-local-interceptors Connecting local interceptors}
 */
export class GlobalWebSocketTransport extends BaseWebSocketTransport {
  createSocket(url: string, protocols: string | string[] | undefined) {
    return new globalThis.WebSocket(url, protocols);
  }

  doOpen() {
    super.doOpen();

    // `socket.io-client` requests Node.js buffers in Node.js, which native sockets replace with `Blob`, a type its packet
    // decoder cannot read.
    if (this.ws !== undefined) {
      (this.ws as WebSocketWithBinaryType).binaryType = 'arraybuffer';
    }

    return this;
  }
}
