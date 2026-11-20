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
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/messages#default-message-parsing Default message parsing}
 */
export type ReceivedWebSocketMessageData<Message extends WebSocketMessageSchema> =
  Message extends UnparsedWebSocketJSONPrimitive
    ? UnparsedWebSocketJSONPrimitiveText<Message>
    : Replace<Message, Blob | ArrayBufferView, ArrayBuffer>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
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
  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlermessages `handler.messages` API reference} */
  sender: WebSocketInterceptorClient<Schema, Path>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlermessages `handler.messages` API reference} */
  receiver: WebSocketInterceptorServer<Schema>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlermessages `handler.messages` API reference} */
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
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference}
 */
export interface WebSocketInterceptorConnectionRequest<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference} */
  url: string;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference} */
  protocols: readonly WebSocketInterceptorConnectionProtocol<Schema, Path>[];

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference} */
  searchParams: HttpSearchParams<WebSocketInterceptorConnectionSearchParamsSchema<Schema, Path>>;

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#inferpathparams `InferPathParams` API reference} */
  pathParams: InferPathParams<Path>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client `WebSocketInterceptorClient` API reference}
 */
export interface WebSocketInterceptorClient<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> {
  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client#clienturl `client.url` API reference}
   */
  url: string;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client#clientprotocols `client.protocols` API reference}
   */
  protocols: readonly WebSocketInterceptorConnectionProtocol<Schema, Path>[];

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client#clientsearchparams `client.searchParams` API reference}
   */
  searchParams: HttpSearchParams<WebSocketInterceptorConnectionSearchParamsSchema<Schema, Path>>;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client#clientmessages `client.messages` API reference}
   */
  messages: readonly InterceptedWebSocketInterceptorMessage<Schema, Path>[];

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client#clientsend `client.send()` API reference} */
  send: (
    data:
      | WebSocketInterceptorPathMessage<Schema, Path>
      | WebSocketMessageData<WebSocketInterceptorPathMessage<Schema, Path>>,
  ) => void;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor-client#clientclose `client.close()` API reference} */
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
