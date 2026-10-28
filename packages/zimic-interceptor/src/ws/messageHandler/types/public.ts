import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import {
  InterceptedWebSocketInterceptorMessage,
  ReceivedWebSocketMessageData,
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
 * The context of a matched message, passed to effects and computed responses.
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
 * A side effect declared with `handler.effect()`, called with each matched message and its context. Binary messages
 * arrive as `ArrayBuffer`.
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
 * A static server message declared with `handler.respond()`.
 */
export type WebSocketMessageHandlerMessageStaticDeclaration<Schema extends WebSocketSchema> = Schema;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A function declared with `handler.respond()` that computes the server message from each matched message and its
 * context. Binary messages arrive as `ArrayBuffer`.
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
 * A server message declared with `handler.respond()`, either static or computed.
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
    : Schema extends Restriction
      ? Schema
      : Restriction extends WebSocketMessageHandlerStaticRestriction<Schema>
        ? Schema
        : never
  : never;

/**
 * The schema members a type-guard predicate keeps. Type guards receive binary messages as `ArrayBuffer`, so a predicate
 * accepting `ArrayBuffer` keeps every binary schema member.
 */
type WebSocketMessageHandlerSchemaCompatibleWithTypeGuard<Schema extends WebSocketSchema, Predicate> =
  | Extract<Predicate, Schema>
  | ([Extract<Predicate, ArrayBuffer>] extends [never] ? never : Extract<Schema, Blob | BufferSource>);

/**
 * The message type of a handler after applying a restriction. Type-guard restrictions narrow to their predicate and
 * static restrictions narrow to the schema members compatible with them. Other restrictions keep the current type.
 */
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
 * A local WebSocket message handler. In a local handler, the mocking operations are synchronous.
 */
export interface LocalWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> {
  /**
   * The type of the handler.
   *
   * @readonly
   */
  get type(): 'local';

  /** Restricts the handler to messages sent by a specific connected client. */
  from: (sender: WebSocketInterceptorClient<Schema>) => this;

  /**
   * Declares a restriction to intercepted message matches. If multiple restrictions are declared, all of them must be
   * met. Static restrictions match JSON messages containing them, or equal to them with `{ exact: true }`.
   */
  with: <Restriction extends WebSocketMessageHandlerRestriction<RestrictedSchema>>(
    restriction: Restriction,
    ...options: WebSocketMessageHandlerRestrictionOptionsArguments<RestrictedSchema, Restriction>
  ) => LocalWebSocketMessageHandler<
    Schema,
    WebSocketMessageHandlerSchemaWithRestriction<RestrictedSchema, Restriction>
  >;

  /** Declares a delay to wait before running effects or responding to matched messages. */
  delay: ((milliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedSchema>) => this) &
    ((minMilliseconds: number, maxMilliseconds: number) => this);

  /** Declares a side effect to run when the handler matches a message. */
  effect: (callback: WebSocketMessageHandlerMessageCallback<Schema, RestrictedSchema>) => this;

  /** Declares a server message to send when the handler matches a client-to-server message. */
  respond: (declaration: WebSocketMessageHandlerMessageDeclaration<Schema, RestrictedSchema>) => this;

  /** Declares a number of intercepted messages that the handler will be able to match. */
  times: ((numberOfMessages: number) => this) & ((minNumberOfMessages: number, maxNumberOfMessages: number) => this);

  /** Checks if the handler has matched the expected number of messages declared with `handler.times()`. */
  checkTimes: () => void;

  /** Clears the declared responses, effects, restrictions, message count limits, and saved messages of the handler. */
  clear: () => LocalWebSocketMessageHandler<Schema, Schema>;

  /**
   * The client-to-server messages that matched this handler, along with their sender and receiver handles. Requires
   * message saving to be enabled.
   *
   * @readonly
   */
  get messages(): readonly InterceptedWebSocketInterceptorMessage<RestrictedSchema, Schema>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A synced remote WebSocket message handler. When a remote handler is synced, it is guaranteed that all of the mocking
 * operations were committed to the connected {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 */
export interface SyncedRemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> {
  /**
   * The type of the handler.
   *
   * @readonly
   */
  get type(): 'remote';

  /** Restricts the handler to messages sent by a specific connected client. */
  from: (sender: WebSocketInterceptorClient<Schema>) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>;

  /**
   * Declares a restriction to intercepted message matches. If multiple restrictions are declared, all of them must be
   * met. Static restrictions match JSON messages containing them, or equal to them with `{ exact: true }`.
   */
  with: <Restriction extends WebSocketMessageHandlerRestriction<RestrictedSchema>>(
    restriction: Restriction,
    ...options: WebSocketMessageHandlerRestrictionOptionsArguments<RestrictedSchema, Restriction>
  ) => PendingRemoteWebSocketMessageHandler<
    Schema,
    WebSocketMessageHandlerSchemaWithRestriction<RestrictedSchema, Restriction>
  >;

  /** Declares a delay to wait before running effects or responding to matched messages. */
  delay: ((
    milliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedSchema>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>) &
    ((
      minMilliseconds: number,
      maxMilliseconds: number,
    ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>);

  /** Declares a side effect to run when the handler matches a message. */
  effect: (
    callback: WebSocketMessageHandlerMessageCallback<Schema, RestrictedSchema>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>;

  /** Declares a server message to send when the handler matches a client-to-server message. */
  respond: (
    declaration: WebSocketMessageHandlerMessageDeclaration<Schema, RestrictedSchema>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>;

  /** Declares a number of intercepted messages that the handler will be able to match. */
  times: ((numberOfMessages: number) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>) &
    ((
      minNumberOfMessages: number,
      maxNumberOfMessages: number,
    ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>);

  /** Checks if the handler has matched the expected number of messages declared with `handler.times()`. */
  checkTimes: () => Promise<void>;

  /** Clears the declared responses, effects, restrictions, message count limits, and saved messages of the handler. */
  clear: () => PendingRemoteWebSocketMessageHandler<Schema, Schema>;

  /**
   * The client-to-server messages that matched this handler, along with their sender and receiver handles. Requires
   * message saving to be enabled.
   *
   * @readonly
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
 */
export type RemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> = PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A WebSocket message handler, either local or remote.
 */
export type WebSocketMessageHandler<Schema extends WebSocketSchema, RestrictedSchema extends Schema = Schema> =
  LocalWebSocketMessageHandler<Schema, RestrictedSchema> | RemoteWebSocketMessageHandler<Schema, RestrictedSchema>;
