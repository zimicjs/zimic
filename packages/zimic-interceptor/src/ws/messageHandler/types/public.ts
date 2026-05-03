import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { InterceptedWebSocketInterceptorMessage, WebSocketInterceptorClient } from '@/ws/interceptor/types/messages';

import WebSocketMessageHandlerImplementation from '../WebSocketMessageHandlerImplementation';
import { WebSocketMessageHandlerDelayFactory } from './messages';
import { WebSocketMessageHandlerComputedRestriction, WebSocketMessageHandlerStaticRestriction } from './restrictions';

export interface InternalWebSocketMessageHandler<Schema extends WebSocketSchema> {
  client: WebSocketMessageHandlerImplementation<Schema>;
}

export interface WebSocketMessageHandlerMessageContext<Schema extends WebSocketSchema> {
  sender: WebSocketInterceptorClient<Schema>;
  receiver: WebSocketInterceptorClient<Schema>;
}

export type WebSocketMessageHandlerMessageCallback<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> = (message: RestrictedSchema, context: WebSocketMessageHandlerMessageContext<Schema>) => PossiblePromise<void>;

export type WebSocketMessageHandlerMessageStaticDeclaration<Schema extends WebSocketSchema> = Schema;

export type WebSocketMessageHandlerMessageComputedDeclaration<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema,
> = (
  message: RestrictedSchema,
  context: WebSocketMessageHandlerMessageContext<Schema>,
) => PossiblePromise<WebSocketMessageHandlerMessageStaticDeclaration<Schema>>;

export type WebSocketMessageHandlerMessageDeclaration<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema,
> =
  | WebSocketMessageHandlerMessageStaticDeclaration<Schema>
  | WebSocketMessageHandlerMessageComputedDeclaration<Schema, RestrictedSchema>;

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export interface LocalWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> {
  get type(): 'local';

  from: (sender: WebSocketInterceptorClient<Schema>) => this;

  with: (<Restriction extends WebSocketMessageHandlerStaticRestriction<RestrictedSchema>>(
    restriction: Restriction,
  ) => LocalWebSocketMessageHandler<RestrictedSchema, Extract<RestrictedSchema, Restriction>>) &
    (<
      Restriction extends WebSocketMessageHandlerComputedRestriction<RestrictedSchema, Predicate>,
      Predicate extends RestrictedSchema,
    >(
      restriction: Restriction,
    ) => LocalWebSocketMessageHandler<RestrictedSchema, Extract<RestrictedSchema, Predicate>>);

  delay: ((milliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedSchema>) => this) &
    ((minMilliseconds: number, maxMilliseconds: number) => this);

  effect: (callback: WebSocketMessageHandlerMessageCallback<Schema, RestrictedSchema>) => this;

  respond: (declaration: WebSocketMessageHandlerMessageDeclaration<Schema, RestrictedSchema>) => this;

  times: ((numberOfMessages: number) => this) & ((minNumberOfMessages: number, maxNumberOfMessages: number) => this);

  checkTimes: () => void;

  clear: () => this;

  get messages(): readonly InterceptedWebSocketInterceptorMessage<RestrictedSchema>[];
}

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export interface SyncedRemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> {
  get type(): 'remote';

  from: (sender: WebSocketInterceptorClient<Schema>) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>;

  with: (<Restriction extends WebSocketMessageHandlerStaticRestriction<RestrictedSchema>>(
    restriction: Restriction,
  ) => PendingRemoteWebSocketMessageHandler<RestrictedSchema, Extract<RestrictedSchema, Restriction>>) &
    (<
      Restriction extends WebSocketMessageHandlerComputedRestriction<RestrictedSchema, Predicate>,
      Predicate extends RestrictedSchema,
    >(
      restriction: Restriction,
    ) => PendingRemoteWebSocketMessageHandler<RestrictedSchema, Extract<RestrictedSchema, Predicate>>);

  delay: ((
    milliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedSchema>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>) &
    ((
      minMilliseconds: number,
      maxMilliseconds: number,
    ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>);

  effect: (
    callback: WebSocketMessageHandlerMessageCallback<Schema, RestrictedSchema>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>;

  respond: (
    declaration: WebSocketMessageHandlerMessageDeclaration<Schema, RestrictedSchema>,
  ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>;

  times: ((numberOfRequests: number) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>) &
    ((
      minNumberOfRequests: number,
      maxNumberOfRequests: number,
    ) => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>);

  checkTimes: () => Promise<void>;

  clear: () => PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>;

  get messages(): readonly InterceptedWebSocketInterceptorMessage<RestrictedSchema>[];
}

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export interface PendingRemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> extends SyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema> {
  then: <FulfilledResult = SyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema>, RejectedResult = Schema>(
    onFulfilled?:
      | ((handler: SyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema>) => PossiblePromise<FulfilledResult>)
      | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<FulfilledResult | RejectedResult>;

  catch: <RejectedResult = Schema>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<SyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema> | RejectedResult>;

  finally: (onFinally?: (() => void) | null) => Promise<SyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema>>;
}

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export type RemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> = PendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema>;

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export type WebSocketMessageHandler<Schema extends WebSocketSchema, RestrictedSchema extends Schema = Schema> =
  | LocalWebSocketMessageHandler<Schema, RestrictedSchema>
  | RemoteWebSocketMessageHandler<Schema, RestrictedSchema>;
