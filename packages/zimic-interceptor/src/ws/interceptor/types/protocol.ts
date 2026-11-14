import type { WebSocketSchema } from '@zimic/ws';

import type { InternalWebSocketInterceptorClient } from '../WebSocketInterceptorHandle';
import type { WebSocketInterceptorClient } from './messages';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A raw WebSocket frame handled by a {@link WebSocketInterceptorProtocol}.
 */
export type WebSocketInterceptorProtocolFrame = string | ArrayBuffer;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A client connected to an interceptor, as seen by its {@link WebSocketInterceptorProtocol}. It is the same object
 * listed in `interceptor.clients`, so `send` encodes messages with the protocol. Use `sendFrame` to skip encoding.
 */
export interface WebSocketInterceptorProtocolClient<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> extends WebSocketInterceptorClient<Schema, Path> {
  /** Sends a raw frame to this client, without encoding it with the protocol. */
  sendFrame: (frame: WebSocketInterceptorProtocolFrame) => void;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Translates between the raw frames of a framed protocol and the messages seen by interceptor handlers. The protocol
 * runs inside the interceptor in local and remote modes, and the interceptor server relays raw frames.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#protocol-option `protocol` option}
 */
export interface WebSocketInterceptorProtocol<Message> {
  /** Called when a client connects, before connection effects run. */
  onConnection?: (client: WebSocketInterceptorProtocolClient) => void;

  /**
   * Decodes a received frame into messages, which handlers match, save, and count. A frame decoded to an empty array is
   * a control frame consumed by the protocol, which is never reported as unhandled. Without it, handlers receive frames
   * as messages, as without a protocol.
   */
  decode?: (frame: WebSocketInterceptorProtocolFrame, client: WebSocketInterceptorProtocolClient) => Message[];

  /**
   * Encodes a message sent by a handler, `client.send`, or `server.send` into the frames to send to the client. Without
   * it, messages are sent as without a protocol.
   */
  encode?: (message: Message, client: WebSocketInterceptorProtocolClient) => WebSocketInterceptorProtocolFrame[];
}

export interface WebSocketInterceptorProtocolRawConnection {
  send: (frame: WebSocketInterceptorProtocolFrame) => void;
  close: (code?: number, reason?: string) => void;
}

/** Receives the events of a connection claimed by a protocol, which has no client of its own. */
export interface WebSocketInterceptorProtocolConnectionClaim {
  onFrame: (frame: string | Blob | BufferSource) => void;
  onClose: () => void;
}

export interface WebSocketInterceptorProtocolClientOptions {
  url: string;
  // Aborted when the protocol lets the client go while the connection handlers decide it, such as when its connection
  // closes or its interceptor is cleared or stopped.
  signal: AbortSignal;
  sendFrame: (frame: WebSocketInterceptorProtocolFrame) => void;
  close: (code?: number, reason?: string) => void;
  // Called once the interceptor lists the accepted client, before connection effects run.
  onOpen: (client: InternalWebSocketInterceptorClient) => void;
}

export type WebSocketInterceptorProtocolClientOpening =
  { action: 'accept' } | { action: 'reject' } | { action: 'abort' };
