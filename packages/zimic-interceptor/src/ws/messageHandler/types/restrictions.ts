import { DeepPartial, PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export type WebSocketMessageHandlerStaticRestriction<Schema extends WebSocketSchema> = DeepPartial<Schema>;

type WebSocketMessageHandlerComputedBooleanRestriction<Schema extends WebSocketSchema> = (
  message: Schema,
) => PossiblePromise<boolean>;

export type WebSocketMessageHandlerComputedTypeGuardRestriction<
  Schema extends WebSocketSchema,
  PredicateSchema extends Schema = Schema,
> = (message: Schema) => message is PredicateSchema;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference}
 */
export type WebSocketMessageHandlerComputedRestriction<
  Schema extends WebSocketSchema,
  PredicateSchema extends Schema = Schema,
> =
  | WebSocketMessageHandlerComputedBooleanRestriction<Schema>
  | WebSocketMessageHandlerComputedTypeGuardRestriction<Schema, PredicateSchema>;

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export type WebSocketMessageHandlerRestriction<Schema extends WebSocketSchema> =
  | WebSocketMessageHandlerStaticRestriction<Schema>
  | WebSocketMessageHandlerComputedRestriction<Schema>;

export interface WebSocketMessageHandlerRestrictionDiff<Value> {
  expected: Value;
  received: Value;
}

export interface WebSocketMessageHandlerRestrictionDiffs<Schema extends WebSocketSchema = WebSocketSchema> {
  sender?: WebSocketMessageHandlerRestrictionDiff<boolean>;
  computed?: WebSocketMessageHandlerRestrictionDiff<boolean>;
  data?: WebSocketMessageHandlerRestrictionDiff<WebSocketMessageHandlerStaticRestriction<Schema> | Schema>;
}

export type WebSocketMessageHandlerRestrictionMatch<Schema extends WebSocketSchema = WebSocketSchema> =
  | { success: true; message: Schema }
  | { success: false; diff: WebSocketMessageHandlerRestrictionDiffs<Schema> };

export interface UnmatchedWebSocketInterceptorMessageGroup<Schema extends WebSocketSchema = WebSocketSchema> {
  message: Schema;
  diff: WebSocketMessageHandlerRestrictionDiffs<Schema>;
}
