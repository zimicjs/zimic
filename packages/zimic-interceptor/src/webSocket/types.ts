import { JSONSerialized, JSONValue } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';
import type { WebSocket as ClientSocket } from 'isomorphic-ws';

export namespace WebSocket {
  export interface EventMessage<Data extends JSONValue.Loose = JSONValue> {
    id: string;
    channel: string;
    data: Data;
  }

  export interface ReplyMessage<Data extends JSONValue.Loose = JSONValue> extends EventMessage<Data> {
    requestId: string;
  }

  export type Message<Data extends JSONValue.Loose = JSONValue> = EventMessage<Data> | ReplyMessage<Data>;

  interface ServiceSchemaDefinition {
    [channel: string]: {
      event?: JSONValue.Loose;
      reply?: JSONValue.Loose;
    };
  }

  type ConvertToStrictServiceSchema<Schema extends ServiceSchemaDefinition> = {
    [Channel in keyof Schema]: {
      [Key in keyof Schema[Channel]]: JSONSerialized<Schema[Channel][Key]>;
    };
  };

  export type ServiceSchema<Schema extends ServiceSchemaDefinition = ServiceSchemaDefinition> =
    ConvertToStrictServiceSchema<Schema>;

  export type ServiceChannel<Schema extends ServiceSchema> = keyof Schema & string;

  export type EventWithNoReplyServiceChannel<Schema extends ServiceSchema> = {
    [Channel in ServiceChannel<Schema>]: Schema[Channel]['reply'] extends JSONValue ? never : Channel;
  }[ServiceChannel<Schema>];

  export type EventWithReplyServiceChannel<Schema extends ServiceSchema> = Exclude<
    ServiceChannel<Schema>,
    EventWithNoReplyServiceChannel<Schema>
  >;

  export type ServiceEventMessage<
    Schema extends ServiceSchema,
    Channel extends ServiceChannel<Schema> = ServiceChannel<Schema>,
  > = EventMessage<Schema[Channel]['event']>;

  export type ServiceReplyMessage<
    Schema extends ServiceSchema,
    Channel extends ServiceChannel<Schema> = ServiceChannel<Schema>,
  > = ReplyMessage<Schema[Channel]['reply']>;

  export type ServiceMessage<
    Schema extends ServiceSchema,
    Channel extends ServiceChannel<Schema> = ServiceChannel<Schema>,
  > = ServiceEventMessage<Schema, Channel> | ServiceReplyMessage<Schema, Channel>;

  export type EventMessageListener<Schema extends ServiceSchema, Channel extends ServiceChannel<Schema>> = (
    message: ServiceEventMessage<Schema, Channel>,
    socket: ClientSocket,
  ) => PossiblePromise<ServiceReplyMessage<Schema, Channel>['data']>;

  export type ReplyMessageListener<Schema extends ServiceSchema, Channel extends ServiceChannel<Schema>> = (
    message: ServiceReplyMessage<Schema, Channel>,
    socket: ClientSocket,
  ) => PossiblePromise<void>;
}
