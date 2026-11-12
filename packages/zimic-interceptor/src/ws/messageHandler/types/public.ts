import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketMessageSchema, WebSocketSchema } from '@zimic/ws';

import {
  InterceptedWebSocketInterceptorMessage,
  ReceivedWebSocketMessageData,
  UnparsedWebSocketJSONPrimitive,
  WebSocketInterceptorClient,
  WebSocketInterceptorServer,
} from '@/ws/interceptor/types/messages';
import { WebSocketInterceptorPathMessage } from '@/ws/interceptor/types/schema';

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
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> {
  implementation: WebSocketMessageHandlerImplementation<Schema, Path, RestrictedMessage>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The context of a matched message, passed to effects and computed responses. The sender is typed from the handler path
 * and the receiver with the messages of all paths, because the interceptor server holds and broadcasts them all.
 */
export interface WebSocketMessageHandlerMessageContext<Schema extends WebSocketSchema, Path extends string = string> {
  /** The client that sent the matched message. */
  sender: WebSocketInterceptorClient<Schema, Path>;

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
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> = (
  message: ReceivedWebSocketMessageData<RestrictedMessage>,
  context: WebSocketMessageHandlerMessageContext<Schema, Path>,
) => PossiblePromise<void>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A static server message declared with `handler.respond()`. It is sent to the sender of the matched message, so it is
 * one of the messages of the handler path.
 */
export type WebSocketMessageHandlerMessageStaticDeclaration<
  Schema extends WebSocketSchema,
  Path extends string = string,
> = WebSocketInterceptorPathMessage<Schema, Path>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A function declared with `handler.respond()` that computes the server message from each matched message and its
 * context. Binary messages arrive as `ArrayBuffer`.
 */
export type WebSocketMessageHandlerMessageComputedDeclaration<
  Schema extends WebSocketSchema,
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> = (
  message: ReceivedWebSocketMessageData<RestrictedMessage>,
  context: WebSocketMessageHandlerMessageContext<Schema, Path>,
) => PossiblePromise<WebSocketMessageHandlerMessageStaticDeclaration<Schema, Path>>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A server message declared with `handler.respond()`, either static or computed.
 */
export type WebSocketMessageHandlerMessageDeclaration<
  Schema extends WebSocketSchema,
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> =
  | WebSocketMessageHandlerMessageStaticDeclaration<Schema, Path>
  | WebSocketMessageHandlerMessageComputedDeclaration<Schema, Path, RestrictedMessage>;

type WebSocketMessageHandlerSchemaCompatibleWithStaticRestriction<
  Schema extends WebSocketMessageSchema,
  Restriction,
> = Schema extends unknown
  ? [Schema, Restriction] extends [Blob | BufferSource, Exclude<Restriction, Blob | BufferSource>]
    ? never
    : Schema extends UnparsedWebSocketJSONPrimitive | string
      ? [Extract<Restriction, string>] extends [never]
        ? never
        : Schema
      : Schema extends Restriction
        ? Schema
        : Restriction extends WebSocketMessageHandlerStaticRestriction<Schema>
          ? Schema
          : never
  : never;

/**
 * The top-level number and boolean schema members whose received text overlaps a type-guard predicate, which may mix
 * the text of several members, such as `'42' | 'true'`.
 */
type WebSocketMessageHandlerPrimitiveSchemaMatchingText<
  Schema extends WebSocketMessageSchema,
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
type WebSocketMessageHandlerSchemaCompatibleWithTypeGuard<Schema extends WebSocketMessageSchema, Predicate> =
  | Extract<Predicate, Schema>
  | ([Extract<Predicate, ArrayBuffer>] extends [never] ? never : Extract<Schema, Blob | BufferSource>)
  | WebSocketMessageHandlerPrimitiveSchemaMatchingText<Schema, Predicate>;

/**
 * The message type of a handler after applying a restriction. Type-guard restrictions narrow to their predicate and
 * static restrictions narrow to the schema members compatible with them. Text restrictions keep every member received
 * as text, because any of them may include the restriction. Other restrictions keep the current type.
 */
export type WebSocketMessageHandlerSchemaWithRestriction<Schema extends WebSocketMessageSchema, Restriction> =
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
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> {
  /**
   * The type of the handler.
   *
   * @readonly
   */
  get type(): 'local';

  /**
   * The path declared in `interceptor.message(path)`, relative to the interceptor base URL. `undefined` if the handler
   * matches the messages of every connection to its interceptor.
   *
   * @readonly
   */
  get path(): Path | undefined;

  /**
   * Restricts the handler to messages sent by a specific connected client. Accepts a client of any path of the schema,
   * because clients are compared by identity.
   */
  from: (sender: WebSocketInterceptorClient<Schema>) => this;

  /**
   * Declares a restriction to intercepted message matches. If multiple restrictions are declared, all of them must be
   * met. Static restrictions match JSON messages containing them and text messages including them, or messages equal to
   * them with `{ exact: true }`.
   */
  with: <Restriction extends WebSocketMessageHandlerRestriction<RestrictedMessage>>(
    restriction: Restriction,
    ...options: WebSocketMessageHandlerRestrictionOptionsArguments<RestrictedMessage, Restriction>
  ) => LocalWebSocketMessageHandler<
    Schema,
    Path,
    WebSocketMessageHandlerSchemaWithRestriction<RestrictedMessage, Restriction>
  >;

  /** Declares a delay to wait before running effects or responding to matched messages. */
  delay: ((milliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedMessage>) => this) &
    ((minMilliseconds: number, maxMilliseconds: number) => this);

  /** Declares a side effect to run when the handler matches a message. */
  effect: (callback: WebSocketMessageHandlerMessageCallback<Schema, Path, RestrictedMessage>) => this;

  /** Declares a server message to send to the sender when the handler matches a client-to-server message. */
  respond: (declaration: WebSocketMessageHandlerMessageDeclaration<Schema, Path, RestrictedMessage>) => this;

  /** Declares a number of intercepted messages that the handler will be able to match. */
  times: ((numberOfMessages: number) => this) & ((minNumberOfMessages: number, maxNumberOfMessages: number) => this);

  /** Checks if the handler has matched the expected number of messages declared with `handler.times()`. */
  checkTimes: () => void;

  /** Clears the declared responses, effects, restrictions, message count limits, and saved messages of the handler. */
  clear: () => LocalWebSocketMessageHandler<Schema, Path>;

  /**
   * The client-to-server messages that matched this handler, along with their sender and receiver handles. Requires
   * message saving to be enabled.
   *
   * @readonly
   */
  get messages(): readonly InterceptedWebSocketInterceptorMessage<Schema, Path, RestrictedMessage>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A synced remote WebSocket message handler. When a remote handler is synced, it is guaranteed that all of the mocking
 * operations were committed to the connected {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 */
export interface SyncedRemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> {
  /**
   * The type of the handler.
   *
   * @readonly
   */
  get type(): 'remote';

  /**
   * The path declared in `interceptor.message(path)`, relative to the interceptor base URL. `undefined` if the handler
   * matches the messages of every connection to its interceptor.
   *
   * @readonly
   */
  get path(): Path | undefined;

  /**
   * Restricts the handler to messages sent by a specific connected client. Accepts a client of any path of the schema,
   * because clients are compared by identity.
   */
  from: (
    sender: WebSocketInterceptorClient<Schema>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>;

  /**
   * Declares a restriction to intercepted message matches. If multiple restrictions are declared, all of them must be
   * met. Static restrictions match JSON messages containing them and text messages including them, or messages equal to
   * them with `{ exact: true }`.
   */
  with: <Restriction extends WebSocketMessageHandlerRestriction<RestrictedMessage>>(
    restriction: Restriction,
    ...options: WebSocketMessageHandlerRestrictionOptionsArguments<RestrictedMessage, Restriction>
  ) => PendingRemoteWebSocketMessageHandler<
    Schema,
    Path,
    WebSocketMessageHandlerSchemaWithRestriction<RestrictedMessage, Restriction>
  >;

  /** Declares a delay to wait before running effects or responding to matched messages. */
  delay: ((
    milliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedMessage>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>) &
    ((
      minMilliseconds: number,
      maxMilliseconds: number,
    ) => PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>);

  /** Declares a side effect to run when the handler matches a message. */
  effect: (
    callback: WebSocketMessageHandlerMessageCallback<Schema, Path, RestrictedMessage>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>;

  /** Declares a server message to send to the sender when the handler matches a client-to-server message. */
  respond: (
    declaration: WebSocketMessageHandlerMessageDeclaration<Schema, Path, RestrictedMessage>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>;

  /** Declares a number of intercepted messages that the handler will be able to match. */
  times: ((numberOfMessages: number) => PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>) &
    ((
      minNumberOfMessages: number,
      maxNumberOfMessages: number,
    ) => PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>);

  /** Checks if the handler has matched the expected number of messages declared with `handler.times()`. */
  checkTimes: () => Promise<void>;

  /** Clears the declared responses, effects, restrictions, message count limits, and saved messages of the handler. */
  clear: () => PendingRemoteWebSocketMessageHandler<Schema, Path>;

  /**
   * The client-to-server messages that matched this handler, along with their sender and receiver handles. Requires
   * message saving to be enabled.
   *
   * @readonly
   */
  get messages(): readonly InterceptedWebSocketInterceptorMessage<Schema, Path, RestrictedMessage>[];
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
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> extends SyncedRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage> {
  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  then: <
    FulfilledResult = SyncedRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>,
    RejectedResult = never,
  >(
    onFulfilled?:
      | ((
          handler: SyncedRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>,
        ) => PossiblePromise<FulfilledResult>)
      | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<FulfilledResult | RejectedResult>;

  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  catch: <RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<SyncedRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage> | RejectedResult>;

  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  finally: (
    onFinally?: (() => void) | null,
  ) => Promise<SyncedRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A remote WebSocket message handler. In a remote handler, the mocking operations are asynchronous and include remote
 * calls to the connected {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 */
export type RemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> = PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A WebSocket message handler, either local or remote.
 */
export type WebSocketMessageHandler<
  Schema extends WebSocketSchema,
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> =
  | LocalWebSocketMessageHandler<Schema, Path, RestrictedMessage>
  | RemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>;
