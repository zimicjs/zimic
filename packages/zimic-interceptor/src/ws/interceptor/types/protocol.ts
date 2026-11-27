import type { PossiblePromise } from '@zimic/utils/types';

import type { WebSocketInterceptorType } from './options';

/** A raw WebSocket frame handled by a protocol. */
export type WebSocketInterceptorProtocolFrame = string | ArrayBuffer;

/** A WebSocket connection to an interceptor, offered to its protocol to claim. */
export interface WebSocketInterceptorProtocolConnection {
  /** The URL of the connection, including its search params. */
  url: string;

  /** Sends a frame to the connection. */
  send: (frame: WebSocketInterceptorProtocolFrame) => void;

  /** Closes the connection. */
  close: (code?: number, reason?: string) => void;
}

/** Receives the events of a connection claimed by a protocol. */
export interface WebSocketInterceptorProtocolConnectionClaim {
  /** Called with each frame received from the connection. */
  onFrame: (frame: WebSocketInterceptorProtocolFrame) => void;

  /** Called when the connection closes. */
  onClose: () => void;
}

/** A client opened by a protocol and accepted by the interceptor. */
export interface WebSocketInterceptorProtocolOpenedClient<ClientMessage> {
  /** Delivers a message decoded by the protocol to the message handlers of the interceptor, as sent by this client. */
  receive: (message: ClientMessage) => void;
}

/** The options of a client opened by a protocol. */
export interface WebSocketInterceptorProtocolClientOptions<ServerMessage, ClientMessage> {
  /** Matched by connection handlers and exposed as `client.url`. */
  url: string;

  /**
   * The payload the client authenticates with, such as the data of a Socket.IO `CONNECT` packet. Matched by connection
   * handlers and exposed as `request.auth` and `client.auth`.
   */
  auth: Record<string, unknown>;

  /** Aborting it releases the client, at any time, removing it from `interceptor.clients`. */
  signal: AbortSignal;

  // Handlers, `client.send`, and `server.send` also accept the JSON text of a message, and user code may bypass their
  // types, so the protocol validates each message before sending it.
  /** Called with each message sent to the client by a handler, `client.send`, or `server.send`, as given. */
  send: (message: ServerMessage) => void;

  // `close` does not remove the client from `interceptor.clients`. Aborting the signal does.
  /** Called by `client.close()`. */
  close: (code?: number, reason?: string) => void;

  // Handshake replies are sent here, because the promise returned by `openClient` settles only after connection
  // effects run.
  /** Called once the interceptor accepts and lists the client, before connection effects run. */
  onOpen: (client: WebSocketInterceptorProtocolOpenedClient<ClientMessage>) => void;
}

// `accepted` if the connection handlers accepted the client, `rejected` if they rejected it, or `aborted` if its signal
// was aborted while they decided it. A rejection carries the `error` declared by the rejecting handler, if any, which
// comes from user code that may bypass the schema types, so the protocol validates it before sending it.
/** The outcome of opening a client on a protocol. */
export type WebSocketInterceptorProtocolOpenClientResult =
  { result: 'accepted' } | { result: 'rejected'; error?: unknown } | { result: 'aborted' };

/** The context given to a protocol when its interceptor starts. */
export interface WebSocketInterceptorProtocolContext<ServerMessage, ClientMessage> {
  /** The interceptor serving the protocol. */
  interceptor: {
    type: WebSocketInterceptorType;
    baseURL: string;
  };

  // The promise settles after the connection effects of an accepted client run.
  /** Opens a client on a transport served by the protocol, running the connection handlers to decide it. */
  openClient: (
    options: WebSocketInterceptorProtocolClientOptions<ServerMessage, ClientMessage>,
  ) => Promise<WebSocketInterceptorProtocolOpenClientResult>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#creating-a-socketio-interceptor Creating a Socket.IO interceptor}
 */
export interface WebSocketInterceptorProtocol<ServerMessage, ClientMessage> {
  // On an error, the protocol undoes the work it started, because the interceptor does not call `stop` after it, and
  // `interceptor.start()` rejects with the error.
  /** Called when the interceptor starts, before connections reach it. */
  start: (context: WebSocketInterceptorProtocolContext<ServerMessage, ClientMessage>) => PossiblePromise<void>;

  // Also called when a later step of `interceptor.start()` fails after `start` resolved. The interceptor does not close
  // the connections the protocol claimed, so the protocol closes them here and aborts the signals of the clients it
  // opened. Errors reject the `interceptor.stop()` or `interceptor.start()` call that stopped the protocol.
  /** Called when the interceptor stops. */
  stop: () => PossiblePromise<void>;

  // The protocol aborts the signals of the clients it opened and logs its own errors, because clearing and stopping do
  // not fail on them.
  /** Called when the interceptor is cleared or stopped. */
  clear: () => void;

  // The newest interceptor whose protocol returns a claim holds the connection, receiving its frames and close through
  // the claim instead of the connection handlers. An interceptor with a protocol does not hold the connections its
  // protocol does not claim, which go to the interceptors without a protocol. In remote mode, such a connection without
  // another holder closes as if no interceptor were registered, because the interceptor server is its endpoint. The
  // protocol closes the connections it claims, including when it stops, because the interceptor never closes them.
  // Errors are logged.
  /** Called for each WebSocket connection to the interceptor. */
  claimConnection: (
    connection: WebSocketInterceptorProtocolConnection,
  ) => WebSocketInterceptorProtocolConnectionClaim | undefined;
}
