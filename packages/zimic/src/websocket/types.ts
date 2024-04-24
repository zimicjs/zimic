import type { WebSocket as ClientSocket } from 'isomorphic-ws';

import { JSONValue } from '..';

import { PossiblePromise } from '@/types/utils';

export namespace WebSocket {
  export interface EventMessage<Data extends JSONValue = JSONValue> {
    id: string;
    channel: string;
    data: Data;
  }

  export interface ReplyMessage<Data extends JSONValue = JSONValue> extends EventMessage<Data> {
    requestId: string;
  }

  export type Message<Data extends JSONValue = JSONValue> = EventMessage<Data> | ReplyMessage<Data>;

  interface ServiceSchemaDefinition {
    [channel: string]: {
      event?: JSONValue;
      reply?: JSONValue;
    };
  }

  export type ServiceSchema<Schema extends ServiceSchemaDefinition = ServiceSchemaDefinition> = Schema;

  export type ServiceChannel<Schema extends ServiceSchema> = keyof Schema & string;

  export type EventServiceChannel<Schema extends ServiceSchema> = {
    [Channel in ServiceChannel<Schema>]: Schema[Channel]['reply'] extends JSONValue ? never : Channel;
  }[ServiceChannel<Schema>];

  export type EventWithReplyServiceChannel<Schema extends ServiceSchema> = Exclude<
    ServiceChannel<Schema>,
    EventServiceChannel<Schema>
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
