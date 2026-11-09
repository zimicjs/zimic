import type { PossiblePromise } from '@zimic/utils/types';

import type { WebSocketInterceptorClient } from './messages';
import type { WebSocketInterceptorType } from './options';

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
export interface WebSocketInterceptorProtocolClient extends WebSocketInterceptorClient {
  /** Identifies the underlying connection. Interceptors sharing a connection receive clients with the same ID. */
  readonly connectionId: string;

  /** Sends a raw frame to this client, without encoding it with the protocol. */
  sendFrame: (frame: WebSocketInterceptorProtocolFrame) => void;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Translates between the raw frames of a framed protocol and the messages seen by interceptor handlers. The protocol
 * runs inside the interceptor in local and remote modes, and the interceptor server relays raw frames.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- `any` lets protocols of any message be passed as options.
export interface WebSocketInterceptorProtocol<Message = any> {
  /**
   * Called when a client connects, before connection effects run. May return a function called when the client
   * disconnects.
   */
  onConnection?: (client: WebSocketInterceptorProtocolClient) => void | (() => void);

  /**
   * Decodes a received frame into messages, which handlers match, save, and count. A frame decoded to an empty array is
   * a control frame consumed by the protocol, which is never reported as unhandled.
   */
  decode: (frame: WebSocketInterceptorProtocolFrame, client: WebSocketInterceptorProtocolClient) => Message[];

  /** Encodes a message sent by a handler, `client.send`, or `server.send` into the frames to send to the client. */
  encode: (message: Message, client: WebSocketInterceptorProtocolClient) => WebSocketInterceptorProtocolFrame[];
}

/** A frame as received from a client connection, before it is normalized. */
export type WebSocketInterceptorUnnormalizedFrame = string | Blob | BufferSource;

export interface WebSocketInterceptorProtocolRawConnection {
  send: (frame: WebSocketInterceptorProtocolFrame) => void;
  close: (code?: number, reason?: string) => void;
}

/** Receives the events of a connection claimed by a protocol, which has no client of its own. */
export interface WebSocketInterceptorProtocolConnectionClaim {
  onFrame: (frame: WebSocketInterceptorUnnormalizedFrame) => void;
  onClose: () => void;
}

export interface WebSocketInterceptorProtocolClientOptions {
  url: string;
  connectionId: string;
  sendFrame: (frame: WebSocketInterceptorProtocolFrame) => void;
  close: (code?: number, reason?: string) => void;
}

/** What an interceptor exposes to the protocols implemented by this package. */
export interface WebSocketInterceptorProtocolHost {
  readonly type: WebSocketInterceptorType;
  readonly baseURL: string;
  readonly auth?: { token: string };

  /**
   * Opens a client on a transport other than a WebSocket connection, deciding it with the connection handlers. Resolves
   * to `null` if a handler rejects it.
   */
  openClient: (
    options: WebSocketInterceptorProtocolClientOptions,
  ) => Promise<WebSocketInterceptorProtocolClient | null>;
  removeClient: (client: WebSocketInterceptorProtocolClient) => void;
  handleFrame: (client: WebSocketInterceptorProtocolClient, frame: WebSocketInterceptorUnnormalizedFrame) => void;
}

/**
 * The lifecycle of protocols implemented by this package, which need more than a connection to work, such as serving a
 * transport other than WebSocket.
 */
export interface InternalWebSocketInterceptorProtocol<Message = unknown> extends WebSocketInterceptorProtocol<Message> {
  start: (host: WebSocketInterceptorProtocolHost) => PossiblePromise<void>;
  stop: () => PossiblePromise<void>;
  closeClients: () => void;
  claimConnection: (
    url: string,
    connection: WebSocketInterceptorProtocolRawConnection,
  ) => WebSocketInterceptorProtocolConnectionClaim | undefined;
}

export function isInternalWebSocketInterceptorProtocol(
  protocol: WebSocketInterceptorProtocol | undefined,
): protocol is InternalWebSocketInterceptorProtocol {
  return protocol !== undefined && 'claimConnection' in protocol;
}
