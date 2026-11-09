import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import { WebSocketInterceptorPathMessage } from '../interceptor/types/schema';
import { AnyWebSocketInterceptorImplementation } from '../interceptor/WebSocketInterceptorImplementation';
import { WebSocketMessageHandlerDelayFactory } from './types/messages';
import {
  LocalWebSocketMessageHandler as PublicLocalWebSocketMessageHandler,
  WebSocketMessageHandlerMessageCallback,
  WebSocketMessageHandlerMessageDeclaration,
  WebSocketMessageHandlerSchemaWithRestriction,
} from './types/public';
import {
  WebSocketMessageHandlerRestriction,
  WebSocketMessageHandlerRestrictionOptionsArguments,
} from './types/restrictions';
import WebSocketMessageHandlerImplementation from './WebSocketMessageHandlerImplementation';

class LocalWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> implements PublicLocalWebSocketMessageHandler<Schema, Path, RestrictedMessage> {
  readonly type = 'local';

  implementation: WebSocketMessageHandlerImplementation<Schema, Path, RestrictedMessage>;

  constructor(interceptorImplementation: AnyWebSocketInterceptorImplementation, path: Path | undefined) {
    this.implementation = new WebSocketMessageHandlerImplementation<Schema, Path, RestrictedMessage>(
      interceptorImplementation,
      path,
      this,
    );
  }

  get path() {
    return this.implementation.path;
  }

  from(sender: WebSocketInterceptorClient<Schema>) {
    this.implementation.from(sender);
    return this;
  }

  with<Restriction extends WebSocketMessageHandlerRestriction<RestrictedMessage>>(
    restriction: Restriction,
    ...options: WebSocketMessageHandlerRestrictionOptionsArguments<RestrictedMessage, Restriction>
  ): LocalWebSocketMessageHandler<
    Schema,
    Path,
    WebSocketMessageHandlerSchemaWithRestriction<RestrictedMessage, Restriction>
  > {
    this.implementation.with(restriction, ...options);

    const newThis = this as unknown as LocalWebSocketMessageHandler<
      Schema,
      Path,
      WebSocketMessageHandlerSchemaWithRestriction<RestrictedMessage, Restriction>
    >;
    return newThis;
  }

  delay(minMilliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedMessage>, maxMilliseconds?: number) {
    this.implementation.delay(minMilliseconds, maxMilliseconds);
    return this;
  }

  effect(callback: WebSocketMessageHandlerMessageCallback<Schema, Path, RestrictedMessage>) {
    this.implementation.effect(callback);
    return this;
  }

  respond(declaration: WebSocketMessageHandlerMessageDeclaration<Schema, Path, RestrictedMessage>) {
    this.implementation.respond(declaration);
    return this;
  }

  times(minNumberOfMessages: number, maxNumberOfMessages?: number) {
    this.implementation.times(minNumberOfMessages, maxNumberOfMessages);
    return this;
  }

  checkTimes() {
    this.implementation.checkTimes();
  }

  clear(): PublicLocalWebSocketMessageHandler<Schema, Path> {
    this.implementation.clear();
    return this as PublicLocalWebSocketMessageHandler<Schema, Path>;
  }

  get messages() {
    return this.implementation.messages;
  }
}

export default LocalWebSocketMessageHandler;
