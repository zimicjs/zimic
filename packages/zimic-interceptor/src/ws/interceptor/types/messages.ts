import { Replace } from '@zimic/utils/types';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

export declare const webSocketInterceptorClientRole: unique symbol;
export declare const webSocketInterceptorServerRole: unique symbol;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The data of a client-to-server message as received by the interceptor. Text messages are parsed as JSON when
 * possible. Binary messages arrive as `ArrayBuffer`, regardless of whether the client sent a `Blob`, an `ArrayBuffer`,
 * or an `ArrayBufferView`, because WebSocket binary frames carry only raw bytes.
 */
export type ReceivedWebSocketMessageData<Schema extends WebSocketSchema> = Replace<
  Schema,
  Blob | ArrayBufferView,
  ArrayBuffer
>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A client-to-server message saved by a message handler, along with its sender and receiver handles.
 */
export interface InterceptedWebSocketInterceptorMessage<
  MessageSchema extends WebSocketSchema,
  ClientSchema extends WebSocketSchema = MessageSchema,
> {
  /** The client that sent the message. */
  sender: WebSocketInterceptorClient<ClientSchema>;

  /** The interceptor server that received the message. */
  receiver: WebSocketInterceptorServer<ClientSchema>;

  /** The message data, as matched by the handler. Binary messages arrive as `ArrayBuffer`. */
  data: ReceivedWebSocketMessageData<MessageSchema>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A handle to a client connected to the interceptor.
 */
export interface WebSocketInterceptorClient<Schema extends WebSocketSchema> {
  /** Marks this handle as a client, distinguishing it from {@link WebSocketInterceptorServer server handles}. */
  readonly [webSocketInterceptorClientRole]: true;

  /**
   * The URL used to open the client connection.
   *
   * @readonly
   */
  readonly url: string;

  /**
   * The messages sent by this client and saved by matching handlers. Requires message saving to be enabled.
   *
   * @readonly
   */
  readonly messages: readonly InterceptedWebSocketInterceptorMessage<Schema>[];

  /** Sends a server message to this client. */
  send: (data: WebSocketMessageData<Schema>) => void;
}

/** Options for sending a message with `interceptor.server.send()`. */
export interface WebSocketInterceptorServerSendOptions<Schema extends WebSocketSchema> {
  /**
   * The connected clients that should receive the message. If omitted, the message is broadcast to all connected
   * clients.
   */
  to?: WebSocketInterceptorClient<Schema> | readonly WebSocketInterceptorClient<Schema>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A handle to the interceptor's mock server, used to send messages to connected clients.
 */
export interface WebSocketInterceptorServer<Schema extends WebSocketSchema> {
  /** Marks this handle as a server, distinguishing it from {@link WebSocketInterceptorClient client handles}. */
  readonly [webSocketInterceptorServerRole]: true;

  /**
   * The current base URL of the interceptor.
   *
   * @readonly
   */
  readonly url: string;

  /**
   * The client-to-server messages saved by matching handlers. Requires message saving to be enabled.
   *
   * @readonly
   */
  readonly messages: readonly InterceptedWebSocketInterceptorMessage<Schema>[];

  /** Sends a message to the connected clients selected in `options.to`, or to all of them if omitted. */
  send: (data: WebSocketMessageData<Schema>, options?: WebSocketInterceptorServerSendOptions<Schema>) => void;
}
