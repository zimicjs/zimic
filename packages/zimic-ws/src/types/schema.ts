import { Branded, JSONValue } from '@zimic/utils/types';

import { JSONStringified } from './json';

type BaseWebSocketSchema = JSONValue | string | Blob | ArrayBufferLike | ArrayBufferView;

export type WebSocketSchema<Schema extends BaseWebSocketSchema = BaseWebSocketSchema> = Branded<
  Schema,
  'WebSocketSchema'
>;

export type WebSocketMessageData<Schema extends WebSocketSchema> = Schema extends Blob
  ? Schema
  : Schema extends ArrayBufferLike
    ? Schema
    : Schema extends ArrayBufferView
      ? Schema
      : Schema extends string
        ? Schema
        : JSONStringified<Schema>;

export interface WebSocketEventMap<Schema extends WebSocketSchema> {
  open: Event;
  message: MessageEvent<WebSocketMessageData<Schema>>;
  close: CloseEvent;
  error: Event;
}

export type WebSocketEventType<Schema extends WebSocketSchema = WebSocketSchema> = keyof WebSocketEventMap<Schema>;

export type WebSocketEvent<
  Schema extends WebSocketSchema = WebSocketSchema,
  Type extends WebSocketEventType = WebSocketEventType,
> = WebSocketEventMap<Schema>[Type];
