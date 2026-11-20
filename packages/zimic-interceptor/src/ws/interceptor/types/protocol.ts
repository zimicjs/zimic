import type { PossiblePromise } from '@zimic/utils/types';

import type { WebSocketInterceptorType } from './options';

// A raw WebSocket frame handled by a protocol.
export type WebSocketInterceptorProtocolFrame = string | ArrayBuffer;

// A WebSocket connection to an interceptor, offered to its protocol to claim.
export interface WebSocketInterceptorProtocolConnection {
  // The URL of the connection, including its search params.
  url: string;
  send: (frame: WebSocketInterceptorProtocolFrame) => void;
  close: (code?: number, reason?: string) => void;
}

// Receives the events of a connection claimed by a protocol.
export interface WebSocketInterceptorProtocolConnectionClaim {
  onFrame: (frame: WebSocketInterceptorProtocolFrame) => void;
  onClose: () => void;
}

export interface WebSocketInterceptorProtocolOpenedClient<Message> {
  // Delivers a message decoded by the protocol to the message handlers of the interceptor, as sent by this client.
  receive: (message: Message) => void;
}

export interface WebSocketInterceptorProtocolClientOptions<Message> {
  // Matched by connection handlers and exposed as `client.url`.
  url: string;

  // The payload the client authenticates with, such as the data of a Socket.IO `CONNECT` packet. Matched by connection
  // handlers and exposed as `request.auth` and `client.auth`.
  auth: Record<string, unknown>;

  // Aborting it releases the client, at any time, removing it from `interceptor.clients`.
  signal: AbortSignal;

  // Called with each message sent to the client by a handler, `client.send`, or `server.send`, as given. Those senders
  // also accept the JSON text of a message, and user code may bypass their types, so the protocol validates each
  // message before sending it.
  send: (message: Message) => void;

  // Called by `client.close()`. It does not remove the client from `interceptor.clients`; aborting the signal does.
  close: (code?: number, reason?: string) => void;

  // Called once the interceptor accepts and lists the client, before connection effects run. Handshake replies are sent
  // here, because the promise returned by `openClient` settles only after connection effects run.
  onOpen: (client: WebSocketInterceptorProtocolOpenedClient<Message>) => void;
}

// `accepted` if the connection handlers accepted the client, `rejected` if they rejected it, or `aborted` if its signal
// was aborted while they decided it.
export type WebSocketInterceptorProtocolOpenClientResult = 'accepted' | 'rejected' | 'aborted';

export interface WebSocketInterceptorProtocolContext<Message> {
  interceptor: {
    type: WebSocketInterceptorType;
    baseURL: string;
  };

  // Opens a client on a transport served by the protocol, running the connection handlers of the interceptor to decide
  // it. The promise settles after the connection effects of an accepted client run.
  openClient: (
    options: WebSocketInterceptorProtocolClientOptions<Message>,
  ) => Promise<WebSocketInterceptorProtocolOpenClientResult>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A protocol served by a WebSocket interceptor, created by `createSocketIOProtocol`.
 */
export interface WebSocketInterceptorProtocol<Message> {
  // Called when the interceptor starts, before connections reach it. On an error, the protocol undoes the work it
  // started, because the interceptor does not call `stop` after it, and `interceptor.start()` rejects with the error.
  start: (context: WebSocketInterceptorProtocolContext<Message>) => PossiblePromise<void>;

  // Called when the interceptor stops, and when a later step of `interceptor.start()` fails after `start` resolved. The
  // interceptor does not close the connections the protocol claimed, so the protocol closes them here and aborts the
  // signals of the clients it opened. Errors reject the `interceptor.stop()` or `interceptor.start()` call that stopped
  // the protocol.
  stop: () => PossiblePromise<void>;

  // Called when the interceptor is cleared or stopped. The protocol aborts the signals of the clients it opened and logs
  // its own errors, because clearing and stopping do not fail on them.
  clear: () => void;

  // Called for each WebSocket connection to the interceptor. The newest interceptor whose protocol returns a claim holds
  // the connection, receiving its frames and close through the claim instead of the connection handlers. An interceptor
  // with a protocol does not hold the connections its protocol does not claim, which go to the interceptors without a
  // protocol. In remote mode, such a connection without another holder closes as if no interceptor were registered,
  // because the interceptor server is its endpoint. The protocol closes the connections it claims, including when it
  // stops, because the interceptor never closes them. Errors are logged.
  claimConnection: (
    connection: WebSocketInterceptorProtocolConnection,
  ) => WebSocketInterceptorProtocolConnectionClaim | undefined;
}
