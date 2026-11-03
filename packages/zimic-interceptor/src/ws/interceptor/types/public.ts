import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { LocalWebSocketMessageHandler, RemoteWebSocketMessageHandler } from '@/ws/messageHandler/types/public';

import { WebSocketInterceptorClient, WebSocketInterceptorServer } from './messages';
import { RemoteWebSocketInterceptorOptions, UnhandledMessageStrategy, WebSocketInterceptorPlatform } from './options';

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

/** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptoron `interceptor.on()` API reference} */
export type WebSocketInterceptorConnectionListener<Schema extends WebSocketSchema> = (
  client: WebSocketInterceptorClient<Schema>,
) => void;

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

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptoron `interceptor.on()` API reference} */
  on: (event: 'connection', listener: WebSocketInterceptorConnectionListener<Schema>) => void;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptoroff `interceptor.off()` API reference} */
  off: (event: 'connection', listener: WebSocketInterceptorConnectionListener<Schema>) => void;

  /**
   * Registers a listener that is called only for the next client connection and then removed. Otherwise, it behaves
   * like `interceptor.on()`.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptoron `interceptor.on()` API reference}
   */
  once: (event: 'connection', listener: WebSocketInterceptorConnectionListener<Schema>) => void;

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
  message: () => LocalWebSocketMessageHandler<Schema>;

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
  message: () => RemoteWebSocketMessageHandler<Schema>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorchecktimes `interceptor.checkTimes()` API reference} */
  checkTimes: () => Promise<void>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorclear `interceptor.clear()` API reference} */
  clear: () => Promise<void>;
}
