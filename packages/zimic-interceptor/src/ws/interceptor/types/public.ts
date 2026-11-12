import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema, WebSocketSchemaPath } from '@zimic/ws';

import { LocalWebSocketConnectionHandler, RemoteWebSocketConnectionHandler } from '@/ws/connectionHandler/types/public';
import { LocalWebSocketMessageHandler, RemoteWebSocketMessageHandler } from '@/ws/messageHandler/types/public';

import { WebSocketInterceptorClient, WebSocketInterceptorServer } from './messages';
import { RemoteWebSocketInterceptorOptions, UnhandledMessageStrategy, WebSocketInterceptorPlatform } from './options';
import { WebSocketInterceptorHandlerPath } from './schema';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptormessagesaving `interceptor.messageSaving` API reference}
 */
export interface WebSocketInterceptorMessageSaving {
  /** @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference} */
  enabled: boolean;

  /** @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference} */
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
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor `WebSocketInterceptor` API reference}
 */
export interface WebSocketInterceptor<Schema extends WebSocketSchema> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorbaseurl `interceptor.baseURL` API reference} */
  baseURL: string;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptormessagesaving `interceptor.messageSaving` API reference} */
  messageSaving: WebSocketInterceptorMessageSaving;

  /** Configures if intercepted connections are saved and how they are handled. */
  connectionSaving: WebSocketInterceptorConnectionSaving;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptoronunhandledmessage `interceptor.onUnhandledMessage` API reference} */
  onUnhandledMessage?: UnhandledMessageStrategy;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorplatform `interceptor.platform` API reference}
   */
  get platform(): WebSocketInterceptorPlatform | null;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorisrunning `interceptor.isRunning` API reference}
   */
  get isRunning(): boolean;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorserver `interceptor.server` API reference}
   */
  get server(): WebSocketInterceptorServer<Schema>;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclients `interceptor.clients` API reference}
   */
  get clients(): readonly WebSocketInterceptorClient<Schema>[];

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorstart `interceptor.start()` API reference} */
  start: () => Promise<void>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorstop `interceptor.stop()` API reference} */
  stop: () => Promise<void>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorchecktimes `interceptor.checkTimes()` API reference} */
  checkTimes: () => PossiblePromise<void>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclear `interceptor.clear()` API reference} */
  clear: () => PossiblePromise<void>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor `WebSocketInterceptor` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/local-interceptors Using local WebSocket interceptors}
 */
export interface LocalWebSocketInterceptor<Schema extends WebSocketSchema> extends WebSocketInterceptor<Schema> {
  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptortype `interceptor.type` API reference}
   */
  get type(): 'local';

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptormessage `interceptor.message()` API reference} */
  message: <Path extends WebSocketSchemaPath.NonLiteral<Schema> = never>(
    path?: Path,
  ) => LocalWebSocketMessageHandler<Schema, WebSocketInterceptorHandlerPath<Schema, Path>>;

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

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorchecktimes `interceptor.checkTimes()` API reference} */
  checkTimes: () => void;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclear `interceptor.clear()` API reference} */
  clear: () => void;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor `WebSocketInterceptor` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/remote-interceptors Using remote WebSocket interceptors}
 */
export interface RemoteWebSocketInterceptor<Schema extends WebSocketSchema> extends WebSocketInterceptor<Schema> {
  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptortype `interceptor.type` API reference}
   */
  get type(): 'remote';

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorauth `interceptor.auth` API reference} */
  auth?: RemoteWebSocketInterceptorOptions['auth'];

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptormessage `interceptor.message()` API reference} */
  message: <Path extends WebSocketSchemaPath.NonLiteral<Schema> = never>(
    path?: Path,
  ) => RemoteWebSocketMessageHandler<Schema, WebSocketInterceptorHandlerPath<Schema, Path>>;

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

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorchecktimes `interceptor.checkTimes()` API reference} */
  checkTimes: () => Promise<void>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclear `interceptor.clear()` API reference} */
  clear: () => Promise<void>;
}
