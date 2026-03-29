import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorClient } from '@/ws/interceptor/types/messages';

import WebSocketMessageHandlerImplementation from '../WebSocketMessageHandlerImplementation';
import { WebSocketMessageHandlerDelayFactory } from './messages';
import { WebSocketMessageHandlerRestriction } from './restrictions';

export interface InternalWebSocketMessageHandler<Schema extends WebSocketSchema> {
  client: WebSocketMessageHandlerImplementation<Schema>;
}

export type WebSocketMessageInterceptedCallback<Schema extends WebSocketSchema> = (
  message: Schema,
  context: { sender: WebSocketInterceptorClient<Schema> },
) => PossiblePromise<void>;

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export interface LocalWebSocketMessageHandler<Schema extends WebSocketSchema> {
  get type(): 'local';

  from: (sender: WebSocketInterceptorClient<Schema>) => this;

  with: (restriction: WebSocketMessageHandlerRestriction<Schema>) => this;

  delay: ((milliseconds: number | WebSocketMessageHandlerDelayFactory<Schema>) => this) &
    ((minMilliseconds: number, maxMilliseconds: number) => this);

  run: (callback: WebSocketMessageInterceptedCallback<Schema>) => this;

  times: ((numberOfMessages: number) => this) & ((minNumberOfMessages: number, maxNumberOfMessages: number) => this);

  checkTimes: () => void;

  clear: () => this;
}

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export interface SyncedRemoteWebSocketMessageHandler<Schema extends WebSocketSchema> {
  get type(): 'remote';

  from: (sender: WebSocketInterceptorClient<Schema>) => PendingRemoteWebSocketMessageHandler<Schema>;

  with: (restriction: WebSocketMessageHandlerRestriction<Schema>) => PendingRemoteWebSocketMessageHandler<Schema>;

  delay: ((
    milliseconds: number | WebSocketMessageHandlerDelayFactory<Schema>,
  ) => PendingRemoteWebSocketMessageHandler<Schema>) &
    ((minMilliseconds: number, maxMilliseconds: number) => PendingRemoteWebSocketMessageHandler<Schema>);

  run: (callback: WebSocketMessageInterceptedCallback<Schema>) => PendingRemoteWebSocketMessageHandler<Schema>;

  times: ((numberOfRequests: number) => PendingRemoteWebSocketMessageHandler<Schema>) &
    ((minNumberOfRequests: number, maxNumberOfRequests: number) => PendingRemoteWebSocketMessageHandler<Schema>);

  checkTimes: () => Promise<void>;

  clear: () => PendingRemoteWebSocketMessageHandler<Schema>;
}

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export interface PendingRemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
> extends SyncedRemoteWebSocketMessageHandler<Schema> {
  then: <FulfilledResult = SyncedRemoteWebSocketMessageHandler<Schema>, RejectedResult = never>(
    onFulfilled?: ((handler: SyncedRemoteWebSocketMessageHandler<Schema>) => PossiblePromise<FulfilledResult>) | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<FulfilledResult | RejectedResult>;

  catch: <RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<SyncedRemoteWebSocketMessageHandler<Schema> | RejectedResult>;

  finally: (onFinally?: (() => void) | null) => Promise<SyncedRemoteWebSocketMessageHandler<Schema>>;
}

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export type RemoteWebSocketMessageHandler<Schema extends WebSocketSchema> =
  PendingRemoteWebSocketMessageHandler<Schema>;

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export type WebSocketMessageHandler<Schema extends WebSocketSchema> =
  | LocalWebSocketMessageHandler<Schema>
  | RemoteWebSocketMessageHandler<Schema>;
