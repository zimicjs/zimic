/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#handling-events Handling Socket.IO events}
 */
export interface SocketIOEventMessage<
  Type extends string = string,
  Data = unknown,
  Args extends unknown[] = unknown[],
> {
  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#handling-events Handling Socket.IO events} */
  type: Type;
  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#handling-events Handling Socket.IO events} */
  data?: Data;
  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#handling-events Handling Socket.IO events} */
  args?: Args;
  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#acknowledging-events Acknowledging Socket.IO events} */
  ackId?: number;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#acknowledging-events Acknowledging Socket.IO events}
 */
export interface SocketIOAckMessage<Data = unknown, Args extends unknown[] = unknown[]> {
  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#acknowledging-events Acknowledging Socket.IO events} */
  ackId: number;
  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#acknowledging-events Acknowledging Socket.IO events} */
  data?: Data;
  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#acknowledging-events Acknowledging Socket.IO events} */
  args?: Args;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#handling-events Handling Socket.IO events}
 */
export type SocketIOMessage = SocketIOEventMessage | SocketIOAckMessage;
