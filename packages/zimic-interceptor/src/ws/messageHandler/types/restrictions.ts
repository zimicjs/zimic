import { DeepPartial, PossiblePromise } from '@zimic/utils/types';
import { WebSocketMessageSchema } from '@zimic/ws';

import { ReceivedWebSocketMessageData, UnparsedWebSocketJSONPrimitive } from '@/ws/interceptor/types/messages';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference}
 */
export type WebSocketMessageHandlerStaticRestriction<Message extends WebSocketMessageSchema> = Message extends
  Blob | BufferSource
  ? Blob | BufferSource
  : Message extends UnparsedWebSocketJSONPrimitive | string
    ? ReceivedWebSocketMessageData<Message>
    : DeepPartial<Message>;

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

/** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference} */
type WebSocketMessageHandlerComputedBooleanRestriction<Message extends WebSocketMessageSchema> = (
  message: ReceivedWebSocketMessageData<Message>,
) => PossiblePromise<boolean>;

/** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference} */
export type WebSocketMessageHandlerComputedTypeGuardRestriction<
  Message extends WebSocketMessageSchema,
  PredicateMessage extends ReceivedWebSocketMessageData<Message> = ReceivedWebSocketMessageData<Message>,
> = (message: ReceivedWebSocketMessageData<Message>) => message is PredicateMessage;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference}
 */
export type WebSocketMessageHandlerComputedRestriction<
  Message extends WebSocketMessageSchema,
  PredicateMessage extends ReceivedWebSocketMessageData<Message> = ReceivedWebSocketMessageData<Message>,
> =
  | WebSocketMessageHandlerComputedBooleanRestriction<Message>
  | WebSocketMessageHandlerComputedTypeGuardRestriction<Message, PredicateMessage>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference}
 */
export type WebSocketMessageHandlerRestriction<Message extends WebSocketMessageSchema> =
  WebSocketMessageHandlerStaticRestriction<Message> | WebSocketMessageHandlerComputedRestriction<Message>;

/** The arguments accepted by `handler.with()` after a restriction. Only static restrictions accept options. */
export type WebSocketMessageHandlerRestrictionOptionsArguments<Message extends WebSocketMessageSchema, Restriction> =
  Restriction extends WebSocketMessageHandlerComputedRestriction<Message>
    ? []
    : [options?: WebSocketMessageHandlerStaticRestrictionOptions];

export interface WebSocketMessageHandlerRestrictionDiff<Value> {
  expected: Value;
  received: Value;
}

export interface WebSocketMessageHandlerRestrictionDiffs<
  Message extends WebSocketMessageSchema = WebSocketMessageSchema,
> {
  sender?: WebSocketMessageHandlerRestrictionDiff<boolean>;
  computed?: WebSocketMessageHandlerRestrictionDiff<boolean>;
  data?: WebSocketMessageHandlerRestrictionDiff<
    WebSocketMessageHandlerStaticRestriction<Message> | ReceivedWebSocketMessageData<Message>
  >;
}

export type WebSocketMessageHandlerRestrictionMatch<Message extends WebSocketMessageSchema = WebSocketMessageSchema> =
  { success: true } | { success: false; diff: WebSocketMessageHandlerRestrictionDiffs<Message> };

export interface UnmatchedWebSocketInterceptorMessageGroup<
  Message extends WebSocketMessageSchema = WebSocketMessageSchema,
> {
  message: ReceivedWebSocketMessageData<Message>;
  diff: WebSocketMessageHandlerRestrictionDiffs<Message>;
}
