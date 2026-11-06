import { HttpSearchParams, InferPathParams } from '@zimic/utils/http';
import { Replace } from '@zimic/utils/types';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The data of a client-to-server message as received by the interceptor. Text messages holding a JSON object or array
 * are parsed. Other text messages, including top-level numbers and booleans, arrive as their text, such as `'42'` or
 * `'true'`. Binary messages arrive as `ArrayBuffer`, regardless of whether the client sent a `Blob`, an `ArrayBuffer`,
 * or an `ArrayBufferView`, because WebSocket binary frames carry only raw bytes.
 */
export type ReceivedWebSocketMessageData<Schema extends WebSocketSchema> = Schema extends UnparsedWebSocketJSONPrimitive
  ? UnparsedWebSocketJSONPrimitiveText<Schema>
  : Replace<Schema, Blob | ArrayBufferView, ArrayBuffer>;

/**
 * The top-level JSON values that text messages keep as text, because only objects and arrays are parsed. Top-level
 * `null` is absent because a branded `WebSocketSchema` member cannot be `null`.
 */
export type UnparsedWebSocketJSONPrimitive = number | boolean;

// Template literal types cannot stringify branded schema members, so each kind maps to its text explicitly. Numeric
// literal members widen to any numeric text for the same reason.
type UnparsedWebSocketJSONPrimitiveText<Schema extends UnparsedWebSocketJSONPrimitive> = Schema extends true
  ? 'true'
  : Schema extends false
    ? 'false'
    : `${number}`;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A client-to-server message saved by a message handler, along with its sender and receiver handles.
 */
export interface InterceptedWebSocketInterceptorMessage<
  MessageSchema extends WebSocketSchema,
  ClientSchema extends WebSocketSchema = MessageSchema,
> {
  /** The client that sent the message. */
  sender: WebSocketInterceptorClient<ClientSchema>;

  /** The interceptor server that received the message. */
  receiver: WebSocketInterceptorServer<ClientSchema>;

  /** The message data, as matched by the handler. Binary messages arrive as `ArrayBuffer`. */
  data: ReceivedWebSocketMessageData<MessageSchema>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The handshake of a connection attempt to the interceptor, as matched by a connection handler before it is answered.
 * It describes the attempt and is not a native `Request`.
 */
export interface WebSocketInterceptorConnectionRequest<Path extends string = string> {
  /** The URL used to open the connection. */
  url: string;

  /**
   * The subprotocols requested by the client when opening the connection, in the order they were requested, as in
   * {@link https://developer.mozilla.org/docs/Web/API/WebSocket/WebSocket#protocols `new WebSocket(url, protocols)`}.
   * Empty if the client requested none.
   */
  protocols: readonly string[];

  /**
   * The search parameters of the connection URL.
   *
   * @see {@link https://zimic.dev/docs/http/api/http-search-params `HttpSearchParams` API reference}
   */
  searchParams: HttpSearchParams;

  /**
   * The URI-decoded path parameters of the connection URL, parsed from the path declared in
   * `interceptor.connection(path)`. Empty if the handler declares no path.
   *
   * @see {@link https://zimic.dev/docs/http/api/http-schema#inferpathparams `InferPathParams` API reference}
   */
  pathParams: InferPathParams<Path>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A handle to a client connected to the interceptor.
 */
export interface WebSocketInterceptorClient<Schema extends WebSocketSchema> {
  /**
   * The URL used to open the client connection.
   *
   * @readonly
   */
  url: string;

  /**
   * The subprotocols requested by the client when opening the connection, in the order they were requested, as in
   * {@link https://developer.mozilla.org/docs/Web/API/WebSocket/WebSocket#protocols `new WebSocket(url, protocols)`}.
   * Empty if the client requested none. The interceptor selects the first requested subprotocol.
   *
   * @readonly
   */
  protocols: readonly string[];

  /**
   * The messages sent by this client and saved by matching handlers. Requires message saving to be enabled.
   *
   * @readonly
   */
  messages: readonly InterceptedWebSocketInterceptorMessage<Schema>[];

  /** Sends a server message to this client. */
  send: (data: WebSocketMessageData<Schema>) => void;

  /**
   * Closes the connection of this client, as if the server closed it, and removes the client from every interceptor
   * holding it. The arguments follow the native
   * {@link https://developer.mozilla.org/docs/Web/API/WebSocket/close `WebSocket.close()`}: if `code` is omitted, the
   * client receives the close code 1005 and no reason. Closing a client that is already closed, or no longer held by a
   * running interceptor, does nothing.
   *
   * @param code The close code, either 1000 or between 3000 and 4999. As in `WebSocket.close()`, it is clamped to 0
   *   through 65535 and rounded to the nearest integer, with ties to even, before being checked.
   * @param reason The close reason, up to 123 bytes when encoded as UTF-8. Sent only if `code` is also provided.
   * @throws {DOMException} An `InvalidAccessError` if `code`, after clamping and rounding, is not 1000 or between 3000
   *   and 4999.
   * @throws {DOMException} A `SyntaxError` if `reason` is longer than 123 bytes when encoded as UTF-8.
   */
  close: (code?: number, reason?: string) => void;
}

/** Options for sending a message with `interceptor.server.send()`. */
export interface WebSocketInterceptorServerSendOptions<Schema extends WebSocketSchema> {
  /**
   * The connected clients that should receive the message. If omitted, the message is broadcast to all connected
   * clients.
   */
  to?: WebSocketInterceptorClient<Schema> | readonly WebSocketInterceptorClient<Schema>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A handle to the interceptor's mock server, used to send messages to connected clients.
 */
export interface WebSocketInterceptorServer<Schema extends WebSocketSchema> {
  /**
   * The current base URL of the interceptor.
   *
   * @readonly
   */
  url: string;

  /**
   * The client-to-server messages saved by matching handlers. Requires message saving to be enabled.
   *
   * @readonly
   */
  messages: readonly InterceptedWebSocketInterceptorMessage<Schema>[];

  /** Sends a message to the connected clients selected in `options.to`, or to all of them if omitted. */
  send: (data: WebSocketMessageData<Schema>, options?: WebSocketInterceptorServerSendOptions<Schema>) => void;
}
