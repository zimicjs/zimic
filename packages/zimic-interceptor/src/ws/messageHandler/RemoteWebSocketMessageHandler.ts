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
  WebSocketMessageHandlerSchemaWithRestriction,
} from './types/public';
import {
  WebSocketMessageHandlerRestriction,
  WebSocketMessageHandlerRestrictionOptionsArguments,
} from './types/restrictions';
import WebSocketMessageHandlerImplementation from './WebSocketMessageHandlerImplementation';

const PENDING_PROPERTIES = new Set<string | symbol>(['then'] satisfies (keyof Promise<unknown>)[]);

class RemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> implements PublicPendingRemoteWebSocketMessageHandler<Schema, RestrictedSchema> {
  readonly type = 'remote';

  implementation: WebSocketMessageHandlerImplementation<Schema, RestrictedSchema>;

  private pending: this;
  private synced: this;

  constructor(interceptorImplementation: WebSocketInterceptorImplementation<Schema>) {
    this.implementation = new WebSocketMessageHandlerImplementation<Schema, RestrictedSchema>(
      interceptorImplementation,
      this,
    );
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

  from(sender: WebSocketInterceptorClient<Schema>) {
    this.implementation.from(sender);
    return this.pending;
  }

  with<Restriction extends WebSocketMessageHandlerRestriction<RestrictedSchema>>(
    restriction: Restriction,
    ...options: WebSocketMessageHandlerRestrictionOptionsArguments<RestrictedSchema, Restriction>
  ): RemoteWebSocketMessageHandler<
    Schema,
    WebSocketMessageHandlerSchemaWithRestriction<RestrictedSchema, Restriction>
  > {
    this.implementation.with(restriction, ...options);

    const pending = this.pending as unknown as RemoteWebSocketMessageHandler<
      Schema,
      WebSocketMessageHandlerSchemaWithRestriction<RestrictedSchema, Restriction>
    >;
    return pending;
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

  times(minNumberOfMessages: number, maxNumberOfMessages?: number) {
    this.implementation.times(minNumberOfMessages, maxNumberOfMessages);
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

  clear(): PublicPendingRemoteWebSocketMessageHandler<Schema, Schema> {
    this.implementation.clear();
    return this.pending as unknown as PublicPendingRemoteWebSocketMessageHandler<Schema, Schema>;
  }

  get messages() {
    return this.implementation.messages;
  }

  then<FulfilledResult = PublicSyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema>, RejectedResult = never>(
    onFulfilled?:
      | ((
          handler: PublicSyncedRemoteWebSocketMessageHandler<Schema, RestrictedSchema>,
        ) => PossiblePromise<FulfilledResult>)
      | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<FulfilledResult | RejectedResult> {
    // Declarations stay in this process and the interceptor registers with the server when it starts, so the handler
    // has nothing to wait for before it is synced.
    return Promise.resolve(this.synced).then(onFulfilled, onRejected);
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

export default RemoteWebSocketMessageHandler;
