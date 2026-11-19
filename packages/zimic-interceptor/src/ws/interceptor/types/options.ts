import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketMessageSchema, WebSocketSchema, WebSocketSchemaMessage } from '@zimic/ws';

import type { ReceivedWebSocketMessageData } from './messages';
import type { WebSocketInterceptorProtocol } from './protocol';
import { WebSocketInterceptorConnectionSaving, WebSocketInterceptorMessageSaving } from './public';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptortype `interceptor.type` API reference}
 */
export type WebSocketInterceptorType = 'local' | 'remote';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorplatform `interceptor.platform` API reference}
 */
export type WebSocketInterceptorPlatform = 'node' | 'browser';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/unhandled-messages Unhandled messages}
 */
export namespace UnhandledMessageStrategy {
  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/unhandled-messages Unhandled messages} */
  export interface Declaration {
    /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/unhandled-messages Unhandled messages} */
    log?: boolean;
  }

  // Generic over the message, not the schema. TypeScript does not relate the messages of two schemas by variance, so a
  // schema parameter would reject a factory of the default schema on an interceptor with a declared schema.
  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/unhandled-messages Unhandled messages} */
  export type DeclarationFactory<Message extends WebSocketMessageSchema = WebSocketMessageSchema> = (
    message: ReceivedWebSocketMessageData<Message>,
  ) => PossiblePromise<Declaration>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/unhandled-messages Unhandled messages}
 */
export type UnhandledMessageStrategy<Schema extends WebSocketSchema = WebSocketSchema> =
  UnhandledMessageStrategy.Declaration | UnhandledMessageStrategy.DeclarationFactory<WebSocketSchemaMessage<Schema>>;

/** @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference} */
export interface SharedWebSocketInterceptorOptions<Schema extends WebSocketSchema = WebSocketSchema> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference} */
  type?: WebSocketInterceptorType;

  /** @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference} */
  baseURL: string;

  /** @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference} */
  messageSaving?: Partial<WebSocketInterceptorMessageSaving>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference} */
  connectionSaving?: Partial<WebSocketInterceptorConnectionSaving>;

  /**
   * Serves a protocol, such as Socket.IO, on its own transports, opening the clients whose messages handlers receive.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference}
   * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io Mocking Socket.IO servers}
   */
  protocol?: WebSocketInterceptorProtocol<WebSocketSchemaMessage<Schema>>;

  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/unhandled-messages Unhandled messages} */
  onUnhandledMessage?: UnhandledMessageStrategy<Schema>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/local-interceptors#creating-a-local-websocket-interceptor Creating a local WebSocket interceptor}
 * @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference}
 */
export interface LocalWebSocketInterceptorOptions<
  Schema extends WebSocketSchema = WebSocketSchema,
> extends SharedWebSocketInterceptorOptions<Schema> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference} */
  type?: 'local';
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/remote-interceptors#interceptor-server-authentication Interceptor server authentication}
 */
export interface WebSocketInterceptorAuthOptions {
  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/remote-interceptors#interceptor-server-authentication Interceptor server authentication} */
  token: string;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/remote-interceptors#creating-a-remote-websocket-interceptor Creating a remote WebSocket interceptor}
 * @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference}
 */
export interface RemoteWebSocketInterceptorOptions<
  Schema extends WebSocketSchema = WebSocketSchema,
> extends SharedWebSocketInterceptorOptions<Schema> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference} */
  type: 'remote';

  /** @see {@link https://zimic.dev/docs/interceptor/guides/ws/remote-interceptors#interceptor-server-authentication Interceptor server authentication} */
  auth?: WebSocketInterceptorAuthOptions;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference}
 */
export type WebSocketInterceptorOptions<Schema extends WebSocketSchema = WebSocketSchema> =
  LocalWebSocketInterceptorOptions<Schema> | RemoteWebSocketInterceptorOptions<Schema>;
