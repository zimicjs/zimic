import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema, WebSocketSchemaMessage, WebSocketSchemaPath } from '@zimic/ws';

import { LocalWebSocketConnectionHandler, RemoteWebSocketConnectionHandler } from '@/ws/connectionHandler/types/public';
import { LocalWebSocketMessageHandler, RemoteWebSocketMessageHandler } from '@/ws/messageHandler/types/public';

import { WebSocketInterceptorClient, WebSocketInterceptorServer } from './messages';
import { RemoteWebSocketInterceptorOptions, UnhandledMessageStrategy, WebSocketInterceptorPlatform } from './options';
import { WebSocketInterceptorHandlerPath, WebSocketInterceptorPathMessage } from './schema';

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

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Configures if intercepted connections are saved and how they are handled.
 */
export interface WebSocketInterceptorConnectionSaving {
  /**
   * Whether connection handlers should save their matched connection attempts in memory and make them accessible
   * through `handler.connections`. Defaults to `process.env.NODE_ENV === 'test'` in Node.js and `false` in browsers.
   */
  enabled: boolean;

  /**
   * The number of saved connections after which the interceptor logs warnings in the console. It does not limit how
   * many connections are saved. Defaults to `1000`.
   */
  safeLimit: number;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * An interceptor that handles WebSocket connections and client-to-server messages to its base URL.
 */
export interface WebSocketInterceptor<Schema extends WebSocketSchema> {
  /** The base URL used by the interceptor. Running interceptors reject changes to it. */
  baseURL: string;

  /** Configures if intercepted messages are saved and how they are handled. */
  messageSaving: WebSocketInterceptorMessageSaving;

  /** Configures if intercepted connections are saved and how they are handled. */
  connectionSaving: WebSocketInterceptorConnectionSaving;

  /**
   * The strategy applied to client messages that no handler matches. Defaults to logging a warning for each unhandled
   * message.
   */
  onUnhandledMessage?: UnhandledMessageStrategy;

  /**
   * The platform the interceptor is running on. `null` if the interceptor is not running.
   *
   * @readonly
   */
  get platform(): WebSocketInterceptorPlatform | null;

  /**
   * Whether the interceptor is currently running and ready to use.
   *
   * @readonly
   */
  get isRunning(): boolean;

  /**
   * A synthetic server handle that can send messages to currently connected clients.
   *
   * @readonly
   */
  get server(): WebSocketInterceptorServer<WebSocketSchemaMessage<Schema>>;

  /**
   * The currently connected client handles.
   *
   * @readonly
   */
  get clients(): readonly WebSocketInterceptorClient<WebSocketSchemaMessage<Schema>>[];

  /** Starts the interceptor, allowing it to intercept WebSocket connections and messages. */
  start: () => Promise<void>;

  /**
   * Stops the interceptor, preventing it from intercepting WebSocket connections and messages. Stopped interceptors are
   * cleared as if `interceptor.clear()` had been called.
   */
  stop: () => Promise<void>;

  /**
   * Checks if all handlers created by this interceptor have matched the number of messages or connections declared with
   * `handler.times()`.
   */
  checkTimes: () => PossiblePromise<void>;

  /**
   * Clears the interceptor and all of its message and connection handlers, including their responses, effects,
   * restrictions, connected clients, and saved messages and connections.
   */
  clear: () => PossiblePromise<void>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A local WebSocket interceptor. Its mocking operations are synchronous.
 */
export interface LocalWebSocketInterceptor<Schema extends WebSocketSchema> extends WebSocketInterceptor<Schema> {
  /**
   * The type of the interceptor.
   *
   * @readonly
   */
  get type(): 'local';

  /**
   * Creates a message handler for client-to-server messages.
   *
   * @param path The path of the connections whose messages to match, relative to the base URL of the interceptor, such
   *   as `/rooms/:roomId`. If omitted, the handler matches the messages of every connection and is typed with the
   *   messages of all paths.
   */
  message: <Path extends WebSocketSchemaPath.NonLiteral<Schema> = never>(
    path?: Path,
  ) => LocalWebSocketMessageHandler<
    WebSocketInterceptorPathMessage<Schema, WebSocketInterceptorHandlerPath<Schema, Path>>
  >;

  /**
   * Creates a connection handler for connection attempts to the interceptor, which can accept or reject them before
   * they open.
   *
   * @param path The path of the connections to match, relative to the base URL of the interceptor, such as
   *   `/rooms/:roomId`. If omitted, the handler matches every connection to the interceptor.
   */
  connection: <Path extends WebSocketSchemaPath.NonLiteral<Schema> = never>(
    path?: Path,
  ) => LocalWebSocketConnectionHandler<Schema, WebSocketInterceptorHandlerPath<Schema, Path>>;

  /**
   * Checks if all handlers created by this interceptor have matched the number of messages or connections declared with
   * `handler.times()`.
   */
  checkTimes: () => void;

  /**
   * Clears the interceptor and all of its message and connection handlers, including their responses, effects,
   * restrictions, connected clients, and saved messages and connections.
   */
  clear: () => void;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A remote WebSocket interceptor. Its mocking operations are asynchronous and include remote calls to the connected
 * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 */
export interface RemoteWebSocketInterceptor<Schema extends WebSocketSchema> extends WebSocketInterceptor<Schema> {
  /**
   * The type of the interceptor.
   *
   * @readonly
   */
  get type(): 'remote';

  /** The options used to authenticate the interceptor when connecting to an interceptor server. */
  auth?: RemoteWebSocketInterceptorOptions['auth'];

  /**
   * Creates a message handler for client-to-server messages.
   *
   * @param path The path of the connections whose messages to match, relative to the base URL of the interceptor, such
   *   as `/rooms/:roomId`. If omitted, the handler matches the messages of every connection and is typed with the
   *   messages of all paths.
   */
  message: <Path extends WebSocketSchemaPath.NonLiteral<Schema> = never>(
    path?: Path,
  ) => RemoteWebSocketMessageHandler<
    WebSocketInterceptorPathMessage<Schema, WebSocketInterceptorHandlerPath<Schema, Path>>
  >;

  /**
   * Creates a connection handler for connection attempts to the interceptor, which can accept or reject them before
   * they open.
   *
   * @param path The path of the connections to match, relative to the base URL of the interceptor, such as
   *   `/rooms/:roomId`. If omitted, the handler matches every connection to the interceptor.
   */
  connection: <Path extends WebSocketSchemaPath.NonLiteral<Schema> = never>(
    path?: Path,
  ) => RemoteWebSocketConnectionHandler<Schema, WebSocketInterceptorHandlerPath<Schema, Path>>;

  /**
   * Checks if all handlers created by this interceptor have matched the number of messages or connections declared with
   * `handler.times()`.
   */
  checkTimes: () => Promise<void>;

  /**
   * Clears the interceptor and all of its message and connection handlers, including their responses, effects,
   * restrictions, connected clients, and saved messages and connections.
   */
  clear: () => Promise<void>;
}
