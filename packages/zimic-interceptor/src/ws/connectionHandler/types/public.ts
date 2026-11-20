import { IfNever, PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import {
  WebSocketInterceptorClient,
  WebSocketInterceptorConnectionError,
  WebSocketInterceptorConnectionRequest,
} from '@/ws/interceptor/types/messages';

import WebSocketConnectionHandlerImplementation from '../WebSocketConnectionHandlerImplementation';
import { WebSocketConnectionHandlerDelayFactory } from './connections';
import { WebSocketConnectionHandlerRestriction } from './restrictions';

export interface InternalWebSocketConnectionHandler<Schema extends WebSocketSchema, Path extends string = string> {
  implementation: WebSocketConnectionHandlerImplementation<Schema, Path>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A side effect declared with `handler.effect()`, called with the client and the handshake request of each accepted
 * connection that the handler matches.
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
 * A static handshake response declared with `handler.respond()`, accepting or rejecting matched connections.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference}
 */
export type WebSocketConnectionHandlerResponseStaticDeclaration<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> = WebSocketConnectionHandlerAcceptDeclaration | WebSocketConnectionHandlerRejectDeclaration<Schema, Path>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A static handshake response declared with `handler.respond()` that accepts matched connections.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference}
 */
export interface WebSocketConnectionHandlerAcceptDeclaration {
  /**
   * The action to apply to matched connections, opening them.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference}
   */
  action: 'accept';
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A static handshake response declared with `handler.respond()` that rejects matched connections. `error` exists only
 * if the schema declares it, as in Socket.IO schemas.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference}
 */
export type WebSocketConnectionHandlerRejectDeclaration<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> = IfNever<
  WebSocketInterceptorConnectionError<Schema, Path>,
  BaseWebSocketConnectionHandlerRejectDeclaration,
  BaseWebSocketConnectionHandlerRejectDeclaration & {
    /**
     * The error sent to the rejected Socket.IO client, received as the `message` and `data` of its `connect_error`.
     * Without one, the client receives the message `'Connection rejected'`.
     *
     * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference}
     */
    error?: WebSocketInterceptorConnectionError<Schema, Path>;
  }
>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The members of {@link WebSocketConnectionHandlerRejectDeclaration} present in every schema.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference}
 */
export interface BaseWebSocketConnectionHandlerRejectDeclaration {
  /**
   * The action to apply to matched connections, refusing them before they open.
   *
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference}
   */
  action: 'reject';
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A function declared with `handler.respond()` that computes the handshake response from the handshake request of each
 * matched connection.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference}
 */
export type WebSocketConnectionHandlerResponseComputedDeclaration<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> = (
  request: WebSocketInterceptorConnectionRequest<Schema, Path>,
) => PossiblePromise<WebSocketConnectionHandlerResponseStaticDeclaration<Schema, Path>>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A handshake response declared with `handler.respond()`, either static or computed.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerrespond `handler.respond()` API reference}
 */
export type WebSocketConnectionHandlerResponseDeclaration<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> =
  | WebSocketConnectionHandlerResponseStaticDeclaration<Schema, Path>
  | WebSocketConnectionHandlerResponseComputedDeclaration<Schema, Path>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A local WebSocket connection handler. In a local handler, the mocking operations are synchronous.
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
   * The path declared in `interceptor.connection(path)`, relative to the interceptor base URL. `undefined` if the
   * handler matches every connection to its interceptor.
   *
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
 * A synced remote WebSocket connection handler. When a remote handler is synced, it is guaranteed that all of the
 * mocking operations were committed to the connected
 * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
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
   * The path declared in `interceptor.connection(path)`, relative to the interceptor base URL. `undefined` if the
   * handler matches every connection to its interceptor.
   *
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
 * A pending remote WebSocket connection handler. When a remote handler is pending, it is not guaranteed that all of the
 * mocking operations were committed to the connected
 * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 *
 * To commit a remote handler, you can `await` it or use the methods {@link then handler.then()},
 * {@link catch handler.catch()}, and {@link finally handler.finally()}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler `WebSocketConnectionHandler` API reference}
 */
export interface PendingRemoteWebSocketConnectionHandler<
  Schema extends WebSocketSchema,
  Path extends string = string,
> extends SyncedRemoteWebSocketConnectionHandler<Schema, Path> {
  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  then: <FulfilledResult = SyncedRemoteWebSocketConnectionHandler<Schema, Path>, RejectedResult = never>(
    onFulfilled?:
      ((handler: SyncedRemoteWebSocketConnectionHandler<Schema, Path>) => PossiblePromise<FulfilledResult>) | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<FulfilledResult | RejectedResult>;

  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  catch: <RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<SyncedRemoteWebSocketConnectionHandler<Schema, Path> | RejectedResult>;

  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  finally: (onFinally?: (() => void) | null) => Promise<SyncedRemoteWebSocketConnectionHandler<Schema, Path>>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A remote WebSocket connection handler. In a remote handler, the mocking operations are asynchronous and include
 * remote calls to the connected {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
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
 * A WebSocket connection handler, either local or remote.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler `WebSocketConnectionHandler` API reference}
 */
export type WebSocketConnectionHandler<Schema extends WebSocketSchema, Path extends string = string> =
  LocalWebSocketConnectionHandler<Schema, Path> | RemoteWebSocketConnectionHandler<Schema, Path>;
