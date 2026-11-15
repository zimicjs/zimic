import type { PossiblePromise } from '@zimic/utils/types';
import type { WebSocketSchema } from '@zimic/ws';
import type { Packet } from 'socket.io-parser';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A Socket.IO event as seen by handlers, with the first argument as `data` and the remaining ones as `args`.
 */
export interface SocketIOEventMessage<
  Type extends string = string,
  Data = unknown,
  Args extends unknown[] = unknown[],
> {
  /** The event name. */
  type: Type;
  /** The first argument of the event, if any. */
  data?: Data;
  /** The remaining arguments of the event, omitted when there are none. */
  args?: Args;
  /** Identifies the acknowledgement expected by the client. Present when the client passed an ack callback. */
  ackId?: number;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The acknowledgement of an event received with `ackId`, with the arguments of the ack callback as `data` and `args`.
 */
export interface SocketIOAckMessage<Data = unknown, Args extends unknown[] = unknown[]> {
  /** The `ackId` of the acknowledged event. */
  ackId: number;
  /** The first argument passed to the ack callback of the client. */
  data?: Data;
  /** The remaining arguments passed to the ack callback of the client, omitted when there are none. */
  args?: Args;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Any message accepted by a Socket.IO protocol.
 */
export type SocketIOMessage = SocketIOEventMessage | SocketIOAckMessage;

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

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A parser with the same shape as the `parser` option of `socket.io-client`, such as `socket.io-msgpack-parser`.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#custom-parsers Custom parsers}
 */
export interface SocketIOParser {
  /** Encodes a Socket.IO packet into an array of string or binary chunks. */
  Encoder: new () => { encode: (packet: Packet) => unknown };

  /** Decodes string or binary chunks, emitting `decoded` with each complete Socket.IO packet. */
  Decoder: new () => {
    add: (chunk: unknown) => void;
    on: (event: 'decoded', listener: (packet: Packet) => void) => unknown;
  };
}

/** The search params of polling requests read by a Socket.IO protocol. */
interface SocketIOPollingSearchParams {
  EIO?: string;
  sid?: string;
}

/** An Engine.IO error, answered to invalid polling requests. */
interface SocketIOPollingErrorBody {
  code: number;
  message: string;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The HTTP schema of the interceptor passed as the `polling` option of {@link createSocketIOProtocol}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#createsocketioprotocol `createSocketIOProtocol` API reference}
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- HTTP schemas need the implicit index signature of type aliases.
export type SocketIOPollingSchema = {
  '/': {
    GET: {
      request: { searchParams: SocketIOPollingSearchParams };
      response: {
        200: { body: string };
        400: { body: SocketIOPollingErrorBody };
        403: { body: SocketIOPollingErrorBody };
      };
    };
    POST: {
      request: { searchParams: SocketIOPollingSearchParams; body?: string };
      response: { 200: { body: string } };
    };
  };
};

/** A polling request, as read by a Socket.IO protocol. */
export interface SocketIOPollingRequest {
  /** The URL of the request. */
  url: string;
  /** The search params of the request, which identify the Engine.IO version and session. */
  searchParams: { get: (name: keyof SocketIOPollingSearchParams) => string | null };
  /** The packets sent by the client, or `null` if none. */
  body: string | null;
}

/** The responses of a polling method, by status code. */
type SocketIOPollingResponses<Method extends keyof SocketIOPollingSchema['/']> =
  SocketIOPollingSchema['/'][Method]['response'];

/** A response to a polling request, as declared by a Socket.IO protocol. */
export type SocketIOPollingResponse<Method extends keyof SocketIOPollingSchema['/']> = {
  [Status in keyof SocketIOPollingResponses<Method>]: { status: Status } & SocketIOPollingResponses<Method>[Status];
}[keyof SocketIOPollingResponses<Method>];

/** A handler of polling requests, declared by a Socket.IO protocol. */
interface SocketIOPollingHandler<Method extends keyof SocketIOPollingSchema['/']> {
  /** Declares the response to each polling request. */
  respond: (
    declaration: (request: SocketIOPollingRequest) => PossiblePromise<SocketIOPollingResponse<Method>>,
  ) => unknown;
}

/**
 * An HTTP interceptor of {@link SocketIOPollingSchema}, created with `createHttpInterceptor` from
 * `@zimic/interceptor/http`.
 */
export interface SocketIOPollingInterceptor {
  /** The type of the interceptor, the same as the WebSocket interceptor. */
  readonly type: 'local' | 'remote';
  /** The base URL of the interceptor, the WebSocket base URL with `http` instead of `ws`. */
  readonly baseURL: string;
  /** Whether the interceptor is running. The protocol starts and stops it. */
  readonly isRunning: boolean;
  /** Starts the interceptor. */
  start: () => Promise<void>;
  /** Stops the interceptor. */
  stop: () => Promise<void>;
  /** Declares a handler of the long-polling requests. */
  get: (path: '/') => SocketIOPollingHandler<'GET'>;
  /** Declares a handler of the packets sent by polling clients. */
  post: (path: '/') => SocketIOPollingHandler<'POST'>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The options of {@link createSocketIOProtocol}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#createsocketioprotocol `createSocketIOProtocol` API reference}
 */
export interface SocketIOProtocolOptions {
  /** The namespace handled by the interceptor. Frames of other namespaces are ignored. Defaults to `'/'`. */
  namespace?: string;

  /**
   * The HTTP interceptor serving polling requests, on the WebSocket base URL with `http` instead of `ws`, or none to
   * disable polling.
   */
  polling?: SocketIOPollingInterceptor;

  /**
   * The parser used by the client, with the same shape as the `parser` option of `socket.io-client`. The protocols of
   * the namespaces on one base URL must use the same parser.
   */
  parser?: SocketIOParser;
}
