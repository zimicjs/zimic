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
 * Configures if intercepted messages are saved and how they are handled.
 */
export interface WebSocketInterceptorMessageSaving {
  /**
   * Whether message handlers should save their matched client-to-server messages in memory and make them accessible
   * through `handler.messages`. Defaults to `process.env.NODE_ENV === 'test'` in Node.js and `false` in browsers.
   */
  enabled: boolean;

  /**
   * The number of saved messages after which the interceptor logs warnings in the console. It does not limit how many
   * messages are saved. Defaults to `1000`.
   */
  safeLimit: number;
}

/** The options shared by local and remote WebSocket interceptors. */
export interface SharedWebSocketInterceptorOptions {
  /** The type of the interceptor, either `local` or `remote`. Defaults to `local`. */
  type?: WebSocketInterceptorType;

  /**
   * The URL matched by the interceptor. For remote interceptors, it should point to an
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  baseURL: string;

  /** Configures if intercepted messages are saved and how they are handled. */
  messageSaving?: Partial<WebSocketInterceptorMessageSaving>;
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
