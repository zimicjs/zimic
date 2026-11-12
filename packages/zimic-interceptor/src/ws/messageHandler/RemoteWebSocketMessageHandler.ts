import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import { WebSocketInterceptorPathMessage } from '../interceptor/types/schema';
import { AnyWebSocketInterceptorImplementation } from '../interceptor/WebSocketInterceptorImplementation';
import { WebSocketMessageHandlerDelayFactory } from './types/messages';
import {
  SyncedRemoteWebSocketMessageHandler as PublicSyncedRemoteWebSocketMessageHandler,
  PendingRemoteWebSocketMessageHandler as PublicPendingRemoteWebSocketMessageHandler,
  WebSocketMessageHandlerMessageCallback,
  WebSocketMessageHandlerMessageDeclaration,
  WebSocketMessageHandlerMessageWithRestriction,
} from './types/public';
import {
  WebSocketMessageHandlerRestriction,
  WebSocketMessageHandlerRestrictionOptionsArguments,
} from './types/restrictions';
import WebSocketMessageHandlerImplementation from './WebSocketMessageHandlerImplementation';

const PENDING_PROPERTIES = new Set<string | symbol>(['then'] satisfies (keyof Promise<unknown>)[]);

class RemoteWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> implements PublicPendingRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage> {
  readonly type = 'remote';

  implementation: WebSocketMessageHandlerImplementation<Schema, Path, RestrictedMessage>;

  private pending: this;
  private synced: this;

  constructor(interceptorImplementation: AnyWebSocketInterceptorImplementation, path: Path | undefined) {
    this.implementation = new WebSocketMessageHandlerImplementation<Schema, Path, RestrictedMessage>(
      interceptorImplementation,
      path,
      this,
    );
    this.pending = this;
    this.synced = this.createSyncedProxy();
  }

  get path() {
    return this.implementation.path;
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

  with<Restriction extends WebSocketMessageHandlerRestriction<RestrictedMessage>>(
    restriction: Restriction,
    ...options: WebSocketMessageHandlerRestrictionOptionsArguments<RestrictedMessage, Restriction>
  ): RemoteWebSocketMessageHandler<
    Schema,
    Path,
    WebSocketMessageHandlerMessageWithRestriction<RestrictedMessage, Restriction>
  > {
    this.implementation.with(restriction, ...options);

    const pending = this.pending as unknown as RemoteWebSocketMessageHandler<
      Schema,
      Path,
      WebSocketMessageHandlerMessageWithRestriction<RestrictedMessage, Restriction>
    >;
    return pending;
  }

  delay(minMilliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedMessage>, maxMilliseconds?: number) {
    this.implementation.delay(minMilliseconds, maxMilliseconds);
    return this.pending;
  }

  effect(callback: WebSocketMessageHandlerMessageCallback<Schema, Path, RestrictedMessage>) {
    this.implementation.effect(callback);
    return this.pending;
  }

  respond(declaration: WebSocketMessageHandlerMessageDeclaration<Schema, Path, RestrictedMessage>) {
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

  clear(): PublicPendingRemoteWebSocketMessageHandler<Schema, Path> {
    this.implementation.clear();
    return this.pending as PublicPendingRemoteWebSocketMessageHandler<Schema, Path>;
  }

  get messages() {
    return this.implementation.messages;
  }

  then<
    FulfilledResult = PublicSyncedRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>,
    RejectedResult = never,
  >(
    onFulfilled?:
      | ((
          handler: PublicSyncedRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>,
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
  ): Promise<PublicSyncedRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage> | RejectedResult> {
    return this.then().catch(onRejected);
  }

  finally(
    onFinally?: (() => void) | null,
  ): Promise<PublicSyncedRemoteWebSocketMessageHandler<Schema, Path, RestrictedMessage>> {
    return this.then().finally(onFinally);
  }
}

export default RemoteWebSocketMessageHandler;
