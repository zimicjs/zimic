import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { LocalWebSocketMessageHandler, RemoteWebSocketMessageHandler } from '@/ws/messageHandler/types/public';

import { WebSocketInterceptorClient, WebSocketInterceptorServer } from './messages';
import {
  RemoteWebSocketInterceptorOptions,
  WebSocketInterceptorMessageSaving,
  WebSocketInterceptorPlatform,
} from './options';

/** A listener called with the client handle of each new connection to the interceptor. */
export type WebSocketInterceptorConnectionListener<Schema extends WebSocketSchema> = (
  client: WebSocketInterceptorClient<Schema>,
) => void;

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
  get server(): WebSocketInterceptorServer<Schema>;

  /**
   * The currently connected client handles.
   *
   * @readonly
   */
  get clients(): readonly WebSocketInterceptorClient<Schema>[];

  /** Registers a listener for new client connections. */
  on: (event: 'connection', listener: WebSocketInterceptorConnectionListener<Schema>) => void;

  /** Removes a connection listener. Pass the same callback reference used to register it. */
  off: (event: 'connection', listener: WebSocketInterceptorConnectionListener<Schema>) => void;

  /**
   * Registers a listener that is called only for the next client connection and then removed. Otherwise, it behaves
   * like `interceptor.on()`.
   */
  once: (event: 'connection', listener: WebSocketInterceptorConnectionListener<Schema>) => void;

  /** Starts the interceptor, allowing it to intercept WebSocket connections and messages. */
  start: () => Promise<void>;

  /**
   * Stops the interceptor, preventing it from intercepting WebSocket connections and messages. Stopped interceptors are
   * cleared as if `interceptor.clear()` had been called.
   */
  stop: () => Promise<void>;

  /**
   * Checks if all handlers created by this interceptor have matched the number of messages declared with
   * `handler.times()`.
   */
  checkTimes: () => PossiblePromise<void>;

  /**
   * Clears the interceptor and all of its message handlers, including their responses, effects, restrictions, connected
   * clients, and saved messages.
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

  /** Creates a message handler for client-to-server messages. */
  message: () => LocalWebSocketMessageHandler<Schema>;

  /**
   * Checks if all handlers created by this interceptor have matched the number of messages declared with
   * `handler.times()`.
   */
  checkTimes: () => void;

  /**
   * Clears the interceptor and all of its message handlers, including their responses, effects, restrictions, connected
   * clients, and saved messages.
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

  /** Creates a message handler for client-to-server messages. */
  message: () => RemoteWebSocketMessageHandler<Schema>;

  /**
   * Checks if all handlers created by this interceptor have matched the number of messages declared with
   * `handler.times()`.
   */
  checkTimes: () => Promise<void>;

  /**
   * Clears the interceptor and all of its message handlers, including their responses, effects, restrictions, connected
   * clients, and saved messages.
   */
  clear: () => Promise<void>;
}
