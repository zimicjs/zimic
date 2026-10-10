import { Branded, JSONValue } from '@zimic/utils/types';

import { JSONStringified } from './json';

type BaseWebSocketSchema = JSONValue | string | Blob | BufferSource;

/**
 * Describes the application data sent and received over a WebSocket connection. Object schemas are sent as JSON
 * strings. String, Blob, and BufferSource schemas retain their data type.
 */
export type WebSocketSchema<Schema extends BaseWebSocketSchema = BaseWebSocketSchema> = Branded<
  Schema,
  'WebSocketSchema'
>;

/**
 * The data type accepted by {@link WebSocketClient.send} and delivered by message events for a schema. Object schemas
 * are represented as JSON strings; binary and string schemas retain their types.
 */
export type WebSocketMessageData<Schema extends WebSocketSchema> = Schema extends Blob
  ? Schema
  : Schema extends BufferSource
    ? Schema
    : Schema extends string
      ? Schema
      : JSONStringified<Schema>;
