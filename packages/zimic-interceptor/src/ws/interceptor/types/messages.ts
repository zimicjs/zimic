import { HttpSearchParams, InferPathParams } from '@zimic/utils/http';
import { IfNever, Replace, UnionHasMoreThanOneType, UnionToIntersection } from '@zimic/utils/types';
import {
  WebSocketConnectionProtocolSchema,
  WebSocketConnectionSearchParamsSchema,
  WebSocketMessageData,
  WebSocketMessageSchema,
  WebSocketSchema,
  WebSocketSchemaMessage,
  WebSocketSchemaPath,
} from '@zimic/ws';

import { DeclaredWebSocketInterceptorPath, WebSocketInterceptorPathMessage } from './schema';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The data of a client-to-server message as received by the interceptor. Text messages holding a JSON object or array
 * are parsed. Other text messages, including top-level numbers and booleans, arrive as their text, such as `'42'` or
 * `'true'`. Binary messages arrive as `ArrayBuffer`, regardless of whether the client sent a `Blob`, an `ArrayBuffer`,
 * or an `ArrayBufferView`, because WebSocket binary frames carry only raw bytes.
 */
export type ReceivedWebSocketMessageData<Message extends WebSocketMessageSchema> =
  Message extends UnparsedWebSocketJSONPrimitive
    ? UnparsedWebSocketJSONPrimitiveText<Message>
    : Replace<Message, Blob | ArrayBufferView, ArrayBuffer>;

/**
 * The top-level JSON values that text messages keep as text, because only objects and arrays are parsed. Top-level
 * `null` is absent because a `WebSocketMessageSchema` cannot be `null`.
 */
export type UnparsedWebSocketJSONPrimitive = number | boolean;

// Each kind maps to its text explicitly, so numeric literal members widen to any numeric text.
type UnparsedWebSocketJSONPrimitiveText<Message extends UnparsedWebSocketJSONPrimitive> = Message extends true
  ? 'true'
  : Message extends false
    ? 'false'
    : `${number}`;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A client-to-server message saved by a message handler, along with its sender and receiver handles. The sender is
 * typed from the handler path and the receiver with the messages of all paths, because the interceptor server holds and
 * broadcasts them all.
 */
export interface InterceptedWebSocketInterceptorMessage<
  Schema extends WebSocketSchema,
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> {
  /** The client that sent the message. */
  sender: WebSocketInterceptorClient<Schema, Path>;

  /** The interceptor server that received the message. */
  receiver: WebSocketInterceptorServer<Schema>;

  /** The message data, as matched by the handler. Binary messages arrive as `ArrayBuffer`. */
  data: ReceivedWebSocketMessageData<RestrictedMessage>;
}

/** Whether a handler declares no path in a schema with more than one, so its connections may go to any of them. */
type IsWebSocketInterceptorHandlerOfMultiplePaths<Schema extends WebSocketSchema, Path extends string> =
  Path extends WebSocketSchemaPath.Literal<Schema>
    ? false
    : UnionHasMoreThanOneType<WebSocketSchemaPath.Literal<Schema>>;

type DeclaredWebSocketInterceptorSearchParamsSchema<
  Schema extends WebSocketSchema,
  Path extends string,
> = WebSocketConnectionSearchParamsSchema<Schema[DeclaredWebSocketInterceptorPath<Schema, Path>]>;

/**
 * The search params declared for connections to a handler path. A handler without a path in a schema with more than one
 * receives connections to any of them, so the search params of all paths are optional. `never` if the schema declares
 * none.
 */
export type WebSocketInterceptorConnectionSearchParamsSchema<Schema extends WebSocketSchema, Path extends string> =
  IsWebSocketInterceptorHandlerOfMultiplePaths<Schema, Path> extends true
    ? IfNever<
        DeclaredWebSocketInterceptorSearchParamsSchema<Schema, Path>,
        never,
        Partial<UnionToIntersection<DeclaredWebSocketInterceptorSearchParamsSchema<Schema, Path>>>
      >
    : DeclaredWebSocketInterceptorSearchParamsSchema<Schema, Path>;

/** The subprotocols declared for connections to a handler path. `never` if the schema declares none. */
export type WebSocketInterceptorConnectionProtocol<
  Schema extends WebSocketSchema,
  Path extends string,
> = WebSocketConnectionProtocolSchema<Schema[DeclaredWebSocketInterceptorPath<Schema, Path>]>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The handshake of a connection attempt to the interceptor, as matched by a connection handler before it is answered.
 * It describes the attempt and is not a native `Request`.
 */
