import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import WebSocketInterceptorImplementation from '../interceptor/WebSocketInterceptorImplementation';
import { WebSocketMessageHandlerDelayFactory } from './types/messages';
import {
  SyncedRemoteWebSocketMessageHandler as PublicSyncedRemoteWebSocketMessageHandler,
  PendingRemoteWebSocketMessageHandler as PublicPendingRemoteWebSocketMessageHandler,
  WebSocketMessageInterceptedCallback,
} from './types/public';
import { WebSocketMessageHandlerRestriction } from './types/restrictions';
import WebSocketMessageHandlerImplementation from './WebSocketMessageHandlerImplementation';

const UNSYNCED_PROPERTIES = new Set<string | symbol>(['then'] satisfies (keyof Promise<unknown>)[]);

export class RemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
> implements PublicPendingRemoteWebSocketMessageHandler<Schema> {
  readonly type = 'remote';

  client: WebSocketMessageHandlerImplementation<Schema>;

  private syncPromises: Promise<unknown>[] = [];

  private unsynced: this;
  private synced: this;

  constructor(interceptorImplementation: WebSocketInterceptorImplementation<Schema>) {
    this.client = new WebSocketMessageHandlerImplementation<Schema>(interceptorImplementation);
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
    return UNSYNCED_PROPERTIES.has(property);
  }

  from(sender: WebSocketInterceptorClient<Schema>) {
    this.client.from(sender);
    return this.unsynced;
  }

  with(restriction: WebSocketMessageHandlerRestriction<Schema>) {
    this.client.with(restriction);
    return this.unsynced;
  }

  delay(minMilliseconds: number | WebSocketMessageHandlerDelayFactory<Schema>, maxMilliseconds?: number) {
    this.client.delay(minMilliseconds, maxMilliseconds);
    return this.unsynced;
  }

  run(callback: WebSocketMessageInterceptedCallback<Schema>) {
    this.client.run(callback);
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
