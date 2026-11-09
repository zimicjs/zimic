import { HttpSearchParamsSchema } from '@zimic/utils/http';
import { Branded, JSONValue } from '@zimic/utils/types';

import { JSONStringified } from './json';

/**
 * The messages exchanged on a WebSocket path. Non-binary, non-string members are sent as JSON. Top-level `null` is not
 * a valid message, because text messages holding it are not parsed.
 */
export type WebSocketMessageSchema = Exclude<JSONValue, null> | string | Blob | BufferSource;

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

/** Extracts the paths declared in a {@link WebSocketSchema}. */
export type WebSocketSchemaPath<Schema extends WebSocketSchema> = keyof Schema & string;

/**
 * Extracts the messages of a path declared in a {@link WebSocketSchema}. A union of paths, or no path at all, merges the
 * messages of each one.
 */
export type WebSocketSchemaMessage<
  Schema extends WebSocketSchema,
  Path extends WebSocketSchemaPath<Schema> = WebSocketSchemaPath<Schema>,
> = Schema[Path]['message'];

/** Converts a {@link WebSocketMessageSchema} to the data sent through a socket. JSON messages are sent as text. */
export type WebSocketMessageData<Schema extends WebSocketMessageSchema> = Schema extends Blob
  ? Schema
  : Schema extends BufferSource
    ? Schema
    : Schema extends string
      ? Schema
      : JSONStringified<Schema>;
