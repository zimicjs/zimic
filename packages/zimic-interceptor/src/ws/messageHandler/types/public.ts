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
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlereffect `handler.effect()` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerrespond `handler.respond()` API reference}
 */
export interface WebSocketMessageHandlerMessageContext<Schema extends WebSocketSchema, Path extends string = string> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlereffect `handler.effect()` API reference} */
  sender: WebSocketInterceptorClient<Schema, Path>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlereffect `handler.effect()` API reference} */
  receiver: WebSocketInterceptorServer<Schema>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlereffect `handler.effect()` API reference}
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
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerrespond `handler.respond()` API reference}
 */
export type WebSocketMessageHandlerMessageStaticDeclaration<
  Schema extends WebSocketSchema,
  Path extends string = string,
> = WebSocketInterceptorPathMessage<Schema, Path>;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerrespond `handler.respond()` API reference}
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
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerrespond `handler.respond()` API reference}
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

type WebSocketMessageHandlerMessageCompatibleWithStaticRestriction<
  Message extends WebSocketMessageSchema,
  Restriction,
> = Message extends unknown
  ? [Message, Restriction] extends [Blob | BufferSource, Exclude<Restriction, Blob | BufferSource>]
    ? never
    : Message extends UnparsedWebSocketJSONPrimitive | string
      ? [Extract<Restriction, string>] extends [never]
        ? never
        : Message
      : Message extends Restriction
        ? Message
        : Restriction extends WebSocketMessageHandlerStaticRestriction<Message>
          ? Message
          : never
  : never;

/**
 * The top-level number and boolean schema members whose received text overlaps a type-guard predicate, which may mix
 * the text of several members, such as `'42' | 'true'`.
 */
type WebSocketMessageHandlerPrimitiveMessageMatchingText<
  Message extends WebSocketMessageSchema,
  Text,
> = Message extends UnparsedWebSocketJSONPrimitive
  ? [Extract<Text, ReceivedWebSocketMessageData<Message>>] extends [never]
    ? never
    : Message
  : never;

/**
 * The schema members a type-guard predicate keeps. Type guards receive binary messages as `ArrayBuffer`, so a predicate
 * accepting `ArrayBuffer` keeps every binary schema member. They also receive top-level number and boolean members as
 * text, so a predicate accepting that text keeps the member.
 */
type WebSocketMessageHandlerMessageCompatibleWithTypeGuard<Message extends WebSocketMessageSchema, Predicate> =
  | Extract<Predicate, Message>
  | ([Extract<Predicate, ArrayBuffer>] extends [never] ? never : Extract<Message, Blob | BufferSource>)
  | WebSocketMessageHandlerPrimitiveMessageMatchingText<Message, Predicate>;

/** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference} */
export type WebSocketMessageHandlerMessageWithRestriction<Message extends WebSocketMessageSchema, Restriction> =
  Restriction extends WebSocketMessageHandlerComputedTypeGuardRestriction<Message, infer Predicate>
    ? [Predicate] extends [never]
      ? Message
      : WebSocketMessageHandlerMessageCompatibleWithTypeGuard<Message, Predicate>
    : Restriction extends WebSocketMessageHandlerStaticRestriction<Message>
      ? WebSocketMessageHandlerMessageCompatibleWithStaticRestriction<Message, Restriction>
      : Message;

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler `WebSocketMessageHandler` API reference}
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
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlertype `handler.type` API reference}
   */
  get type(): 'local';

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerpath `handler.path` API reference}
   */
  get path(): Path | undefined;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerfrom `handler.from()` API reference} */
  from: (sender: WebSocketInterceptorClient<Schema>) => this;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference} */
  with: <Restriction extends WebSocketMessageHandlerRestriction<RestrictedMessage>>(
    restriction: Restriction,
    ...options: WebSocketMessageHandlerRestrictionOptionsArguments<RestrictedMessage, Restriction>
  ) => LocalWebSocketMessageHandler<
    Schema,
    Path,
    WebSocketMessageHandlerMessageWithRestriction<RestrictedMessage, Restriction>
  >;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerdelay `handler.delay()` API reference} */
  delay: ((milliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedMessage>) => this) &
    ((minMilliseconds: number, maxMilliseconds: number) => this);

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlereffect `handler.effect()` API reference} */
  effect: (callback: WebSocketMessageHandlerMessageCallback<Schema, Path, RestrictedMessage>) => this;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerrespond `handler.respond()` API reference} */
  respond: (declaration: WebSocketMessageHandlerMessageDeclaration<Schema, Path, RestrictedMessage>) => this;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlertimes `handler.times()` API reference} */
  times: ((numberOfMessages: number) => this) & ((minNumberOfMessages: number, maxNumberOfMessages: number) => this);

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerchecktimes `handler.checkTimes()` API reference} */
  checkTimes: () => void;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerclear `handler.clear()` API reference} */
  clear: () => LocalWebSocketMessageHandler<Schema, Path>;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlermessages `handler.messages` API reference}
   */
  get messages(): readonly InterceptedWebSocketInterceptorMessage<Schema, Path, RestrictedMessage>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler `WebSocketMessageHandler` API reference}
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
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlertype `handler.type` API reference}
   */
  get type(): 'remote';

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerpath `handler.path` API reference}
   */
  get path(): Path | undefined;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerfrom `handler.from()` API reference} */
  from: (
    sender: WebSocketInterceptorClient<Schema>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerwith `handler.with()` API reference} */
  with: <Restriction extends WebSocketMessageHandlerRestriction<RestrictedMessage>>(
    restriction: Restriction,
    ...options: WebSocketMessageHandlerRestrictionOptionsArguments<RestrictedMessage, Restriction>
  ) => PendingRemoteWebSocketMessageHandler<
    Schema,
    Path,
    WebSocketMessageHandlerMessageWithRestriction<RestrictedMessage, Restriction>
  >;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerdelay `handler.delay()` API reference} */
  delay: ((
    milliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedMessage>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>) &
    ((
      minMilliseconds: number,
      maxMilliseconds: number,
    ) => PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>);

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlereffect `handler.effect()` API reference} */
  effect: (
    callback: WebSocketMessageHandlerMessageCallback<Schema, Path, RestrictedMessage>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerrespond `handler.respond()` API reference} */
  respond: (
    declaration: WebSocketMessageHandlerMessageDeclaration<Schema, Path, RestrictedMessage>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlertimes `handler.times()` API reference} */
  times: ((numberOfMessages: number) => PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>) &
    ((
      minNumberOfMessages: number,
      maxNumberOfMessages: number,
    ) => PendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>);

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerchecktimes `handler.checkTimes()` API reference} */
  checkTimes: () => Promise<void>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerclear `handler.clear()` API reference} */
  clear: () => PendingRemoteWebSocketMessageHandler<Schema, Path>;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlermessages `handler.messages` API reference}
   */
  get messages(): readonly InterceptedWebSocketInterceptorMessage<Schema, Path, RestrictedMessage>[];
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler `WebSocketMessageHandler` API reference}
 */
export interface PendingRemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> extends SyncedRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler `WebSocketMessageHandler` API reference} */
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

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler `WebSocketMessageHandler` API reference} */
  catch: <RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<SyncedRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage> | RejectedResult>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler `WebSocketMessageHandler` API reference} */
  finally: (
    onFinally?: (() => void) | null,
  ) => Promise<SyncedRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>>;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler `WebSocketMessageHandler` API reference}
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
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler `WebSocketMessageHandler` API reference}
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
