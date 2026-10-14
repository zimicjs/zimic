import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

export declare const webSocketInterceptorClientRole: unique symbol;
export declare const webSocketInterceptorServerRole: unique symbol;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A client-to-server message saved by a message handler, along with its sender and receiver handles.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlermessages `handler.messages` API reference}
 */
export interface InterceptedWebSocketInterceptorMessage<
  MessageSchema extends WebSocketSchema,
  ClientSchema extends WebSocketSchema = MessageSchema,
> {
  /** The client that sent the message. */
  sender: WebSocketInterceptorClient<ClientSchema>;

  /** The interceptor server that received the message. */
  receiver: WebSocketInterceptorServer<ClientSchema>;

  /** The message data, as matched by the handler. */
  data: MessageSchema;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A handle to a client connected to the interceptor.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclients `interceptor.clients` API reference}
 */
export interface WebSocketInterceptorClient<Schema extends WebSocketSchema> {
  /** Marks this handle as a client, distinguishing it from {@link WebSocketInterceptorServer server handles}. */
  readonly [webSocketInterceptorClientRole]: true;

  /**
   * The URL used to open the client connection.
   *
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclients `interceptor.clients` API reference}
   */
  readonly url: string;

  /**
   * The messages sent by this client and saved by matching handlers. Requires message saving to be enabled.
   *
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclients `interceptor.clients` API reference}
   */
  readonly messages: readonly InterceptedWebSocketInterceptorMessage<Schema>[];

  /**
   * Sends a server message to this client.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclients `interceptor.clients` API reference}
   */
  send: (data: WebSocketMessageData<Schema>) => void;
}

/**
 * Options for sending a message with `interceptor.server.send()`.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
 */
export interface WebSocketInterceptorServerSendOptions<Schema extends WebSocketSchema> {
  /**
   * The connected clients that should receive the message. If omitted, the message is broadcast to all connected
   * clients.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
   */
  to?: WebSocketInterceptorClient<Schema> | readonly WebSocketInterceptorClient<Schema>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A handle to the interceptor's mock server, used to send messages to connected clients.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
 */
export interface WebSocketInterceptorServer<Schema extends WebSocketSchema> {
  /** Marks this handle as a server, distinguishing it from {@link WebSocketInterceptorClient client handles}. */
  readonly [webSocketInterceptorServerRole]: true;

  /**
   * The current base URL of the interceptor.
   *
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
   */
  readonly url: string;

  /**
   * The client-to-server messages saved by matching handlers. Requires message saving to be enabled.
   *
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
   */
  readonly messages: readonly InterceptedWebSocketInterceptorMessage<Schema>[];

  /**
   * Sends a message to the connected clients selected in `options.to`, or to all of them if omitted.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
   */
  send: (data: WebSocketMessageData<Schema>, options?: WebSocketInterceptorServerSendOptions<Schema>) => void;
}
