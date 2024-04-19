export namespace WebSocket {
  export interface EventMessage<Data = unknown> {
    id: string;
    channel: string;
    data: Data;
  }

  export interface ReplyMessage<Data = unknown> extends EventMessage<Data> {
    requestId: string;
  }

  export type Message<Data = unknown> = EventMessage<Data> | ReplyMessage<Data>;

  export type MessageListener<Schema extends ServiceSchema, Channel extends ServiceChannel<Schema>> = (
    message: ServiceMessage<Schema, Channel>,
  ) => void;

  export interface ServiceSchema {
    [channel: string]: {
      event: unknown;
      reply?: unknown;
    };
  }

  export type ServiceChannel<Schema extends ServiceSchema> = keyof Schema & string;

  export type EventServiceChannel<Schema extends ServiceSchema> = {
    [Channel in ServiceChannel<Schema>]: Schema[Channel]['reply'] extends undefined ? Channel : never;
  }[ServiceChannel<Schema>];

  export type RequestServiceChannel<Schema extends ServiceSchema> = Exclude<
    ServiceChannel<Schema>,
    EventServiceChannel<Schema>
  >;

  export type ServiceEventMessage<Schema extends ServiceSchema, Channel extends ServiceChannel<Schema>> = EventMessage<
    Schema[Channel]['event']
  >;

  export type ServiceReplyMessage<Schema extends ServiceSchema, Channel extends ServiceChannel<Schema>> = ReplyMessage<
    Schema[Channel]['reply']
  >;

  export type ServiceMessage<Schema extends ServiceSchema, Channel extends ServiceChannel<Schema>> =
    | EventMessage<Schema[Channel]['event']>
    | EventMessage<Schema[Channel]['reply']>;
}
