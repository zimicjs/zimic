import { DeepPartial, PossiblePromise } from '@zimic/utils/types';
import { WebSocketMessageSchema } from '@zimic/ws';

import { ReceivedWebSocketMessageData, UnparsedWebSocketJSONPrimitive } from '@/ws/interceptor/types/messages';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A static restriction declared with `handler.with()`. JSON restrictions match messages that contain their partial data
 * and text restrictions match text messages that include them, without matching messages parsed as JSON objects or
 * arrays. Binary members accept only whole binary values of any kind, compared byte by byte. A text restriction must be
 * assignable to a string, number, or boolean member as received, such as `'ping'` or `'42'`, as HTTP text bodies must.
 * Use a computed restriction to match partial text of a member with a literal type.
 */
export type WebSocketMessageHandlerStaticRestriction<Schema extends WebSocketMessageSchema> = Schema extends
  Blob | BufferSource
  ? Blob | BufferSource
  : Schema extends UnparsedWebSocketJSONPrimitive | string
    ? ReceivedWebSocketMessageData<Schema>
    : DeepPartial<Schema>;

// Unlike HTTP, where `exact` is a field of the static restriction, a WebSocket static restriction is the partial
// message itself, so a field would be ambiguous with message data.
/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The options of a static restriction declared with `handler.with()`.
 */
export interface WebSocketMessageHandlerStaticRestrictionOptions {
  /**
   * Whether JSON and text messages must be equal to the restriction instead of containing or including it. Defaults to
   * `false`. Binary restrictions always require messages with the same bytes.
   */
  exact?: boolean;
}

/** A predicate returning whether a message matches. It does not narrow the handler's message type. */
type WebSocketMessageHandlerComputedBooleanRestriction<Schema extends WebSocketMessageSchema> = (
  message: ReceivedWebSocketMessageData<Schema>,
) => PossiblePromise<boolean>;

/** A type guard returning whether a message matches. It narrows the handler's message type to its predicate. */
export type WebSocketMessageHandlerComputedTypeGuardRestriction<
  Schema extends WebSocketMessageSchema,
  PredicateSchema extends ReceivedWebSocketMessageData<Schema> = ReceivedWebSocketMessageData<Schema>,
> = (message: ReceivedWebSocketMessageData<Schema>) => message is PredicateSchema;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A computed restriction declared with `handler.with()`, either a predicate or a type guard. Binary messages arrive as
 * `ArrayBuffer`.
 */
export type WebSocketMessageHandlerComputedRestriction<
  Schema extends WebSocketMessageSchema,
  PredicateSchema extends ReceivedWebSocketMessageData<Schema> = ReceivedWebSocketMessageData<Schema>,
> =
  | WebSocketMessageHandlerComputedBooleanRestriction<Schema>
  | WebSocketMessageHandlerComputedTypeGuardRestriction<Schema, PredicateSchema>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A restriction declared with `handler.with()`, either static or computed.
 */
export type WebSocketMessageHandlerRestriction<Schema extends WebSocketMessageSchema> =
  WebSocketMessageHandlerStaticRestriction<Schema> | WebSocketMessageHandlerComputedRestriction<Schema>;

/** The arguments accepted by `handler.with()` after a restriction. Only static restrictions accept options. */
export type WebSocketMessageHandlerRestrictionOptionsArguments<Schema extends WebSocketMessageSchema, Restriction> =
  Restriction extends WebSocketMessageHandlerComputedRestriction<Schema>
    ? []
    : [options?: WebSocketMessageHandlerStaticRestrictionOptions];

export interface WebSocketMessageHandlerRestrictionDiff<Value> {
  expected: Value;
  received: Value;
}

export interface WebSocketMessageHandlerRestrictionDiffs<
  Schema extends WebSocketMessageSchema = WebSocketMessageSchema,
> {
  sender?: WebSocketMessageHandlerRestrictionDiff<boolean>;
  computed?: WebSocketMessageHandlerRestrictionDiff<boolean>;
  data?: WebSocketMessageHandlerRestrictionDiff<
    WebSocketMessageHandlerStaticRestriction<Schema> | ReceivedWebSocketMessageData<Schema>
  >;
}

export type WebSocketMessageHandlerRestrictionMatch<Schema extends WebSocketMessageSchema = WebSocketMessageSchema> =
  { success: true } | { success: false; diff: WebSocketMessageHandlerRestrictionDiffs<Schema> };

export interface UnmatchedWebSocketInterceptorMessageGroup<
  Schema extends WebSocketMessageSchema = WebSocketMessageSchema,
> {
  message: ReceivedWebSocketMessageData<Schema>;
  diff: WebSocketMessageHandlerRestrictionDiffs<Schema>;
}
