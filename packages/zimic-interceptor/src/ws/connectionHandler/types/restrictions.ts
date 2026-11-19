import { HttpSearchParams, HttpSearchParamsSchema } from '@zimic/utils/http';
import { IfNever, PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import {
  WebSocketInterceptorConnectionProtocol,
  WebSocketInterceptorConnectionRequest,
  WebSocketInterceptorConnectionSearchParamsSchema,
} from '@/ws/interceptor/types/messages';

type PartialHttpSearchParamsOrSchema<Schema extends HttpSearchParamsSchema.Loose> = IfNever<
  Schema,
  never,
  Partial<Schema> | HttpSearchParams<Partial<Schema>> | HttpSearchParams<Schema>
>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A static restriction declared with `handler.with()`. Each declared field must be met.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference}
 */
export interface WebSocketConnectionHandlerStaticRestriction<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference} */
  searchParams?: PartialHttpSearchParamsOrSchema<WebSocketInterceptorConnectionSearchParamsSchema<Schema, Path>>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference} */
  protocols?: readonly WebSocketInterceptorConnectionProtocol<Schema, Path>[];

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference} */
  exact?: boolean;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A computed restriction declared with `handler.with()`, returning whether a connection attempt matches.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference}
 */
export type WebSocketConnectionHandlerComputedRestriction<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> = (request: WebSocketInterceptorConnectionRequest<Schema, Path>) => PossiblePromise<boolean>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A restriction declared with `handler.with()`, either static or computed.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerwith `handler.with()` API reference}
 */
export type WebSocketConnectionHandlerRestriction<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> =
  | WebSocketConnectionHandlerStaticRestriction<Schema, Path>
  | WebSocketConnectionHandlerComputedRestriction<Schema, Path>;

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
  request: WebSocketInterceptorConnectionRequest;
  diff: WebSocketConnectionHandlerRestrictionDiffs;
}
