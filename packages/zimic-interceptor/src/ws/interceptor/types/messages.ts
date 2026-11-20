import { HttpSearchParams, InferPathParams } from '@zimic/utils/http';
import { IfAny, IfNever, Replace, UnionHasMoreThanOneType, UnionToIntersection } from '@zimic/utils/types';
import {
  WebSocketConnectionProtocolSchema,
  WebSocketConnectionSearchParamsSchema,
  WebSocketMessageData,
  WebSocketMessageSchema,
  WebSocketPathSchema,
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
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A message that no handler of the interceptor matched.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/unhandled-messages Unhandled messages}
 */
export type UnhandledWebSocketInterceptorMessage<Schema extends WebSocketSchema = WebSocketSchema> =
  ReceivedWebSocketMessageData<WebSocketSchemaMessage<Schema>>;

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
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlermessages `handler.messages` API reference}
 */
export interface InterceptedWebSocketInterceptorMessage<
  Schema extends WebSocketSchema,
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> {
  /**
   * The client that sent the message.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client `WebSocketInterceptorClient` API reference}
   */
  sender: WebSocketInterceptorClient<Schema, Path>;

  /**
   * The interceptor server that received the message.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
   */
  receiver: WebSocketInterceptorServer<Schema>;

  /**
   * The message data, as matched by the handler.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlermessages `handler.messages` API reference}
   */
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

type WebSocketPathConnectionAuth<PathSchema extends WebSocketPathSchema> = PathSchema extends {
  connection: { auth: infer Auth };
}
  ? Auth
  : never;

/**
 * The `auth` payload declared for connections to a handler path, as in Socket.IO schemas. `never` if the schema
 * declares none, including in schema-erased types, so that clients of any schema are assignable to them.
 */
export type WebSocketInterceptorConnectionAuth<Schema extends WebSocketSchema, Path extends string> = IfAny<
  Schema,
  never,
  WebSocketPathConnectionAuth<Schema[DeclaredWebSocketInterceptorPath<Schema, Path>]>
>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The handshake of a connection attempt to the interceptor, as matched by a connection handler before it is answered.
 * `auth` exists only if the schema declares it, as in Socket.IO schemas.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference}
 */
export type WebSocketInterceptorConnectionRequest<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> = IfNever<
  WebSocketInterceptorConnectionAuth<Schema, Path>,
  BaseWebSocketInterceptorConnectionRequest<Schema, Path>,
  BaseWebSocketInterceptorConnectionRequest<Schema, Path> & {
    /**
     * The `auth` payload sent by the Socket.IO client when connecting to the namespace, or `{}` if it sent none.
     *
     * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference}
     */
    auth: WebSocketInterceptorConnectionAuth<Schema, Path>;
  }
>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The members of {@link WebSocketInterceptorConnectionRequest} present in every schema.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference}
 */
export interface BaseWebSocketInterceptorConnectionRequest<Schema extends WebSocketSchema, Path extends string> {
  /**
   * The URL used to open the connection.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference}
   */
  url: string;

  /**
   * The subprotocols requested by the client when opening the connection, in the order they were requested.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference}
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
 * A handle of a client connected to a WebSocket interceptor. `auth` exists only if the schema declares it, as in
 * Socket.IO schemas.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client `WebSocketInterceptorClient` API reference}
 */
export type WebSocketInterceptorClient<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> = IfNever<
  WebSocketInterceptorConnectionAuth<Schema, Path>,
  BaseWebSocketInterceptorClient<Schema, Path>,
  BaseWebSocketInterceptorClient<Schema, Path> & {
    /**
     * The `auth` payload sent by the Socket.IO client when connecting to the namespace, or `{}` if it sent none.
     *
     * @readonly
     * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client#clientauth `client.auth` API reference}
     */
    auth: WebSocketInterceptorConnectionAuth<Schema, Path>;
  }
>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The members of {@link WebSocketInterceptorClient} present in every schema.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client `WebSocketInterceptorClient` API reference}
 */
export interface BaseWebSocketInterceptorClient<Schema extends WebSocketSchema, Path extends string> {
  /**
   * The URL used to open the connection of the client.
   *
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client#clienturl `client.url` API reference}
   */
  url: string;

  /**
   * The subprotocols requested by the client when opening the connection, in the order they were requested.
   *
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client#clientprotocols `client.protocols` API reference}
   */
  protocols: readonly WebSocketInterceptorConnectionProtocol<Schema, Path>[];

  /**
   * The search parameters of the URL used to open the connection of the client.
   *
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client#clientsearchparams `client.searchParams` API reference}
   */
  searchParams: HttpSearchParams<WebSocketInterceptorConnectionSearchParamsSchema<Schema, Path>>;

  /**
   * The client-to-server messages sent by this client that matched a message handler.
   *
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client#clientmessages `client.messages` API reference}
   */
  messages: readonly InterceptedWebSocketInterceptorMessage<Schema, Path>[];

  /**
   * Sends a server message to this client.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client#clientsend `client.send()` API reference}
   */
  send: (
    data:
      | WebSocketInterceptorPathMessage<Schema, Path>
      | WebSocketMessageData<WebSocketInterceptorPathMessage<Schema, Path>>,
  ) => void;

  /**
   * Closes the connection of this client, as if the server closed it.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client#clientclose `client.close()` API reference}
   */
  close: (code?: number, reason?: string) => void;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
 */
export interface WebSocketInterceptorServerSendOptions<Schema extends WebSocketSchema> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference} */
  to?: WebSocketInterceptorClient<Schema> | readonly WebSocketInterceptorClient<Schema>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
 */
export interface WebSocketInterceptorServer<Schema extends WebSocketSchema = WebSocketSchema> {
  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
   */
  url: string;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
   */
  messages: readonly InterceptedWebSocketInterceptorMessage<Schema>[];

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference} */
  send: (
    data: WebSocketSchemaMessage<Schema> | WebSocketMessageData<WebSocketSchemaMessage<Schema>>,
    options?: WebSocketInterceptorServerSendOptions<Schema>,
  ) => void;
}
