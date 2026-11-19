/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A Socket.IO event as seen by handlers, with the first argument as `data` and the remaining ones as `args`.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#handling-events Handling Socket.IO events}
 */
export interface SocketIOEventMessage<
  Type extends string = string,
  Data = unknown,
  Args extends unknown[] = unknown[],
> {
  /**
   * The event name.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#handling-events Handling Socket.IO events}
   */
  type: Type;
  /**
   * The first argument of the event, if any.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#handling-events Handling Socket.IO events}
   */
  data?: Data;
  /**
   * The remaining arguments of the event, omitted when there are none.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#handling-events Handling Socket.IO events}
   */
  args?: Args;
  /**
   * Identifies the acknowledgement expected by the client. Present when the client passed an ack callback.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#acknowledging-events Acknowledging Socket.IO events}
   */
  ackId?: number;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The acknowledgement of an event received with `ackId`, with the arguments of the ack callback as `data` and `args`.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#acknowledging-events Acknowledging Socket.IO events}
 */
export interface SocketIOAckMessage<Data = unknown, Args extends unknown[] = unknown[]> {
  /**
   * The `ackId` of the acknowledged event.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#acknowledging-events Acknowledging Socket.IO events}
   */
  ackId: number;
  /**
   * The first argument passed to the ack callback of the client.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#acknowledging-events Acknowledging Socket.IO events}
   */
  data?: Data;
  /**
   * The remaining arguments passed to the ack callback of the client, omitted when there are none.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#acknowledging-events Acknowledging Socket.IO events}
   */
  args?: Args;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Any message accepted by a Socket.IO protocol.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#handling-events Handling Socket.IO events}
 */
export type SocketIOMessage = SocketIOEventMessage | SocketIOAckMessage;
