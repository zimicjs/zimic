import {
  AllowAnyStringInPathParams,
  HttpPathParamsSchema,
  HttpSearchParamsSchema,
  InferPathParams as InferPathParamsFromPath,
  PreferMostStaticLiteralPath,
  WithoutEscapedColons,
} from '@zimic/utils/http';
import { Branded, Default, JSONValue } from '@zimic/utils/types';

import { JSONStringified } from './json';

/**
 * The messages exchanged on a WebSocket path.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketmessageschema `WebSocketMessageSchema` API reference}
 */
export type WebSocketMessageSchema = Exclude<JSONValue.Loose, null | undefined> | Blob | BufferSource;

/**
 * The handshake of connections to a WebSocket path.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketconnectionschema `WebSocketConnectionSchema` API reference}
 */
export interface WebSocketConnectionSchema {
  /**
   * The search params accepted in the connection URL.
   *
   * @see {@link https://zimic.dev/docs/ws/guides/schemas#declaring-connections-with-search-params Declaring connections with search params}
   */
  searchParams?: HttpSearchParamsSchema.Loose;

  /**
   * The subprotocols that clients can request, as a union of strings.
   *
   * @see {@link https://zimic.dev/docs/ws/guides/schemas#declaring-connections-with-subprotocols Declaring connections with subprotocols}
   */
  protocols?: string;
}

/**
 * The connections and messages of a WebSocket path.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketpathschema `WebSocketPathSchema` API reference}
 */
export interface WebSocketPathSchema {
  /**
   * The handshake of connections to this path.
   *
   * @see {@link https://zimic.dev/docs/ws/guides/schemas#declaring-connections Declaring connections}
   */
  connection?: WebSocketConnectionSchema;

  /**
   * The messages exchanged by clients connected to this path.
   *
   * @see {@link https://zimic.dev/docs/ws/guides/schemas#declaring-messages Declaring messages}
   */
  message: WebSocketMessageSchema;
}

interface BaseWebSocketSchema {
  [path: string]: WebSocketPathSchema;
}

/**
 * Declares a WebSocket service by path, relative to its base URL.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-schema `WebSocketSchema` API reference}
 */
export type WebSocketSchema<Schema extends BaseWebSocketSchema = BaseWebSocketSchema> = Branded<
  Schema,
  'WebSocketSchema'
>;

export namespace WebSocketSchema {
  /**
   * Declares the connections and messages of a path, to be used in a {@link WebSocketSchema}.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemapath `WebSocketSchema.Path` API reference}
   */
  export type Path<Schema extends WebSocketPathSchema> = Schema;

  /**
   * Declares the handshake of connections to a path, to be used in a {@link WebSocketSchema.Path}.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemaconnection `WebSocketSchema.Connection` API reference}
   */
  export type Connection<Schema extends WebSocketConnectionSchema> = Schema;

  /**
   * Declares the messages of a path, to be used in a {@link WebSocketSchema.Path}.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemamessage `WebSocketSchema.Message` API reference}
   */
  export type Message<Schema extends WebSocketMessageSchema> = Schema;

  /**
   * Declares the search params of a connection, to be used in a {@link WebSocketSchema.Connection}.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemasearchparams `WebSocketSchema.SearchParams` API reference}
   */
  export type SearchParams<Schema extends HttpSearchParamsSchema.Loose> = Schema;

  /**
   * Declares the path params of a path, to reuse them where the parameters of a path are expected.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemapathparams `WebSocketSchema.PathParams` API reference}
   */
  export type PathParams<Schema extends HttpPathParamsSchema.Loose> = Schema;
}

/**
 * Extracts the paths of a {@link WebSocketSchema}, including their literal and non-literal forms.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemapath-1 `WebSocketSchemaPath` API reference}
 */
export namespace WebSocketSchemaPath {
  /**
   * Extracts the paths as declared in a {@link WebSocketSchema}, such as `/rooms/:roomId`.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemapathliteral `WebSocketSchemaPath.Literal` API reference}
   */
  export type Literal<Schema extends WebSocketSchema> = keyof Schema & string;

