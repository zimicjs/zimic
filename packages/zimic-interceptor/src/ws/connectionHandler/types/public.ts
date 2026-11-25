import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorClient, WebSocketInterceptorConnectionRequest } from '@/ws/interceptor/types/messages';

import WebSocketConnectionHandlerImplementation from '../WebSocketConnectionHandlerImplementation';
import { WebSocketConnectionHandlerDelayFactory } from './connections';
import { WebSocketConnectionHandlerRestriction } from './restrictions';

export interface InternalWebSocketConnectionHandler<Schema extends WebSocketSchema, Path extends string = string> {
  implementation: WebSocketConnectionHandlerImplementation<Schema, Path>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlereffect `handler.effect()` API reference}
 */
export type WebSocketConnectionHandlerConnectionCallback<
  Schema extends WebSocketSchema,
  Path extends string = string,
> = (
  client: WebSocketInterceptorClient<Schema, Path>,
  request: WebSocketInterceptorConnectionRequest<Schema, Path>,
) => PossiblePromise<void>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference}
 */
export interface WebSocketConnectionHandlerResponseStaticDeclaration {
  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference} */
  action: 'accept' | 'reject';
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference}
 */
export type WebSocketConnectionHandlerResponseComputedDeclaration<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> = (
  request: WebSocketInterceptorConnectionRequest<Schema, Path>,
) => PossiblePromise<WebSocketConnectionHandlerResponseStaticDeclaration>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference}
 */
export type WebSocketConnectionHandlerResponseDeclaration<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> =
  | WebSocketConnectionHandlerResponseStaticDeclaration
  | WebSocketConnectionHandlerResponseComputedDeclaration<Schema, Path>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler `WebSocketConnectionHandler` API reference}
 */
export interface LocalWebSocketConnectionHandler<Schema extends WebSocketSchema, Path extends string = string> {
  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlertype `handler.type` API reference}
   */
  get type(): 'local';

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerpath `handler.path` API reference}
   */
  get path(): Path | undefined;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference} */
  with: (restriction: WebSocketConnectionHandlerRestriction<Schema, Path>) => this;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerdelay `handler.delay()` API reference} */
  delay: ((milliseconds: number | WebSocketConnectionHandlerDelayFactory<Schema, Path>) => this) &
    ((minMilliseconds: number, maxMilliseconds: number) => this);

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlereffect `handler.effect()` API reference} */
  effect: (callback: WebSocketConnectionHandlerConnectionCallback<Schema, Path>) => this;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference} */
  respond: (declaration: WebSocketConnectionHandlerResponseDeclaration<Schema, Path>) => this;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlertimes `handler.times()` API reference} */
  times: ((numberOfConnections: number) => this) &
    ((minNumberOfConnections: number, maxNumberOfConnections: number) => this);

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerchecktimes `handler.checkTimes()` API reference} */
  checkTimes: () => void;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerclear `handler.clear()` API reference} */
  clear: () => this;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerconnections `handler.connections` API reference}
   */
  get connections(): readonly WebSocketInterceptorConnectionRequest<Schema, Path>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler `WebSocketConnectionHandler` API reference}
 */
export interface SyncedRemoteWebSocketConnectionHandler<Schema extends WebSocketSchema, Path extends string = string> {
  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlertype `handler.type` API reference}
   */
  get type(): 'remote';

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerpath `handler.path` API reference}
   */
  get path(): Path | undefined;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference} */
  with: (
    restriction: WebSocketConnectionHandlerRestriction<Schema, Path>,
  ) => PendingRemoteWebSocketConnectionHandler<Schema, Path>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerdelay `handler.delay()` API reference} */
  delay: ((
    milliseconds: number | WebSocketConnectionHandlerDelayFactory<Schema, Path>,
  ) => PendingRemoteWebSocketConnectionHandler<Schema, Path>) &
    ((minMilliseconds: number, maxMilliseconds: number) => PendingRemoteWebSocketConnectionHandler<Schema, Path>);

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlereffect `handler.effect()` API reference} */
  effect: (
    callback: WebSocketConnectionHandlerConnectionCallback<Schema, Path>,
  ) => PendingRemoteWebSocketConnectionHandler<Schema, Path>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference} */
  respond: (
    declaration: WebSocketConnectionHandlerResponseDeclaration<Schema, Path>,
  ) => PendingRemoteWebSocketConnectionHandler<Schema, Path>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlertimes `handler.times()` API reference} */
  times: ((numberOfConnections: number) => PendingRemoteWebSocketConnectionHandler<Schema, Path>) &
    ((
      minNumberOfConnections: number,
      maxNumberOfConnections: number,
    ) => PendingRemoteWebSocketConnectionHandler<Schema, Path>);

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerchecktimes `handler.checkTimes()` API reference} */
  checkTimes: () => Promise<void>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerclear `handler.clear()` API reference} */
  clear: () => PendingRemoteWebSocketConnectionHandler<Schema, Path>;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerconnections `handler.connections` API reference}
   */
  get connections(): readonly WebSocketInterceptorConnectionRequest<Schema, Path>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler `WebSocketConnectionHandler` API reference}
 */
export interface PendingRemoteWebSocketConnectionHandler<
  Schema extends WebSocketSchema,
  Path extends string = string,
> extends SyncedRemoteWebSocketConnectionHandler<Schema, Path> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler `WebSocketConnectionHandler` API reference} */
  then: <FulfilledResult = SyncedRemoteWebSocketConnectionHandler<Schema, Path>, RejectedResult = never>(
    onFulfilled?:
      ((handler: SyncedRemoteWebSocketConnectionHandler<Schema, Path>) => PossiblePromise<FulfilledResult>) | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<FulfilledResult | RejectedResult>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler `WebSocketConnectionHandler` API reference} */
  catch: <RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<SyncedRemoteWebSocketConnectionHandler<Schema, Path> | RejectedResult>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler `WebSocketConnectionHandler` API reference} */
  finally: (onFinally?: (() => void) | null) => Promise<SyncedRemoteWebSocketConnectionHandler<Schema, Path>>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler `WebSocketConnectionHandler` API reference}
 */
export type RemoteWebSocketConnectionHandler<
  Schema extends WebSocketSchema,
  Path extends string = string,
> = PendingRemoteWebSocketConnectionHandler<Schema, Path>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler `WebSocketConnectionHandler` API reference}
 */
export type WebSocketConnectionHandler<Schema extends WebSocketSchema, Path extends string = string> =
  LocalWebSocketConnectionHandler<Schema, Path> | RemoteWebSocketConnectionHandler<Schema, Path>;
