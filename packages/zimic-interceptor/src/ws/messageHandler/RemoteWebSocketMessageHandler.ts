import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import WebSocketInterceptorImplementation from '../interceptor/WebSocketInterceptorImplementation';
import { WebSocketMessageHandlerDelayFactory } from './types/messages';
import {
  SyncedRemoteWebSocketMessageHandler as PublicSyncedRemoteWebSocketMessageHandler,
  PendingRemoteWebSocketMessageHandler as PublicPendingRemoteWebSocketMessageHandler,
  WebSocketMessageHandlerMessageCallback,
  WebSocketMessageHandlerMessageDeclaration,
} from './types/public';
import { WebSocketMessageHandlerRestriction } from './types/restrictions';
import WebSocketMessageHandlerImplementation from './WebSocketMessageHandlerImplementation';

const UNSYNCED_PROPERTIES = new Set<string | symbol>(['then'] satisfies (keyof Promise<unknown>)[]);

export class RemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> implements PublicPendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema> {
  readonly type = 'remote';

  implementation: WebSocketMessageHandlerImplementation<Schema, RestrictedSchema>;

  private syncPromises: Promise<unknown>[] = [];

  private pending: this;
  private synced: this;

  constructor(interceptorImplementation: WebSocketInterceptorImplementation<Schema>) {
    this.implementation = new WebSocketMessageHandlerImplementation<Schema, RestrictedSchema>(
      interceptorImplementation,
    );
    this.pending = this;
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
    this.implementation.from(sender);
    return this.pending;
  }

  with(restriction: WebSocketMessageHandlerRestriction<RestrictedSchema>) {
    this.implementation.with(restriction);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
    return this.pending as any; // TODO
  }

  delay(minMilliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedSchema>, maxMilliseconds?: number) {
    this.implementation.delay(minMilliseconds, maxMilliseconds);
    return this.pending;
  }

  effect(callback: WebSocketMessageHandlerMessageCallback<Schema, RestrictedSchema>) {
    this.implementation.effect(callback);
    return this.pending;
  }

  respond(declaration: WebSocketMessageHandlerMessageDeclaration<Schema, RestrictedSchema>) {
    this.implementation.respond(declaration);
    return this.pending;
  }

  times(minNumberOfRequests: number, maxNumberOfRequests?: number) {
    this.implementation.times(minNumberOfRequests, maxNumberOfRequests);
    return this.pending;
  }

  checkTimes() {
    return new Promise<void>((resolve, reject) => {
      try {
        this.implementation.checkTimes();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  clear() {
    this.implementation.clear();
    return this.pending;
  }

  get messages() {
    return this.implementation.messages;
  }

  registerSyncPromise(promise: Promise<unknown>) {
    this.syncPromises.push(promise);
  }

  get isSynced() {
    return this.syncPromises.length === 0;
  }

  then<FulfilledResult = PublicSyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema>, RejectedResult = never>(
    onFulfilled?:
      | ((
          handler: PublicSyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema>,
        ) => PossiblePromise<FulfilledResult>)
      | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<FulfilledResult | RejectedResult> {
    const promisesToWait = new Set(this.syncPromises);

    return Promise.all(promisesToWait)
      .then(() => {
        this.syncPromises = this.syncPromises.filter((promise) => !promisesToWait.has(promise));

        return this.isSynced ? this.synced : this.pending;
      })
      .then(onFulfilled, onRejected);
  }

  catch<RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<PublicSyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema> | RejectedResult> {
    return this.then().catch(onRejected);
  }

  finally(
    onFinally?: (() => void) | null,
  ): Promise<PublicSyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema>> {
    return this.then().finally(onFinally);
  }
}
