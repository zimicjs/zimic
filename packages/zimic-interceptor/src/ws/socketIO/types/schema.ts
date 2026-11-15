import type { WebSocketSchema } from '@zimic/ws';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The events of one direction, declared as in `socket.io-client`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Parameters are contravariant, so only `any` accepts events with typed parameters.
export type SocketIOEventsMap = Record<string, (...args: any[]) => void>;

type SocketIOAckCallback = SocketIOEventsMap[string];

type SocketIOEventParameters<Event> = Event extends (...args: infer EventParameters) => void ? EventParameters : never;

// Events declared with rest parameters, as in the default events map, have no known arguments.
type SocketIOArguments<Arguments extends unknown[]> = number extends Arguments['length']
  ? { data?: unknown; args?: unknown[] }
  : Arguments extends [infer Data, ...infer Rest]
    ? Rest extends []
      ? { data: Data }
      : { data: Data; args: Rest }
    : { data?: undefined };

// A trailing callback, required or optional, declares the acknowledgement of the event instead of an argument.
type SocketIOEventArguments<EventParameters extends unknown[]> =
  Required<EventParameters> extends [...infer Arguments, SocketIOAckCallback] ? Arguments : EventParameters;

type SocketIOEventAckId<EventParameters extends unknown[]> = number extends EventParameters['length']
  ? { ackId?: number }
  : EventParameters extends [...unknown[], SocketIOAckCallback]
    ? { ackId: number }
    : Required<EventParameters> extends [...unknown[], SocketIOAckCallback]
      ? { ackId?: number }
      : unknown;

type SocketIOServerEventMessages<Events extends object> = {
  [Type in keyof Events & string]: { type: Type; ackId?: number } & SocketIOArguments<
    SocketIOEventArguments<SocketIOEventParameters<Events[Type]>>
  >;
}[keyof Events & string];

type SocketIOClientEventMessages<Events extends object> = {
  [Type in keyof Events & string]: { type: Type } & SocketIOArguments<
    SocketIOEventArguments<SocketIOEventParameters<Events[Type]>>
  > &
    SocketIOEventAckId<SocketIOEventParameters<Events[Type]>>;
}[keyof Events & string];

type SocketIOAckMessageFromParameters<EventParameters extends unknown[]> = number extends EventParameters['length']
  ? { ackId: number } & SocketIOArguments<unknown[]>
  : Required<EventParameters> extends [...unknown[], (...args: infer AckArguments) => void]
    ? { ackId: number } & SocketIOArguments<AckArguments>
    : never;

type SocketIOAckMessages<Events extends object> = {
  [Type in keyof Events & string]: SocketIOAckMessageFromParameters<SocketIOEventParameters<Events[Type]>>;
}[keyof Events & string];

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The WebSocket schema of a Socket.IO server, with events declared as in `socket.io-client`.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#socketioschema `SocketIOSchema` API reference}
 */
export type SocketIOSchema<
  ServerToClientEvents extends object = SocketIOEventsMap,
  ClientToServerEvents extends object = SocketIOEventsMap,
> = WebSocketSchema<{
  '/': {
    message:
      | SocketIOServerEventMessages<ServerToClientEvents>
      | SocketIOClientEventMessages<ClientToServerEvents>
      | SocketIOAckMessages<ClientToServerEvents>;
  };
}>;
