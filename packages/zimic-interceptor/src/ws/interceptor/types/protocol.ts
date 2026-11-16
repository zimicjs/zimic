import type { PossiblePromise } from '@zimic/utils/types';
import type { WebSocketSchema } from '@zimic/ws';

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
 * A client connected to an interceptor, as seen by its {@link WebSocketInterceptorProtocol}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#protocol-option `protocol` option}
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
 * A WebSocket connection to an interceptor, offered to its {@link WebSocketInterceptorProtocol} to claim.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#protocol-option `protocol` option}
 */
export interface WebSocketInterceptorProtocolConnection {
  /** The URL of the connection, including its search params. */
  url: string;

  /** Sends a raw frame to the client of the connection. */
  send: (frame: WebSocketInterceptorProtocolFrame) => void;

  /** Closes the connection, with an optional close code and reason. */
  close: (code?: number, reason?: string) => void;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Receives the events of a connection claimed by a {@link WebSocketInterceptorProtocol}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#protocol-option `protocol` option}
 */
export interface WebSocketInterceptorProtocolConnectionClaim {
  /** Called with each frame received from the client of the connection. */
  onFrame: (frame: WebSocketInterceptorProtocolFrame) => void;

  /** Called when the connection closes. */
  onClose: () => void;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A client opened by a {@link WebSocketInterceptorProtocol} with
 * {@link WebSocketInterceptorProtocolContext.openClient `openClient`}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#protocol-option `protocol` option}
 */
export interface WebSocketInterceptorProtocolOpenedClient<Message> {
  /** Delivers a message decoded by the protocol to the message handlers of the interceptor, as sent by this client. */
  receive: (message: Message) => void;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The options to open a client with {@link WebSocketInterceptorProtocolContext.openClient `openClient`}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#protocol-option `protocol` option}
 */
export interface WebSocketInterceptorProtocolClientOptions<Message> {
  /** The URL of the client, matched by connection handlers and exposed as `client.url`. */
  url: string;

  /** Aborting it releases the client, at any time, removing it from `interceptor.clients`. */
  signal: AbortSignal;

  /** Sends a raw frame to the client, called for each frame encoded from the messages sent to it. */
  sendFrame: (frame: WebSocketInterceptorProtocolFrame) => void;

  /**
   * Closes the client, called by `client.close()`. It does not remove the client from `interceptor.clients`; aborting
   * {@link WebSocketInterceptorProtocolClientOptions.signal `signal`} does.
   */
  close: (code?: number, reason?: string) => void;

  /**
   * Called once the interceptor accepts and lists the client, before connection effects run. Send handshake replies
   * here, because the promise returned by `openClient` settles only after connection effects run.
   */
  onOpen: (client: WebSocketInterceptorProtocolOpenedClient<Message>) => void;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The result of opening a client with {@link WebSocketInterceptorProtocolContext.openClient `openClient`}: `accepted` if
 * the connection handlers accepted it, `rejected` if they rejected it, or `aborted` if its signal was aborted while
 * they decided it. The result arrives after the connection effects of an accepted client run, so the client is given to
 * {@link WebSocketInterceptorProtocolClientOptions.onOpen `onOpen`}, which runs before them.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#protocol-option `protocol` option}
 */
export type WebSocketInterceptorProtocolOpenClientResult =
  { status: 'accepted' } | { status: 'rejected' } | { status: 'aborted' };

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The context given to {@link WebSocketInterceptorProtocol.start `start`}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#protocol-option `protocol` option}
 */
export interface WebSocketInterceptorProtocolContext<Message> {
  /** The interceptor using the protocol. */
  interceptor: {
    /** The type of the interceptor, either `local` or `remote`. */
    type: WebSocketInterceptorType;

    /** The base URL of the interceptor. */
    baseURL: string;
  };

  /**
   * Opens a client on a transport served by the protocol, running the connection handlers of the interceptor to decide
   * it. The promise settles after the connection effects of an accepted client run, so handshake replies belong in
   * {@link WebSocketInterceptorProtocolClientOptions.onOpen `onOpen`}, which runs once the client is listed and before
   * the effects.
   */
  openClient: (
    options: WebSocketInterceptorProtocolClientOptions<Message>,
  ) => Promise<WebSocketInterceptorProtocolOpenClientResult>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Translates between the raw frames of a framed protocol and the messages seen by interceptor handlers.
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

  /**
   * Called when the interceptor starts, before connections reach it. On an error, the interceptor calls
   * {@link WebSocketInterceptorProtocol.stop `stop`} and then rejects `interceptor.start()` with the error.
   */
  start?: (context: WebSocketInterceptorProtocolContext<Message>) => PossiblePromise<void>;

  /**
   * Called when the interceptor stops, and after a failed {@link WebSocketInterceptorProtocol.start `start`}, so it must
   * handle a partial start. The interceptor does not close the connections the protocol claimed, so the protocol closes
   * them here. Errors reject `interceptor.stop()`, except after a failed start, when they are logged.
   */
  stop?: () => PossiblePromise<void>;

  /** Called when the interceptor is cleared or stopped. Errors are logged. */
  clear?: () => void;

  /**
   * Called for each WebSocket connection to the interceptor. The newest interceptor whose protocol returns a claim
   * holds the connection, receiving its frames and close through the claim instead of the connection handlers. An
   * interceptor whose protocol defines it does not hold the connections its protocol does not claim. The protocol
   * closes the connections it claims, including when it stops, because the interceptor never closes them. Errors are
   * logged.
   */
  claimConnection?: (
    connection: WebSocketInterceptorProtocolConnection,
  ) => WebSocketInterceptorProtocolConnectionClaim | undefined;
}
