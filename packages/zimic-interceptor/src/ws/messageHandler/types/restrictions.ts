import { DeepPartial, PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export type WebSocketMessageHandlerStaticRestriction<Schema extends WebSocketSchema> = DeepPartial<Schema>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwith `handler.with()` API reference}
 */
export type WebSocketMessageHandlerComputedRestriction<
  Schema extends WebSocketSchema,
  PredicateSchema extends Schema = Schema,
> = ((message: Schema) => PossiblePromise<boolean>) & ((message: Schema) => message is PredicateSchema);

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export type WebSocketMessageHandlerRestriction<Schema extends WebSocketSchema> =
  | WebSocketMessageHandlerStaticRestriction<Schema>
  | WebSocketMessageHandlerComputedRestriction<Schema>;

export interface WebSocketMessageHandlerRestrictionDiff<Schema extends WebSocketSchema = WebSocketSchema> {
  expected: WebSocketMessageHandlerStaticRestriction<Schema> | true;
  received: Schema | false;
}

export type WebSocketMessageHandlerRestrictionMatch =
  | { success: true }
  | { success: false; diff: WebSocketMessageHandlerRestrictionDiff };

export interface UnmatchedWebSocketInterceptorMessageGroup<Schema extends WebSocketSchema = WebSocketSchema> {
  message: Schema;
  diff: WebSocketMessageHandlerRestrictionDiff<Schema>;
}