  /**
   * Extracts the concrete forms of the paths declared in a {@link WebSocketSchema}, such as `/rooms/1`.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemapathnonliteral `WebSocketSchemaPath.NonLiteral` API reference}
   */
  export type NonLiteral<Schema extends WebSocketSchema> = WithoutEscapedColons<
    AllowAnyStringInPathParams<Literal<Schema>>
  >;
}

/**
 * Extracts the paths of a {@link WebSocketSchema}, including their literal and non-literal forms.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemapath-1 `WebSocketSchemaPath` API reference}
 */
export type WebSocketSchemaPath<Schema extends WebSocketSchema> =
  WebSocketSchemaPath.Literal<Schema> | WebSocketSchemaPath.NonLiteral<Schema>;

type RecursiveInferWebSocketSchemaPath<
  NonLiteralPath extends string,
  LiteralPath extends string,
> = string extends LiteralPath
  ? NonLiteralPath
  : NonLiteralPath extends AllowAnyStringInPathParams<LiteralPath>
    ? NonLiteralPath extends `${AllowAnyStringInPathParams<LiteralPath>}/${string}`
      ? never
      : LiteralPath
    : never;

/**
 * Finds the paths declared in a {@link WebSocketSchema} that a concrete path, such as `/rooms/1`, belongs to.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#literalwebsocketschemapathfromnonliteral `LiteralWebSocketSchemaPathFromNonLiteral` API reference}
 */
export type LiteralWebSocketSchemaPathFromNonLiteral<
  Schema extends WebSocketSchema,
  NonLiteralPath extends string,
  LiteralPath extends WebSocketSchemaPath.Literal<Schema> = WebSocketSchemaPath.Literal<Schema>,
> = PreferMostStaticLiteralPath<
  LiteralPath extends LiteralPath ? RecursiveInferWebSocketSchemaPath<NonLiteralPath, LiteralPath> : never
>;

/**
 * Infers the path params of a path, or of a path declared in a {@link WebSocketSchema}.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#inferpathparams `InferPathParams` API reference}
 */
export type InferPathParams<
  PathOrSchema extends string | WebSocketSchema,
  OptionalPath extends (PathOrSchema extends WebSocketSchema ? WebSocketSchemaPath.Literal<PathOrSchema> : never) =
    never,
> = InferPathParamsFromPath<
  PathOrSchema extends WebSocketSchema ? OptionalPath : PathOrSchema extends string ? PathOrSchema : never
>;

/**
 * Extracts the messages of a path declared in a {@link WebSocketSchema}.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemamessage-1 `WebSocketSchemaMessage` API reference}
 */
export type WebSocketSchemaMessage<
  Schema extends WebSocketSchema,
  Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketSchemaPath.Literal<Schema>,
> = Schema[Path]['message'];

type WebSocketPathConnectionSchema<PathSchema extends WebSocketPathSchema> = 'connection' extends keyof PathSchema
  ? Default<PathSchema['connection']>
  : never;

/**
 * Extracts the search params of connections to a {@link WebSocketPathSchema}.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketconnectionsearchparamsschema `WebSocketConnectionSearchParamsSchema` API reference}
 */
export type WebSocketConnectionSearchParamsSchema<PathSchema extends WebSocketPathSchema> =
  PathSchema extends WebSocketPathSchema
    ? 'searchParams' extends keyof WebSocketPathConnectionSchema<PathSchema>
      ? Default<WebSocketPathConnectionSchema<PathSchema>['searchParams']>
      : never
    : never;

/**
 * Extracts the subprotocols of connections to a {@link WebSocketPathSchema}.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketconnectionprotocolschema `WebSocketConnectionProtocolSchema` API reference}
 */
export type WebSocketConnectionProtocolSchema<PathSchema extends WebSocketPathSchema> =
  PathSchema extends WebSocketPathSchema
    ? 'protocols' extends keyof WebSocketPathConnectionSchema<PathSchema>
      ? Default<WebSocketPathConnectionSchema<PathSchema>['protocols']>
      : never
    : never;

/**
 * Converts a {@link WebSocketMessageSchema} to the data sent and received through a socket.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketmessagedata `WebSocketMessageData` API reference}
 */
export type WebSocketMessageData<Schema extends WebSocketMessageSchema> = Schema extends Blob
  ? Schema
  : Schema extends BufferSource
    ? Schema
    : Schema extends string
      ? Schema
      : JSONStringified<Schema>;
