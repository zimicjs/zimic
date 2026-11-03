import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import {
  InterceptedWebSocketInterceptorMessage,
  ReceivedWebSocketMessageData,
  UnparsedWebSocketJSONPrimitive,
  WebSocketInterceptorClient,
  WebSocketInterceptorServer,
} from '@/ws/interceptor/types/messages';

import WebSocketMessageHandlerImplementation from '../WebSocketMessageHandlerImplementation';
import { WebSocketMessageHandlerDelayFactory } from './messages';
import {
  WebSocketMessageHandlerComputedTypeGuardRestriction,
  WebSocketMessageHandlerRestriction,
  WebSocketMessageHandlerRestrictionOptionsArguments,
  WebSocketMessageHandlerStaticRestriction,
} from './restrictions';

export interface InternalWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> {
  implementation: WebSocketMessageHandlerImplementation<Schema, RestrictedSchema>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlereffect `handler.effect()` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerrespond `handler.respond()` API reference}
 */
export interface WebSocketMessageHandlerMessageContext<Schema extends WebSocketSchema> {
  /** The client that sent the matched message. */
  sender: WebSocketInterceptorClient<Schema>;

  /** The interceptor server that received the matched message. */
  receiver: WebSocketInterceptorServer<Schema>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlereffect `handler.effect()` API reference}
 */
export type WebSocketMessageHandlerMessageCallback<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> = (
  message: ReceivedWebSocketMessageData<RestrictedSchema>,
  context: WebSocketMessageHandlerMessageContext<Schema>,
) => PossiblePromise<void>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerrespond `handler.respond()` API reference}
 */
export type WebSocketMessageHandlerMessageStaticDeclaration<Schema extends WebSocketSchema> = Schema;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerrespond `handler.respond()` API reference}
 */
export type WebSocketMessageHandlerMessageComputedDeclaration<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema,
> = (
  message: ReceivedWebSocketMessageData<RestrictedSchema>,
  context: WebSocketMessageHandlerMessageContext<Schema>,
) => PossiblePromise<WebSocketMessageHandlerMessageStaticDeclaration<Schema>>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerrespond `handler.respond()` API reference}
 */
export type WebSocketMessageHandlerMessageDeclaration<Schema extends WebSocketSchema, RestrictedSchema extends Schema> =
  | WebSocketMessageHandlerMessageStaticDeclaration<Schema>
  | WebSocketMessageHandlerMessageComputedDeclaration<Schema, RestrictedSchema>;

type WebSocketMessageHandlerSchemaCompatibleWithStaticRestriction<
  Schema extends WebSocketSchema,
  Restriction,
> = Schema extends unknown
  ? [Schema, Restriction] extends [Blob | BufferSource, Exclude<Restriction, Blob | BufferSource>]
    ? never
    : Schema extends UnparsedWebSocketJSONPrimitive
      ? WebSocketMessageHandlerPrimitiveSchemaMatchingText<Schema, Restriction>
      : Schema extends Restriction
        ? Schema
        : Restriction extends WebSocketMessageHandlerStaticRestriction<Schema>
          ? Schema
          : never
  : never;

/**
 * The top-level number and boolean schema members whose received text overlaps a restriction, which may mix the text of
 * several members, such as `'42' | 'true'`.
 */
type WebSocketMessageHandlerPrimitiveSchemaMatchingText<
  Schema extends WebSocketSchema,
  Text,
> = Schema extends UnparsedWebSocketJSONPrimitive
  ? [Extract<Text, ReceivedWebSocketMessageData<Schema>>] extends [never]
    ? never
    : Schema
  : never;

/**
 * The schema members a type-guard predicate keeps. Type guards receive binary messages as `ArrayBuffer`, so a predicate
 * accepting `ArrayBuffer` keeps every binary schema member. They also receive top-level number and boolean members as
 * text, so a predicate accepting that text keeps the member.
 */
type WebSocketMessageHandlerSchemaCompatibleWithTypeGuard<Schema extends WebSocketSchema, Predicate> =
  | Extract<Predicate, Schema>
  | ([Extract<Predicate, ArrayBuffer>] extends [never] ? never : Extract<Schema, Blob | BufferSource>)
  | WebSocketMessageHandlerPrimitiveSchemaMatchingText<Schema, Predicate>;

/** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference} */
export type WebSocketMessageHandlerSchemaWithRestriction<Schema extends WebSocketSchema, Restriction> =
  Restriction extends WebSocketMessageHandlerComputedTypeGuardRestriction<Schema, infer Predicate>
    ? [Predicate] extends [never]
      ? Schema
      : WebSocketMessageHandlerSchemaCompatibleWithTypeGuard<Schema, Predicate>
    : Restriction extends WebSocketMessageHandlerStaticRestriction<Schema>
      ? WebSocketMessageHandlerSchemaCompatibleWithStaticRestriction<Schema, Restriction>
      : Schema;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler `WebSocketMessageHandler` API reference}
 */
