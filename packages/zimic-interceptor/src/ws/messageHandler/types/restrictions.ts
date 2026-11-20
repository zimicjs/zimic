import { DeepPartial, PossiblePromise } from '@zimic/utils/types';
import { WebSocketMessageSchema, WebSocketSchema } from '@zimic/ws';

import {
  WebSocketConnectionHandlerStaticRestriction,
  WebSocketConnectionStaticRestrictionDiffs,
} from '@/ws/connectionHandler/types/restrictions';
import {
  ReceivedWebSocketMessageData,
  UnparsedWebSocketJSONPrimitive,
  WebSocketInterceptorClient,
} from '@/ws/interceptor/types/messages';
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

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A sender restriction declared with `handler.from()`: either a connected client, matched by identity, or a static
 * restriction of the sender's connection, matched as in `connectionHandler.with()`.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerfrom `handler.from()` API reference}
 */
export type WebSocketMessageHandlerSenderRestriction<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> = WebSocketInterceptorClient<Schema> | WebSocketConnectionHandlerStaticRestriction<Schema, Path>;

export interface WebSocketMessageHandlerRestrictionDiff<Value> {
  expected: Value;
  received: Value;
}

/** A client sender restriction reports whether the sender was the client, and a static one reports each field. */
export type WebSocketMessageHandlerSenderRestrictionDiff =
  WebSocketMessageHandlerRestrictionDiff<boolean> | WebSocketConnectionStaticRestrictionDiffs;

export interface WebSocketMessageHandlerRestrictionDiffs<
  Message extends WebSocketMessageSchema = WebSocketMessageSchema,
> {
  sender?: WebSocketMessageHandlerSenderRestrictionDiff;
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
