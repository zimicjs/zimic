import { DeepPartial, PossiblePromise } from '@zimic/utils/types';
import { WebSocketMessageSchema, WebSocketSchema } from '@zimic/ws';

import { ReceivedWebSocketMessageData, UnparsedWebSocketJSONPrimitive } from '@/ws/interceptor/types/messages';
import { WebSocketInterceptorPathMessage } from '@/ws/interceptor/types/schema';

import { WebSocketMessageHandlerMessageContext } from './public';

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
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference}
 */
export interface WebSocketMessageHandlerStaticRestrictionOptions {
  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference} */
  exact?: boolean;
}

/** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference} */
type WebSocketMessageHandlerComputedBooleanRestriction<
  Schema extends WebSocketSchema,
  Path extends string = string,
  Message extends WebSocketMessageSchema = WebSocketInterceptorPathMessage<Schema, Path>,
> = (
  message: ReceivedWebSocketMessageData<Message>,
  context: WebSocketMessageHandlerMessageContext<Schema, Path>,
) => PossiblePromise<boolean>;

/** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference} */
export type WebSocketMessageHandlerComputedTypeGuardRestriction<
  Schema extends WebSocketSchema,
  Path extends string = string,
  Message extends WebSocketMessageSchema = WebSocketInterceptorPathMessage<Schema, Path>,
  PredicateMessage extends ReceivedWebSocketMessageData<Message> = ReceivedWebSocketMessageData<Message>,
> = (
  message: ReceivedWebSocketMessageData<Message>,
  context: WebSocketMessageHandlerMessageContext<Schema, Path>,
) => message is PredicateMessage;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference}
 */
export type WebSocketMessageHandlerComputedRestriction<
  Schema extends WebSocketSchema,
  Path extends string = string,
  Message extends WebSocketMessageSchema = WebSocketInterceptorPathMessage<Schema, Path>,
  PredicateMessage extends ReceivedWebSocketMessageData<Message> = ReceivedWebSocketMessageData<Message>,
> =
  | WebSocketMessageHandlerComputedBooleanRestriction<Schema, Path, Message>
  | WebSocketMessageHandlerComputedTypeGuardRestriction<Schema, Path, Message, PredicateMessage>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference}
 */
export type WebSocketMessageHandlerRestriction<
  Schema extends WebSocketSchema,
  Path extends string = string,
  Message extends WebSocketMessageSchema = WebSocketInterceptorPathMessage<Schema, Path>,
> =
  WebSocketMessageHandlerStaticRestriction<Message> | WebSocketMessageHandlerComputedRestriction<Schema, Path, Message>;

/** The arguments accepted by `handler.with()` after a restriction. Only static restrictions accept options. */
export type WebSocketMessageHandlerRestrictionOptionsArguments<
  Schema extends WebSocketSchema,
  Path extends string,
  Message extends WebSocketMessageSchema,
  Restriction,
> =
  Restriction extends WebSocketMessageHandlerComputedRestriction<Schema, Path, Message>
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
