import { JSONValue } from '..';

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

  export type MessageListener<Schema extends ServiceSchema, Channel extends ServiceChannel<Schema>> = (
    message: ServiceMessage<Schema, Channel>,
  ) => void;

  interface ServiceSchemaDefinition {
    [channel: string]: {
      event: JSONValue;
      reply?: JSONValue;
    };
  }

  export type ServiceSchema<Schema extends ServiceSchemaDefinition = ServiceSchemaDefinition> = Schema;

  export type ServiceChannel<Schema extends ServiceSchema> = keyof Schema & string;

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
  > = EventMessage<Schema[Channel]['event']> | ReplyMessage<Schema[Channel]['reply']>;
}
