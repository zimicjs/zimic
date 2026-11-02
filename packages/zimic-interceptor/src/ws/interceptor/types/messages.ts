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
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlermessages `handler.messages` API reference}
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
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclients `interceptor.clients` API reference}
 */
export interface WebSocketInterceptorClient<Schema extends WebSocketSchema> {
  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclients `interceptor.clients` API reference}
   */
  readonly url: string;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclients `interceptor.clients` API reference}
   */
  readonly messages: readonly InterceptedWebSocketInterceptorMessage<Schema>[];

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclients `interceptor.clients` API reference} */
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

/** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference} */
export interface WebSocketInterceptorServerSendOptions<Schema extends WebSocketSchema> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference} */
  to?: WebSocketInterceptorClient<Schema> | readonly WebSocketInterceptorClient<Schema>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
 */
export interface WebSocketInterceptorServer<Schema extends WebSocketSchema> {
  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
   */
  readonly url: string;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
   */
  readonly messages: readonly InterceptedWebSocketInterceptorMessage<Schema>[];

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference} */
  send: (data: WebSocketMessageData<Schema>, options?: WebSocketInterceptorServerSendOptions<Schema>) => void;
}
