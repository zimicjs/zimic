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

  /** The message data, as matched by the handler. Binary messages arrive as `ArrayBuffer`. */
  data: ReceivedWebSocketMessageData<MessageSchema>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclients `interceptor.clients` API reference}
 */
export interface WebSocketInterceptorClient<Schema extends WebSocketSchema> {
  /** Marks this handle as a client, distinguishing it from {@link WebSocketInterceptorServer server handles}. */
  readonly [webSocketInterceptorClientRole]: true;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclients `interceptor.clients` API reference}
   */
  readonly url: string;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclients `interceptor.clients` API reference}
   */
  readonly messages: readonly InterceptedWebSocketInterceptorMessage<Schema>[];

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclients `interceptor.clients` API reference} */
  send: (data: WebSocketMessageData<Schema>) => void;
}

/** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference} */
export interface WebSocketInterceptorServerSendOptions<Schema extends WebSocketSchema> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference} */
  to?: WebSocketInterceptorClient<Schema> | readonly WebSocketInterceptorClient<Schema>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
 */
export interface WebSocketInterceptorServer<Schema extends WebSocketSchema> {
  /** Marks this handle as a server, distinguishing it from {@link WebSocketInterceptorClient client handles}. */
  readonly [webSocketInterceptorServerRole]: true;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
   */
  readonly url: string;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
   */
  readonly messages: readonly InterceptedWebSocketInterceptorMessage<Schema>[];

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference} */
  send: (data: WebSocketMessageData<Schema>, options?: WebSocketInterceptorServerSendOptions<Schema>) => void;
}