export interface LocalWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> {
  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlertype `handler.type` API reference}
   */
  get type(): 'local';

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerfrom `handler.from()` API reference} */
  from: (sender: WebSocketInterceptorClient<Schema>) => this;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference} */
  with: <Restriction extends WebSocketMessageHandlerRestriction<RestrictedSchema>>(
    restriction: Restriction,
    ...options: WebSocketMessageHandlerRestrictionOptionsArguments<RestrictedSchema, Restriction>
  ) => LocalWebSocketMessageHandler<
    Schema,
    WebSocketMessageHandlerSchemaWithRestriction<RestrictedSchema, Restriction>
  >;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerdelay `handler.delay()` API reference} */
  delay: ((milliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedSchema>) => this) &
    ((minMilliseconds: number, maxMilliseconds: number) => this);

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlereffect `handler.effect()` API reference} */
  effect: (callback: WebSocketMessageHandlerMessageCallback<Schema, RestrictedSchema>) => this;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerrespond `handler.respond()` API reference} */
  respond: (declaration: WebSocketMessageHandlerMessageDeclaration<Schema, RestrictedSchema>) => this;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlertimes `handler.times()` API reference} */
  times: ((numberOfMessages: number) => this) & ((minNumberOfMessages: number, maxNumberOfMessages: number) => this);

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerchecktimes `handler.checkTimes()` API reference} */
  checkTimes: () => void;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerclear `handler.clear()` API reference} */
  clear: () => LocalWebSocketMessageHandler<Schema, Schema>;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlermessages `handler.messages` API reference}
   */
  get messages(): readonly InterceptedWebSocketInterceptorMessage<RestrictedSchema, Schema>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A synced remote WebSocket message handler. When a remote handler is synced, it is guaranteed that all of the mocking
 * operations were committed to the connected {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler `WebSocketMessageHandler` API reference}
 */
export interface SyncedRemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> {
  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlertype `handler.type` API reference}
   */
  get type(): 'remote';

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerfrom `handler.from()` API reference} */
  from: (sender: WebSocketInterceptorClient<Schema>) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference} */
  with: <Restriction extends WebSocketMessageHandlerRestriction<RestrictedSchema>>(
    restriction: Restriction,
    ...options: WebSocketMessageHandlerRestrictionOptionsArguments<RestrictedSchema, Restriction>
  ) => PendingRemoteWebSocketMessageHandler<
    Schema,
    WebSocketMessageHandlerSchemaWithRestriction<RestrictedSchema, Restriction>
  >;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerdelay `handler.delay()` API reference} */
  delay: ((
    milliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedSchema>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>) &
    ((
      minMilliseconds: number,
      maxMilliseconds: number,
    ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>);

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlereffect `handler.effect()` API reference} */
  effect: (
    callback: WebSocketMessageHandlerMessageCallback<Schema, RestrictedSchema>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerrespond `handler.respond()` API reference} */
  respond: (
    declaration: WebSocketMessageHandlerMessageDeclaration<Schema, RestrictedSchema>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlertimes `handler.times()` API reference} */
  times: ((numberOfMessages: number) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>) &
    ((
      minNumberOfMessages: number,
      maxNumberOfMessages: number,
    ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>);

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerchecktimes `handler.checkTimes()` API reference} */
  checkTimes: () => Promise<void>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerclear `handler.clear()` API reference} */
  clear: () => PendingRemoteWebSocketMessageHandler<Schema, Schema>;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlermessages `handler.messages` API reference}
   */
  get messages(): readonly InterceptedWebSocketInterceptorMessage<RestrictedSchema, Schema>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A pending remote WebSocket message handler. When a remote handler is pending, it is not guaranteed that all of the
 * mocking operations were committed to the connected
 * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 *
 * To commit a remote handler, you can `await` it or use the methods {@link then handler.then()},
 * {@link catch handler.catch()}, and {@link finally handler.finally()}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler `WebSocketMessageHandler` API reference}
 */
export interface PendingRemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> extends SyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema> {
  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  then: <FulfilledResult = SyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema>, RejectedResult = never>(
    onFulfilled?:
      | ((handler: SyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema>) => PossiblePromise<FulfilledResult>)
      | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<FulfilledResult | RejectedResult>;

  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  catch: <RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<SyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema> | RejectedResult>;

  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  finally: (onFinally?: (() => void) | null) => Promise<SyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema>>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A remote WebSocket message handler. In a remote handler, the mocking operations are asynchronous and include remote
 * calls to the connected {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler `WebSocketMessageHandler` API reference}
 */
export type RemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> = PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler `WebSocketMessageHandler` API reference}
 */
export type WebSocketMessageHandler<Schema extends WebSocketSchema, RestrictedSchema extends Schema = Schema> =
  LocalWebSocketMessageHandler<Schema, RestrictedSchema> | RemoteWebSocketMessageHandler<Schema, RestrictedSchema>;
