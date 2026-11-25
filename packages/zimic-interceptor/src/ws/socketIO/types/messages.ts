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
