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
 * The messages exchanged on a WebSocket path. Non-binary, non-string members are sent as JSON. Top-level `null` is not
 * a valid message, because text messages holding it are not parsed.
 */
export type WebSocketMessageSchema = Exclude<JSONValue.Loose, null | undefined> | Blob | BufferSource;

/** The handshake of connections to a WebSocket path. Undeclared search params and subprotocols are type errors. */
export interface WebSocketConnectionSchema {
  /** The search params accepted in the connection URL. */
  searchParams?: HttpSearchParamsSchema.Loose;

  /** The subprotocols that clients can request, as a union of strings. */
  protocols?: string;
}

/** The connections and messages of a WebSocket path. */
export interface WebSocketPathSchema {
  /** The handshake of connections to this path. */
  connection?: WebSocketConnectionSchema;

  /** The messages exchanged by clients connected to this path. */
  message: WebSocketMessageSchema;
}

interface BaseWebSocketSchema {
  [path: string]: WebSocketPathSchema;
}

/**
 * Declares a WebSocket service by path, relative to its base URL. Paths can have parameters, such as `/rooms/:roomId`.
 *
 * @example
 *   import { type WebSocketSchema } from '@zimic/ws';
 *
 *   type Schema = WebSocketSchema<{
 *     '/rooms/:roomId': {
 *       connection: { searchParams: { token: string }; protocols: 'chat' | 'json' };
 *       message: { type: 'ping' } | { type: 'pong' };
 *     };
 *   }>;
 */
export type WebSocketSchema<Schema extends BaseWebSocketSchema = BaseWebSocketSchema> = Branded<
  Schema,
  'WebSocketSchema'
>;

export namespace WebSocketSchema {
  /** Declares the connections and messages of a path, to be used in a {@link WebSocketSchema}. */
  export type Path<Schema extends WebSocketPathSchema> = Schema;

  /** Declares the handshake of connections to a path, to be used in a {@link WebSocketSchema.Path}. */
  export type Connection<Schema extends WebSocketConnectionSchema> = Schema;

  /** Declares the messages of a path, to be used in a {@link WebSocketSchema.Path}. */
  export type Message<Schema extends WebSocketMessageSchema> = Schema;

  /** Declares the search params of a connection, to be used in a {@link WebSocketSchema.Connection}. */
  export type SearchParams<Schema extends HttpSearchParamsSchema.Loose> = Schema;

  /** Declares the path params of a path, to reuse them where the parameters of a path are expected. */
  export type PathParams<Schema extends HttpPathParamsSchema.Loose> = Schema;
}

/** Extracts the paths of a {@link WebSocketSchema}, including their literal and non-literal forms. */
export namespace WebSocketSchemaPath {
  /** Extracts the paths as declared in a {@link WebSocketSchema}, such as `/rooms/:roomId`. */
  export type Literal<Schema extends WebSocketSchema> = keyof Schema & string;

  /** Extracts the concrete forms of the paths declared in a {@link WebSocketSchema}, such as `/rooms/1`. */
  export type NonLiteral<Schema extends WebSocketSchema> = WithoutEscapedColons<
    AllowAnyStringInPathParams<Literal<Schema>>
  >;
}

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

/** Finds the paths declared in a {@link WebSocketSchema} that a concrete path, such as `/rooms/1`, belongs to. */
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
 * @example
 *   import { type InferPathParams } from '@zimic/ws';
 *
 *   type Params = InferPathParams<'/rooms/:roomId'>; // { roomId: string }
 */
export type InferPathParams<
  PathOrSchema extends string | WebSocketSchema,
  OptionalPath extends (PathOrSchema extends WebSocketSchema ? WebSocketSchemaPath.Literal<PathOrSchema> : never) =
    never,
> = InferPathParamsFromPath<
  PathOrSchema extends WebSocketSchema ? OptionalPath : PathOrSchema extends string ? PathOrSchema : never
>;

/**
 * Extracts the messages of a path declared in a {@link WebSocketSchema}. A union of paths, or no path at all, merges the
 * messages of each one.
 */
export type WebSocketSchemaMessage<
  Schema extends WebSocketSchema,
  Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketSchemaPath.Literal<Schema>,
> = Schema[Path]['message'];

type WebSocketPathConnectionSchema<PathSchema extends WebSocketPathSchema> = 'connection' extends keyof PathSchema
  ? Default<PathSchema['connection']>
  : never;

/** Extracts the search params of connections to a {@link WebSocketPathSchema}. `never` if it declares none. */
export type WebSocketConnectionSearchParamsSchema<PathSchema extends WebSocketPathSchema> =
  PathSchema extends WebSocketPathSchema
    ? 'searchParams' extends keyof WebSocketPathConnectionSchema<PathSchema>
      ? Default<WebSocketPathConnectionSchema<PathSchema>['searchParams']>
      : never
    : never;

/** Extracts the subprotocols of connections to a {@link WebSocketPathSchema}. `never` if it declares none. */
export type WebSocketConnectionProtocolSchema<PathSchema extends WebSocketPathSchema> =
  PathSchema extends WebSocketPathSchema
    ? 'protocols' extends keyof WebSocketPathConnectionSchema<PathSchema>
      ? Default<WebSocketPathConnectionSchema<PathSchema>['protocols']>
      : never
    : never;

/** Converts a {@link WebSocketMessageSchema} to the data sent through a socket. JSON messages are sent as text. */
export type WebSocketMessageData<Schema extends WebSocketMessageSchema> = Schema extends Blob
  ? Schema
  : Schema extends BufferSource
    ? Schema
    : Schema extends string
      ? Schema
      : JSONStringified<Schema>;
