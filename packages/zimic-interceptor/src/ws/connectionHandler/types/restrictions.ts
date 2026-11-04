import { HttpSearchParams } from '@zimic/utils/http';
import { PossiblePromise } from '@zimic/utils/types';

import { InterceptedWebSocketInterceptorConnection } from '@/ws/interceptor/types/messages';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A static restriction declared with `handler.with()`. Each declared field must be met.
 */
export interface WebSocketConnectionHandlerStaticRestriction {
  /**
   * The search params of the connection URL. Connections match if their search params contain these, or are equal to
   * them with `exact: true`. Array values declare a search param with multiple values.
   */
  searchParams?: URLSearchParams | Record<string, string | readonly string[]>;

  /**
   * The subprotocols requested by the client. Connections match if they requested all of these, in any order, or
   * exactly these, in the same order, with `exact: true`.
   */
  protocols?: readonly string[];

  /**
   * Whether the search params and subprotocols of connections must be equal to the restriction instead of containing
   * it. Defaults to `false`.
   */
  exact?: boolean;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A computed restriction declared with `handler.with()`, returning whether a connection attempt matches.
 */
export type WebSocketConnectionHandlerComputedRestriction = (
  connection: InterceptedWebSocketInterceptorConnection,
) => PossiblePromise<boolean>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A restriction declared with `handler.with()`, either static or computed.
 */
export type WebSocketConnectionHandlerRestriction =
  WebSocketConnectionHandlerStaticRestriction | WebSocketConnectionHandlerComputedRestriction;

export interface WebSocketConnectionHandlerRestrictionDiff<Value> {
  expected: Value;
  received: Value;
}

export interface WebSocketConnectionHandlerRestrictionDiffs {
  computed?: WebSocketConnectionHandlerRestrictionDiff<boolean>;
  searchParams?: WebSocketConnectionHandlerRestrictionDiff<HttpSearchParams>;
  protocols?: WebSocketConnectionHandlerRestrictionDiff<readonly string[]>;
}

export type WebSocketConnectionHandlerRestrictionMatch =
  { success: true } | { success: false; diff: WebSocketConnectionHandlerRestrictionDiffs };

export interface UnmatchedWebSocketInterceptorConnectionGroup {
  connection: InterceptedWebSocketInterceptorConnection;
  diff: WebSocketConnectionHandlerRestrictionDiffs;
}
