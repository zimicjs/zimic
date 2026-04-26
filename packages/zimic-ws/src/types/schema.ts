import { Branded, JSONValue } from '@zimic/utils/types';

import { JSONStringified } from './json';

type BaseWebSocketSchema = JSONValue | string | Blob | BufferSource;

export type WebSocketSchema<Schema extends BaseWebSocketSchema = BaseWebSocketSchema> = Branded<
  Schema,
  'WebSocketSchema'
>;

export type WebSocketMessageData<Schema extends WebSocketSchema> = Schema extends Blob
  ? Schema
  : Schema extends BufferSource
    ? Schema
    : Schema extends string
      ? Schema
      : JSONStringified<Schema>;
