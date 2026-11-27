import {
  AllowAnyStringInPathParams,
  HttpPathParamsSchema,
  HttpSearchParamsSchema,
  InferPathParams as InferPathParamsFromPath,
  PreferMostStaticLiteralPath,
  WithoutEscapedColons,
} from '@zimic/utils/http';
import { Branded, Default, JSONValue, Prettify } from '@zimic/utils/types';

import { JSONStringified } from './json';

/** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketmessageschema `WebSocketMessageSchema` API reference} */
export type WebSocketMessageSchema = Exclude<JSONValue.Loose, null | undefined> | Blob | BufferSource;

/** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketconnectionschema `WebSocketConnectionSchema` API reference} */
export interface WebSocketConnectionSchema {
  /** @see {@link https://zimic.dev/docs/ws/guides/schemas#declaring-connections-with-search-params Declaring connections with search params} */
  searchParams?: HttpSearchParamsSchema.Loose;

  /** @see {@link https://zimic.dev/docs/ws/guides/schemas#declaring-connections-with-subprotocols Declaring connections with subprotocols} */
  protocols?: string;
}

/** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketpathschema `WebSocketPathSchema` API reference} */
export interface WebSocketPathSchema {
  /** @see {@link https://zimic.dev/docs/ws/guides/schemas#declaring-connections Declaring connections} */
  connection?: WebSocketConnectionSchema;

  /** @see {@link https://zimic.dev/docs/ws/guides/schemas#declaring-messages Declaring messages} */
  message?: WebSocketMessageSchema;

  /** @see {@link https://zimic.dev/docs/ws/guides/schemas#declaring-message-directions Declaring message directions} */
  serverMessage?: WebSocketMessageSchema;

  /** @see {@link https://zimic.dev/docs/ws/guides/schemas#declaring-message-directions Declaring message directions} */
  clientMessage?: WebSocketMessageSchema;
}

interface BaseWebSocketSchema {
  [path: string]: WebSocketPathSchema;
}

type WebSocketPathMessageField = 'message' | 'serverMessage' | 'clientMessage';

// Declaring every message field, as `never` if omitted, lets generic code read messages with indexed access. Reading the
// optional fields with conditional types instead makes type checks of generic handler types exhaust memory.
type NormalizedWebSocketPathSchema<PathSchema extends WebSocketPathSchema> = Prettify<
  Omit<PathSchema, WebSocketPathMessageField> & {
    [Field in WebSocketPathMessageField]: Field extends keyof PathSchema ? Default<PathSchema[Field]> : never;
  }
>;

/** @see {@link https://zimic.dev/docs/ws/api/websocket-schema `WebSocketSchema` API reference} */
export type WebSocketSchema<Schema extends BaseWebSocketSchema = BaseWebSocketSchema> = Branded<
  { [Path in keyof Schema]: NormalizedWebSocketPathSchema<Schema[Path]> },
  'WebSocketSchema'
>;

export namespace WebSocketSchema {
  /** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemapath `WebSocketSchema.Path` API reference} */
  export type Path<Schema extends WebSocketPathSchema> = Schema;

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemaconnection `WebSocketSchema.Connection` API reference} */
  export type Connection<Schema extends WebSocketConnectionSchema> = Schema;

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemamessage `WebSocketSchema.Message` API reference} */
  export type Message<Schema extends WebSocketMessageSchema> = Schema;

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemasearchparams `WebSocketSchema.SearchParams` API reference} */
  export type SearchParams<Schema extends HttpSearchParamsSchema.Loose> = Schema;

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemapathparams `WebSocketSchema.PathParams` API reference} */
  export type PathParams<Schema extends HttpPathParamsSchema.Loose> = Schema;
}

/** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemapath-1 `WebSocketSchemaPath` API reference} */
export namespace WebSocketSchemaPath {
  /** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemapathliteral `WebSocketSchemaPath.Literal` API reference} */
  export type Literal<Schema extends WebSocketSchema> = keyof Schema & string;

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemapathnonliteral `WebSocketSchemaPath.NonLiteral` API reference} */
  export type NonLiteral<Schema extends WebSocketSchema> = WithoutEscapedColons<
    AllowAnyStringInPathParams<Literal<Schema>>
  >;
}

/** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemapath-1 `WebSocketSchemaPath` API reference} */
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

/** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#literalwebsocketschemapathfromnonliteral `LiteralWebSocketSchemaPathFromNonLiteral` API reference} */
export type LiteralWebSocketSchemaPathFromNonLiteral<
  Schema extends WebSocketSchema,
  NonLiteralPath extends string,
  LiteralPath extends WebSocketSchemaPath.Literal<Schema> = WebSocketSchemaPath.Literal<Schema>,
> = PreferMostStaticLiteralPath<
  LiteralPath extends LiteralPath ? RecursiveInferWebSocketSchemaPath<NonLiteralPath, LiteralPath> : never
>;

/** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#inferpathparams `InferPathParams` API reference} */
export type InferPathParams<
  PathOrSchema extends string | WebSocketSchema,
  OptionalPath extends (PathOrSchema extends WebSocketSchema ? WebSocketSchemaPath.Literal<PathOrSchema> : never) =
    never,
> = InferPathParamsFromPath<
  PathOrSchema extends WebSocketSchema ? OptionalPath : PathOrSchema extends string ? PathOrSchema : never
>;

/** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemamessage-1 `WebSocketSchemaMessage` API reference} */
export namespace WebSocketSchemaMessage {
  /** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemamessageserver `WebSocketSchemaMessage.Server` API reference} */
  export type Server<
    Schema extends WebSocketSchema,
    Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketSchemaPath.Literal<Schema>,
  > = Schema[Path]['message' | 'serverMessage'];

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemamessageclient `WebSocketSchemaMessage.Client` API reference} */
  export type Client<
    Schema extends WebSocketSchema,
    Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketSchemaPath.Literal<Schema>,
  > = Schema[Path]['message' | 'clientMessage'];
}

/** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketschemamessage-1 `WebSocketSchemaMessage` API reference} */
export type WebSocketSchemaMessage<
  Schema extends WebSocketSchema,
  Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketSchemaPath.Literal<Schema>,
> = Schema[Path][WebSocketPathMessageField];

type WebSocketPathConnectionSchema<PathSchema extends WebSocketPathSchema> = 'connection' extends keyof PathSchema
  ? Default<PathSchema['connection']>
  : never;

/** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketconnectionsearchparamsschema `WebSocketConnectionSearchParamsSchema` API reference} */
export type WebSocketConnectionSearchParamsSchema<PathSchema extends WebSocketPathSchema> =
  PathSchema extends WebSocketPathSchema
    ? 'searchParams' extends keyof WebSocketPathConnectionSchema<PathSchema>
      ? Default<WebSocketPathConnectionSchema<PathSchema>['searchParams']>
      : never
    : never;

/** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketconnectionprotocolschema `WebSocketConnectionProtocolSchema` API reference} */
export type WebSocketConnectionProtocolSchema<PathSchema extends WebSocketPathSchema> =
  PathSchema extends WebSocketPathSchema
    ? 'protocols' extends keyof WebSocketPathConnectionSchema<PathSchema>
      ? Default<WebSocketPathConnectionSchema<PathSchema>['protocols']>
      : never
    : never;

/** @see {@link https://zimic.dev/docs/ws/api/websocket-schema#websocketmessagedata `WebSocketMessageData` API reference} */
export type WebSocketMessageData<Schema extends WebSocketMessageSchema> = Schema extends Blob
  ? Schema
  : Schema extends BufferSource
    ? Schema
    : Schema extends string
      ? Schema
      : JSONStringified<Schema>;
