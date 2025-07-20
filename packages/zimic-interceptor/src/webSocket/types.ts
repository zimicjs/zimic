import { JSONSerialized, JSONValue } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';
import type { WebSocket as ClientSocket } from 'isomorphic-ws';

export interface WebSocketChannelData<Channel extends string> {
  id: string;
  channel: Channel;
}

export interface WebSocketEventMessage<
  Schema extends WebSocketSchema,
  Channel extends WebSocketChannel<Schema> = WebSocketChannel<Schema>,
> extends WebSocketChannelData<Channel> {
  data: Schema[Channel]['event'];
}

export interface WebSocketReplyMessage<
  Schema extends WebSocketSchema,
  Channel extends WebSocketChannel<Schema> = WebSocketChannel<Schema>,
> extends WebSocketChannelData<Channel> {
  data: Schema[Channel]['reply'];
  requestId: string;
}

export type WebSocketMessage<
  Schema extends WebSocketSchema,
  Channel extends WebSocketChannel<Schema> = WebSocketChannel<Schema>,
> = WebSocketEventMessage<Schema, Channel> | WebSocketReplyMessage<Schema, Channel>;

interface BaseWebSocketSchema {
  [channel: string]: {
    event?: JSONValue.Loose;
    reply?: JSONValue.Loose;
  };
}

export type WebSocketSchema<Schema extends BaseWebSocketSchema = BaseWebSocketSchema> =
  WebSocketSchema.ConvertToStrict<Schema>;

export namespace WebSocketSchema {
  export type ConvertToStrict<Schema extends BaseWebSocketSchema> = {
    [Channel in keyof Schema]: {
      [Key in keyof Schema[Channel]]: JSONSerialized<Schema[Channel][Key]>;
    };
  };
}

export type WebSocketChannel<Schema extends WebSocketSchema> = keyof Schema & string;

export type WebSocketChannelWithNoReply<Schema extends WebSocketSchema> = {
  [Channel in WebSocketChannel<Schema>]: Schema[Channel]['reply'] extends JSONValue ? never : Channel;
}[WebSocketChannel<Schema>];

export type WebSocketChannelWithReply<Schema extends WebSocketSchema> = Exclude<
  WebSocketChannel<Schema>,
  WebSocketChannelWithNoReply<Schema>
>;

export type WebSocketEventMessageListener<Schema extends WebSocketSchema, Channel extends WebSocketChannel<Schema>> = (
  message: WebSocketEventMessage<Schema, Channel>,
  socket: ClientSocket,
) => PossiblePromise<WebSocketReplyMessage<Schema, Channel>['data']>;

export type WebSocketReplyMessageListener<Schema extends WebSocketSchema, Channel extends WebSocketChannel<Schema>> = (
  message: WebSocketReplyMessage<Schema, Channel>,
  socket: ClientSocket,
) => PossiblePromise<void>;