export interface WebSocketInterceptorConnectionRequest<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> {
  /** The URL used to open the connection. */
  url: string;

  /**
   * The subprotocols requested by the client when opening the connection, in the order they were requested, as in
   * {@link https://developer.mozilla.org/docs/Web/API/WebSocket/WebSocket#protocols `new WebSocket(url, protocols)`}.
   * Empty if the client requested none.
   */
  protocols: readonly WebSocketInterceptorConnectionProtocol<Schema, Path>[];

  /**
   * The search parameters of the connection URL.
   *
   * @see {@link https://zimic.dev/docs/http/api/http-search-params `HttpSearchParams` API reference}
   */
  searchParams: HttpSearchParams<WebSocketInterceptorConnectionSearchParamsSchema<Schema, Path>>;

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
 * A handle to a client connected to the interceptor, with its messages, search params, and subprotocols typed from the
 * path of its connection. Without a path, it is typed with the messages and subprotocols of all paths, and with their
 * search params as optional.
 */
export interface WebSocketInterceptorClient<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> {
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
  protocols: readonly WebSocketInterceptorConnectionProtocol<Schema, Path>[];

  /**
   * The search parameters of the URL used to open the client connection.
   *
   * @readonly
   * @see {@link https://zimic.dev/docs/http/api/http-search-params `HttpSearchParams` API reference}
   */
  searchParams: HttpSearchParams<WebSocketInterceptorConnectionSearchParamsSchema<Schema, Path>>;

  /**
   * The messages sent by this client and saved by matching handlers. Requires message saving to be enabled.
   *
   * @readonly
   */
  messages: readonly InterceptedWebSocketInterceptorMessage<Schema, Path>[];

  /**
   * Sends a server message to this client. Without a protocol, messages other than strings and binary data are sent as
   * their JSON text. With a protocol, the protocol encodes the message as received.
   */
  send: (
    data:
      | WebSocketInterceptorPathMessage<Schema, Path>
      | WebSocketMessageData<WebSocketInterceptorPathMessage<Schema, Path>>,
  ) => void;

  /**
   * Closes the connection of this client, as if the server closed it, and removes the client from every interceptor
   * holding it. The arguments follow the native
   * {@link https://developer.mozilla.org/docs/Web/API/WebSocket/close `WebSocket.close()`}: if `code` is omitted, the
   * client receives the close code 1005 and no reason. Closing a client that is already closed, or no longer held by a
   * running interceptor, does nothing. Clients of a Socket.IO interceptor disconnect only from its namespace.
   *
   * @param code The close code, either 1000 or between 3000 and 4999. As in `WebSocket.close()`, it is clamped to 0
   *   through 65535 and rounded to the nearest integer, with ties to even, before being checked.
   * @param reason The close reason, up to 123 bytes when encoded as UTF-8. Sent only if `code` is also provided.
   * @throws {DOMException} An `InvalidAccessError` if `code`, after clamping and rounding, is not 1000 or between 3000
   *   and 4999.
   * @throws {DOMException} A `SyntaxError` if `reason` is longer than 123 bytes when encoded as UTF-8.
   * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#clients Socket.IO clients}
   */
  close: (code?: number, reason?: string) => void;
}

/** Options for sending a message with `interceptor.server.send()`. */
export interface WebSocketInterceptorServerSendOptions<Schema extends WebSocketSchema> {
  /**
   * The connected clients that should receive the message, of any path of the schema. If omitted, the message is
   * broadcast to all connected clients.
   */
  to?: WebSocketInterceptorClient<Schema> | readonly WebSocketInterceptorClient<Schema>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A handle to the interceptor's mock server, used to send messages to connected clients. It is typed with the messages
 * of all paths of the schema, because it holds and broadcasts them all.
 */
export interface WebSocketInterceptorServer<Schema extends WebSocketSchema = WebSocketSchema> {
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

  /**
   * Sends a message to the connected clients selected in `options.to`, or to all of them if omitted. Without a
   * protocol, messages other than strings and binary data are sent as their JSON text. With a protocol, the protocol
   * encodes the message as received for each client.
   */
  send: (
    data: WebSocketSchemaMessage<Schema> | WebSocketMessageData<WebSocketSchemaMessage<Schema>>,
    options?: WebSocketInterceptorServerSendOptions<Schema>,
  ) => void;
}
