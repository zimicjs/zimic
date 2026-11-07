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
 * A side effect declared with `handler.effect()`, called with the client handle and the handshake request of each
 * matched connection that is accepted. Rejected connections have no client, so they run no effects.
 */
export type WebSocketConnectionHandlerConnectionCallback<
  Schema extends WebSocketSchema,
  Path extends string = string,
> = (
  client: WebSocketInterceptorClient<Schema>,
  request: WebSocketInterceptorConnectionRequest<Path>,
) => PossiblePromise<void>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A handshake response declared with `handler.respond()`. The `accept` action opens matched connections. The `reject`
 * action refuses them before they open, so clients receive an `error` event and a `close` event with code 1006.
 */
export interface WebSocketConnectionHandlerResponseDeclaration {
  /** The action to apply to matched connections. */
  action: 'accept' | 'reject';
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A function declared with `handler.respond()` that computes the handshake response from the handshake request of each
 * matched connection.
 */
export type WebSocketConnectionHandlerResponseComputedDeclaration<Path extends string = string> = (
  request: WebSocketInterceptorConnectionRequest<Path>,
) => PossiblePromise<WebSocketConnectionHandlerResponseDeclaration>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A local WebSocket connection handler. In a local handler, the mocking operations are synchronous.
 */
export interface LocalWebSocketConnectionHandler<Schema extends WebSocketSchema, Path extends string = string> {
  /**
   * The type of the handler.
   *
   * @readonly
   */
  get type(): 'local';

  /**
   * The path declared in `interceptor.connection(path)`, relative to the interceptor base URL. `undefined` if the
   * handler matches every connection to its interceptor.
   *
   * @readonly
   */
  get path(): string | undefined;

  /**
   * Declares a restriction to intercepted connection matches. If multiple restrictions are declared, all of them must
   * be met.
   */
  with: (restriction: WebSocketConnectionHandlerRestriction<Path>) => this;

  /** Declares a delay to wait before answering the handshake of matched connections. */
  delay: ((milliseconds: number | WebSocketConnectionHandlerDelayFactory<Path>) => this) &
    ((minMilliseconds: number, maxMilliseconds: number) => this);

  /** Declares a side effect to run when the handler matches a connection that is accepted. */
  effect: (callback: WebSocketConnectionHandlerConnectionCallback<Schema, Path>) => this;

  /**
   * Declares a handshake response for matched connections. Matched connections are accepted if the handler declares no
   * response.
   */
  respond: (
    declaration:
      WebSocketConnectionHandlerResponseDeclaration | WebSocketConnectionHandlerResponseComputedDeclaration<Path>,
  ) => this;

  /** Declares a number of intercepted connections that the handler will be able to match. */
  times: ((numberOfConnections: number) => this) &
    ((minNumberOfConnections: number, maxNumberOfConnections: number) => this);

  /** Checks if the handler has matched the expected number of connections declared with `handler.times()`. */
  checkTimes: () => void;

  /**
   * Clears the declared responses, effects, restrictions, connection count limits, and saved connections of the
   * handler.
   */
  clear: () => this;

  /**
   * The connection attempts that matched this handler, whether accepted or rejected. Requires connection saving to be
   * enabled.
   *
   * @readonly
   */
  get connections(): readonly WebSocketInterceptorConnectionRequest<Path>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A synced remote WebSocket connection handler. When a remote handler is synced, it is guaranteed that all of the
 * mocking operations were committed to the connected
 * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 */
export interface SyncedRemoteWebSocketConnectionHandler<Schema extends WebSocketSchema, Path extends string = string> {
  /**
   * The type of the handler.
   *
   * @readonly
   */
  get type(): 'remote';

  /**
   * The path declared in `interceptor.connection(path)`, relative to the interceptor base URL. `undefined` if the
   * handler matches every connection to its interceptor.
   *
   * @readonly
   */
  get path(): string | undefined;

  /**
   * Declares a restriction to intercepted connection matches. If multiple restrictions are declared, all of them must
   * be met.
   */
  with: (
    restriction: WebSocketConnectionHandlerRestriction<Path>,
  ) => PendingRemoteWebSocketConnectionHandler<Schema, Path>;

  /** Declares a delay to wait before answering the handshake of matched connections. */
  delay: ((
    milliseconds: number | WebSocketConnectionHandlerDelayFactory<Path>,
  ) => PendingRemoteWebSocketConnectionHandler<Schema, Path>) &
    ((minMilliseconds: number, maxMilliseconds: number) => PendingRemoteWebSocketConnectionHandler<Schema, Path>);

  /** Declares a side effect to run when the handler matches a connection that is accepted. */
  effect: (
    callback: WebSocketConnectionHandlerConnectionCallback<Schema, Path>,
  ) => PendingRemoteWebSocketConnectionHandler<Schema, Path>;

  /**
   * Declares a handshake response for matched connections. Matched connections are accepted if the handler declares no
   * response.
   */
  respond: (
    declaration:
      WebSocketConnectionHandlerResponseDeclaration | WebSocketConnectionHandlerResponseComputedDeclaration<Path>,
  ) => PendingRemoteWebSocketConnectionHandler<Schema, Path>;

  /** Declares a number of intercepted connections that the handler will be able to match. */
  times: ((numberOfConnections: number) => PendingRemoteWebSocketConnectionHandler<Schema, Path>) &
    ((
      minNumberOfConnections: number,
      maxNumberOfConnections: number,
    ) => PendingRemoteWebSocketConnectionHandler<Schema, Path>);

  /** Checks if the handler has matched the expected number of connections declared with `handler.times()`. */
  checkTimes: () => Promise<void>;

  /**
   * Clears the declared responses, effects, restrictions, connection count limits, and saved connections of the
   * handler.
   */
  clear: () => PendingRemoteWebSocketConnectionHandler<Schema, Path>;

  /**
   * The connection attempts that matched this handler, whether accepted or rejected. Requires connection saving to be
   * enabled.
   *
   * @readonly
   */
  get connections(): readonly WebSocketInterceptorConnectionRequest<Path>[];
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
 */
export type RemoteWebSocketConnectionHandler<
  Schema extends WebSocketSchema,
  Path extends string = string,
> = PendingRemoteWebSocketConnectionHandler<Schema, Path>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A WebSocket connection handler, either local or remote.
 */
export type WebSocketConnectionHandler<Schema extends WebSocketSchema, Path extends string = string> =
  LocalWebSocketConnectionHandler<Schema, Path> | RemoteWebSocketConnectionHandler<Schema, Path>;
