import type { WebSocketSchema } from '@zimic/ws';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A Socket.IO event as seen by handlers. `type` is the event name, `data` is the first argument, and `args` holds the
 * remaining arguments, omitted when there are none. Unlike Socket.IO's `...args`, `args` does not include the first
 * argument.
 */
export interface SocketIOEventMessage<
  Type extends string = string,
  Data = unknown,
  Args extends unknown[] = unknown[],
> {
  /** The event name. */
  type: Type;
  /** The first argument of the event. */
  data: Data;
  /** The remaining arguments of the event, omitted when there are none. */
  args?: Args;
  /** Identifies the acknowledgement expected by the client. Present when the client passed an ack callback. */
  ackId?: number;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The acknowledgement of an event received with `ackId`. `data` is the first argument passed to the ack callback of the
 * client and `args` holds the remaining ones, omitted when there are none.
 */
export interface SocketIOAckMessage<Data = unknown, Args extends unknown[] = unknown[]> {
  /** The `ackId` of the acknowledged event. */
  ackId: number;
  /** The first argument passed to the ack callback of the client. */
  data?: Data;
  /** The remaining arguments passed to the ack callback of the client, omitted when there are none. */
  args?: Args;
}

/** Any message accepted by a Socket.IO protocol. */
export type SocketIOMessage = SocketIOEventMessage | SocketIOAckMessage;

/** The events of one direction, declared as in `socket.io-client`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SocketIOEventsMap = Record<string, (...args: any[]) => void>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketIOAckCallback = (...args: any[]) => void;

type SocketIOEventArguments<Parameters extends unknown[]> = Parameters extends [...infer Arguments, SocketIOAckCallback]
  ? Arguments
  : Parameters;

type SocketIOEventParameters<Event> = Event extends (...args: infer EventParameters) => void ? EventParameters : never;

// Events declared with rest parameters, as in the default events map, have no known arguments.
type SocketIOEventMessageFromArguments<
  Type extends string,
  Arguments extends unknown[],
> = number extends Arguments['length']
  ? SocketIOEventMessage<Type>
  : Arguments extends [infer Data, ...infer Rest]
    ? Rest extends []
      ? Omit<SocketIOEventMessage<Type, Data>, 'args'>
      : SocketIOEventMessage<Type, Data, Rest> & { args: Rest }
    : Omit<SocketIOEventMessage<Type, undefined>, 'args'>;

type SocketIOEventMessages<Events extends object> = {
  [Type in keyof Events & string]: SocketIOEventMessageFromArguments<
    Type,
    SocketIOEventArguments<SocketIOEventParameters<Events[Type]>>
  >;
}[keyof Events & string];

type SocketIOAckMessageFromArguments<Arguments extends unknown[]> = Arguments extends [infer Data, ...infer Rest]
  ? Rest extends []
    ? Omit<SocketIOAckMessage<Data>, 'args'>
    : SocketIOAckMessage<Data, Rest> & { args: Rest }
  : Omit<SocketIOAckMessage, 'args' | 'data'>;

type SocketIOAckMessageFromParameters<EventParameters extends unknown[]> = number extends EventParameters['length']
  ? SocketIOAckMessage
  : EventParameters extends [...unknown[], infer Callback]
    ? Callback extends (...args: infer Arguments) => void
      ? SocketIOAckMessageFromArguments<Arguments>
      : never
    : never;

type SocketIOAckMessages<Events extends object> = {
  [Type in keyof Events & string]: SocketIOAckMessageFromParameters<SocketIOEventParameters<Events[Type]>>;
}[keyof Events & string];

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The WebSocket schema of a Socket.IO server, with events declared as in `socket.io-client`. A trailing callback
 * parameter of a client event declares the type of its acknowledgement.
 *
 * @example
 *   import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';
 *   import { createSocketIOProtocol, type SocketIOSchema } from '@zimic/interceptor/experimental/socket.io';
 *
 *   interface ServerToClientEvents {
 *     'user:created': (user: { id: string }) => void;
 *   }
 *
 *   interface ClientToServerEvents {
 *     'user:create': (input: { name: string }, ack: (user: { id: string }) => void) => void;
 *   }
 *
 *   const interceptor = createWebSocketInterceptor<SocketIOSchema<ServerToClientEvents, ClientToServerEvents>>({
 *     baseURL: 'ws://localhost:3000',
 *     protocol: createSocketIOProtocol(),
 *   });
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#socketioschema `SocketIOSchema` API reference}
 */
export type SocketIOSchema<
  ServerToClientEvents extends object = SocketIOEventsMap,
  ClientToServerEvents extends object = SocketIOEventsMap,
> = WebSocketSchema<{
  '/socket.io/': {
    message:
      | SocketIOEventMessages<ServerToClientEvents>
      | SocketIOEventMessages<ClientToServerEvents>
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
  /** Encodes a Socket.IO packet into string or binary chunks. */
  Encoder: new () => { encode: (packet: SocketIOPacket) => unknown[] };

  /** Decodes string or binary chunks, emitting `decoded` with each complete Socket.IO packet. */
  Decoder: new () => {
    add: (chunk: unknown) => void;
    on: (event: 'decoded', listener: (packet: SocketIOPacket) => void) => unknown;
  };
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A Socket.IO protocol packet, as read and written by a {@link SocketIOParser}.
 */
export interface SocketIOPacket {
  /** The packet type: 0 connect, 1 disconnect, 2 event, 3 ack, 4 connect error, 5 binary event, or 6 binary ack. */
  type: number;
  /** The namespace of the packet. */
  nsp: string;
  /** The acknowledgement ID of the packet, if any. */
  id?: number;
  /** The payload of the packet. */
  data?: unknown;
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
   * Whether to intercept HTTP long-polling requests to `<base URL>/socket.io/`. If `false`, polling clients fail to
   * connect and a warning is logged. Defaults to `true`.
   */
  polling?: boolean;

  /** The parser used by the client, with the same shape as the `parser` option of `socket.io-client`. */
  parser?: SocketIOParser;

  /** The interval between pings sent to clients, in milliseconds. Defaults to 25000. */
  pingInterval?: number;

  /** The time clients wait for a ping beyond `pingInterval`, in milliseconds. Defaults to 20000. */
  pingTimeout?: number;
}
