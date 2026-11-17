import type { PossiblePromise } from '@zimic/utils/types';

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

  /**
   * Sends a message to the client, called with each message sent to it by a handler, `client.send`, or `server.send`,
   * as given. Those senders also accept the JSON text of a message, and user code may bypass their types, so validate
   * each message before sending it.
   */
  send: (message: Message) => void;

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
 * Serves a framed protocol, such as Socket.IO, on its own transports. It claims the WebSocket connections of its
 * transports and opens a client for each peer it serves, whose messages reach the interceptor handlers.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#protocol-option `protocol` option}
 */
export interface WebSocketInterceptorProtocol<Message> {
  /**
   * Called when the interceptor starts, before connections reach it. On an error, it must undo the work it started,
   * because the interceptor does not call {@link WebSocketInterceptorProtocol.stop `stop`} after it, and
   * `interceptor.start()` rejects with the error.
   */
  start?: (context: WebSocketInterceptorProtocolContext<Message>) => PossiblePromise<void>;

  /**
   * Called when the interceptor stops, and when a later step of `interceptor.start()` fails after
   * {@link WebSocketInterceptorProtocol.start `start`} resolved. The interceptor does not close the connections the
   * protocol claimed, so the protocol closes them here. Errors reject the `interceptor.stop()` or `interceptor.start()`
   * call that stopped the protocol.
   */
  stop?: () => PossiblePromise<void>;

  /** Called when the interceptor is cleared or stopped. Errors are logged. */
  clear?: () => void;

  /**
   * Called for each WebSocket connection to the interceptor. The newest interceptor whose protocol returns a claim
   * holds the connection, receiving its frames and close through the claim instead of the connection handlers. An
   * interceptor with a protocol does not hold the connections its protocol does not claim, which go to the interceptors
   * without a protocol. The protocol closes the connections it claims, including when it stops, because the interceptor
   * never closes them. Errors are logged.
   */
  claimConnection: (
    connection: WebSocketInterceptorProtocolConnection,
  ) => WebSocketInterceptorProtocolConnectionClaim | undefined;
}
