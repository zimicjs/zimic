import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import WebSocketInterceptorClient from '../interceptor/WebSocketInterceptorClient';
import { WebSocketMessageHandlerDelayFactory } from './types/messages';
import {
  SyncedRemoteWebSocketMessageHandler as PublicSyncedRemoteWebSocketMessageHandler,
  PendingRemoteWebSocketMessageHandler as PublicPendingRemoteWebSocketMessageHandler,
} from './types/public';
import { WebSocketMessageHandlerRestriction } from './types/restrictions';
import { WebSocketMessageHandlerClient } from './WebSocketMessageHandlerClient';

const UNSYNCEDPROPERTIES = new Set<string | symbol>(['then'] satisfies (keyof Promise<unknown>)[]);

export class RemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
> implements PublicPendingRemoteWebSocketMessageHandler<Schema> {
  readonly type = 'remote';

  client: WebSocketMessageHandlerClient<Schema>;

  private syncPromises: Promise<unknown>[] = [];

  private unsynced: this;
  private synced: this;

  constructor(interceptorClient: WebSocketInterceptorClient<Schema>) {
    this.client = new WebSocketMessageHandlerClient<Schema>(interceptorClient);
    this.unsynced = this;
    this.synced = this.createSyncedProxy();
  }

  private createSyncedProxy() {
    return new Proxy(this, {
      has: (target, property) => {
        if (this.isHiddenPropertyWhenSynced(property)) {
          return false;
        }
        return Reflect.has(target, property);
      },

      get: (target, property) => {
        if (this.isHiddenPropertyWhenSynced(property)) {
          return undefined;
        }
        return Reflect.get(target, property);
      },
    });
  }

  private isHiddenPropertyWhenSynced(property: string | symbol) {
    return UNSYNCEDPROPERTIES.has(property);
  }

  with(restriction: WebSocketMessageHandlerRestriction<Schema>) {
    this.client.with(restriction);
    return this.unsynced;
  }

  delay(minMilliseconds: number | WebSocketMessageHandlerDelayFactory<Schema>, maxMilliseconds?: number) {
    this.client.delay(minMilliseconds, maxMilliseconds);
    return this.unsynced;
  }

  send(message: WebSocketMessageData<Schema>) {
    this.client.send(message);
    return this.unsynced;
  }

  times(minNumberOfRequests: number, maxNumberOfRequests?: number) {
    this.client.times(minNumberOfRequests, maxNumberOfRequests);
    return this.unsynced;
  }

  checkTimes() {
    return new Promise<void>((resolve, reject) => {
      try {
        this.client.checkTimes();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  clear() {
    this.client.clear();
    return this.unsynced;
  }

  registerSyncPromise(promise: Promise<unknown>) {
    this.syncPromises.push(promise);
  }

  get isSynced() {
    return this.syncPromises.length === 0;
  }

  then<FulfilledResult = PublicSyncedRemoteWebSocketMessageHandler<Schema>, RejectedResult = never>(
    onFulfilled?:
      | ((handler: PublicSyncedRemoteWebSocketMessageHandler<Schema>) => PossiblePromise<FulfilledResult>)
      | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<FulfilledResult | RejectedResult> {
    const promisesToWait = new Set(this.syncPromises);

    return Promise.all(promisesToWait)
      .then(() => {
        this.syncPromises = this.syncPromises.filter((promise) => !promisesToWait.has(promise));

        return this.isSynced ? this.synced : this.unsynced;
      })
      .then(onFulfilled, onRejected);
  }

  catch<RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<PublicSyncedRemoteWebSocketMessageHandler<Schema> | RejectedResult> {
    return this.then().catch(onRejected);
  }

  finally(onFinally?: (() => void) | null): Promise<PublicSyncedRemoteWebSocketMessageHandler<Schema>> {
    return this.then().finally(onFinally);
  }
}
