import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorMessageSaving } from './public';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The type of a WebSocket interceptor, either `local` or `remote`.
 */
export type WebSocketInterceptorType = 'local' | 'remote';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The platform a WebSocket interceptor is running on, either `node` or `browser`.
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

/** The options shared by local and remote WebSocket interceptors. */
export interface SharedWebSocketInterceptorOptions {
  /** The type of the interceptor, either `local` or `remote`. Defaults to `local`. */
  type?: WebSocketInterceptorType;

  /**
   * The URL matched by the interceptor. Any connection whose URL starts with this base URL is intercepted. For remote
   * interceptors, it should point to an {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  baseURL: string;

  /** Configures if intercepted messages are saved and how they are handled. */
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
 * The options to create a local WebSocket interceptor.
 */
export interface LocalWebSocketInterceptorOptions extends SharedWebSocketInterceptorOptions {
  type?: 'local';
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The options to authenticate a remote interceptor when connecting to an
 * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 */
export interface WebSocketInterceptorAuthOptions {
  /** The authentication token to use. */
  token: string;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The options to create a remote WebSocket interceptor.
 */
export interface RemoteWebSocketInterceptorOptions extends SharedWebSocketInterceptorOptions {
  type: 'remote';

  /**
   * The options to authenticate the interceptor when connecting to an interceptor server. Required if the server was
   * started with the `--tokens-dir` option.
   */
  auth?: WebSocketInterceptorAuthOptions;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The options to create a WebSocket interceptor.
 */
export type WebSocketInterceptorOptions = LocalWebSocketInterceptorOptions | RemoteWebSocketInterceptorOptions;
