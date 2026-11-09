import { WebSocket } from 'socket.io-client';

type WebSocketWithBinaryType = Pick<globalThis.WebSocket, 'binaryType'>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A `socket.io-client` transport that calls `new globalThis.WebSocket(...)` for each connection. Local interceptors
 * need it because the built-in `websocket` transport keeps the `WebSocket` constructor found when its module loads,
 * before interceptors replace it. Since transport names and classes cannot be mixed, also pass the polling class of
 * `socket.io-client` to keep polling enabled.
 *
 * @example
 *   import { GlobalWebSocketTransport } from '@zimic/interceptor/experimental/socket.io';
 *   import { io, NodeXHR } from 'socket.io-client';
 *
 *   const socket = io('http://localhost:3000', { transports: [NodeXHR, GlobalWebSocketTransport] });
 */
export class GlobalWebSocketTransport extends WebSocket {
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
