import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { WebSocketMessageHandlerClient } from '../WebSocketMessageHandlerClient';
import { WebSocketMessageHandlerDelayFactory } from './messages';
import { WebSocketMessageHandlerRestriction } from './restrictions';

export interface InternalWebSocketMessageHandler<Schema extends WebSocketSchema> {
  client: WebSocketMessageHandlerClient<Schema>;
}

export interface LocalWebSocketMessageHandler<Schema extends WebSocketSchema> {
  get type(): 'local';

  with: (restriction: WebSocketMessageHandlerRestriction<Schema>) => this;

  delay: ((milliseconds: number | WebSocketMessageHandlerDelayFactory<Schema>) => this) &
    ((minMilliseconds: number, maxMilliseconds: number) => this);

  send: (message: WebSocketMessageData<Schema>) => this;

  times: ((numberOfMessages: number) => this) & ((minNumberOfMessages: number, maxNumberOfMessages: number) => this);

  checkTimes: () => void;

  clear: () => this;
}

export interface SyncedRemoteWebSocketMessageHandler<Schema extends WebSocketSchema> {
  get type(): 'remote';

  with: (restriction: WebSocketMessageHandlerRestriction<Schema>) => PendingRemoteWebSocketMessageHandler<Schema>;

  delay: ((
    milliseconds: number | WebSocketMessageHandlerDelayFactory<Schema>,
  ) => PendingRemoteWebSocketMessageHandler<Schema>) &
    ((minMilliseconds: number, maxMilliseconds: number) => PendingRemoteWebSocketMessageHandler<Schema>);

  send: (message: WebSocketMessageData<Schema>) => PendingRemoteWebSocketMessageHandler<Schema>;

  times: ((numberOfRequests: number) => PendingRemoteWebSocketMessageHandler<Schema>) &
    ((minNumberOfRequests: number, maxNumberOfRequests: number) => PendingRemoteWebSocketMessageHandler<Schema>);

  checkTimes: () => Promise<void>;

  clear: () => PendingRemoteWebSocketMessageHandler<Schema>;
}

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

export type RemoteWebSocketMessageHandler<Schema extends WebSocketSchema> =
  PendingRemoteWebSocketMessageHandler<Schema>;

export type WebSocketMessageHandler<Schema extends WebSocketSchema> =
  | LocalWebSocketMessageHandler<Schema>
  | RemoteWebSocketMessageHandler<Schema>;
