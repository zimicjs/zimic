import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import WebSocketInterceptorImplementation from '../interceptor/WebSocketInterceptorImplementation';
import { WebSocketConnectionHandlerDelayFactory } from './types/connections';
import {
  SyncedRemoteWebSocketConnectionHandler as PublicSyncedRemoteWebSocketConnectionHandler,
  PendingRemoteWebSocketConnectionHandler as PublicPendingRemoteWebSocketConnectionHandler,
  WebSocketConnectionHandlerConnectionCallback,
  WebSocketConnectionHandlerResponseDeclaration,
} from './types/public';
import { WebSocketConnectionHandlerRestriction } from './types/restrictions';
import WebSocketConnectionHandlerImplementation from './WebSocketConnectionHandlerImplementation';

const PENDING_PROPERTIES = new Set<string | symbol>(['then'] satisfies (keyof Promise<unknown>)[]);

class RemoteWebSocketConnectionHandler<
  Schema extends WebSocketSchema,
> implements PublicPendingRemoteWebSocketConnectionHandler<Schema> {
  readonly type = 'remote';

  implementation: WebSocketConnectionHandlerImplementation<Schema>;

  private pending: this;
  private synced: this;

  constructor(interceptorImplementation: WebSocketInterceptorImplementation<Schema>, path: string | undefined) {
    this.implementation = new WebSocketConnectionHandlerImplementation<Schema>(interceptorImplementation, path, this);
    this.pending = this;
    this.synced = this.createSyncedProxy();
  }

  private createSyncedProxy() {
    return new Proxy(this, {
      has: (target, property) => {
        if (this.shouldBeHiddenPropertyWhenSynced(property)) {
          return false;
        }
        return Reflect.has(target, property);
      },

      get: (target, property) => {
        if (this.shouldBeHiddenPropertyWhenSynced(property)) {
          return undefined;
        }
        return Reflect.get(target, property);
      },
    });
  }

  private shouldBeHiddenPropertyWhenSynced(property: string | symbol) {
    return PENDING_PROPERTIES.has(property);
  }

  with(restriction: WebSocketConnectionHandlerRestriction) {
    this.implementation.with(restriction);
    return this.pending;
  }

  delay(minMilliseconds: number | WebSocketConnectionHandlerDelayFactory, maxMilliseconds?: number) {
    this.implementation.delay(minMilliseconds, maxMilliseconds);
    return this.pending;
  }

  effect(callback: WebSocketConnectionHandlerConnectionCallback<Schema>) {
    this.implementation.effect(callback);
    return this.pending;
  }

  respond(declaration: WebSocketConnectionHandlerResponseDeclaration) {
    this.implementation.respond(declaration);
    return this.pending;
  }

  times(minNumberOfConnections: number, maxNumberOfConnections?: number) {
    this.implementation.times(minNumberOfConnections, maxNumberOfConnections);
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

  get path() {
    return this.implementation.path;
  }

  clear() {
    this.implementation.clear();
    return this.pending;
  }

  get connections() {
    return this.implementation.connections;
  }

  then<FulfilledResult = PublicSyncedRemoteWebSocketConnectionHandler<Schema>, RejectedResult = never>(
    onFulfilled?:
      ((handler: PublicSyncedRemoteWebSocketConnectionHandler<Schema>) => PossiblePromise<FulfilledResult>) | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<FulfilledResult | RejectedResult> {
    // Declarations stay in this process and the interceptor registers with the server when it starts, so the handler
    // has nothing to wait for before it is synced.
    return Promise.resolve(this.synced).then(onFulfilled, onRejected);
  }

  catch<RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<PublicSyncedRemoteWebSocketConnectionHandler<Schema> | RejectedResult> {
    return this.then().catch(onRejected);
  }

  finally(onFinally?: (() => void) | null): Promise<PublicSyncedRemoteWebSocketConnectionHandler<Schema>> {
    return this.then().finally(onFinally);
  }
}

export default RemoteWebSocketConnectionHandler;
