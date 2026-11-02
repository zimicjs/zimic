import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorMessageSaving } from './public';

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
 * The strategy applied to client messages that no handler matches, either a static declaration or a factory returning
 * one for each message. Unhandled messages are logged by default and do not close the connection.
 */
export namespace UnhandledMessageStrategy {
  /** A strategy declaration for an unhandled client message. */
  export interface Declaration {
    /** Whether to log a warning with the unhandled message. Defaults to `true`. */
    log?: boolean;
  }

  /**
   * A function that receives the data of an unhandled client message and returns the strategy declaration to apply to
   * it. If it throws, the error is logged and the default declaration is applied.
   */
  export type DeclarationFactory = (message: WebSocketSchema) => PossiblePromise<Declaration>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The strategy applied to client messages that no handler matches, either a static declaration or a factory returning
 * one for each message. Unhandled messages are logged by default and do not close the connection.
 */
export type UnhandledMessageStrategy =
  UnhandledMessageStrategy.Declaration | UnhandledMessageStrategy.DeclarationFactory;

/** @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference} */
export interface SharedWebSocketInterceptorOptions {
  /** @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference} */
  type?: WebSocketInterceptorType;

  /** @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference} */
  baseURL: string;

  /** @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference} */
  messageSaving?: Partial<WebSocketInterceptorMessageSaving>;

  /**
   * The strategy applied to client messages that no handler matches. Defaults to logging a warning for each unhandled
   * message.
   */
  onUnhandledMessage?: UnhandledMessageStrategy;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/local-interceptors#creating-a-local-websocket-interceptor Creating a local WebSocket interceptor}
 * @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference}
 */
export interface LocalWebSocketInterceptorOptions extends SharedWebSocketInterceptorOptions {
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
export interface RemoteWebSocketInterceptorOptions extends SharedWebSocketInterceptorOptions {
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
export type WebSocketInterceptorOptions = LocalWebSocketInterceptorOptions | RemoteWebSocketInterceptorOptions;
