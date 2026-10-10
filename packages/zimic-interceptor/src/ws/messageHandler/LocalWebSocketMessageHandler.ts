import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import WebSocketInterceptorImplementation from '../interceptor/WebSocketInterceptorImplementation';
import { WebSocketMessageHandlerDelayFactory } from './types/messages';
import {
  LocalWebSocketMessageHandler as PublicLocalWebSocketMessageHandler,
  WebSocketMessageHandlerSchemaWithRestriction,
  WebSocketMessageHandlerMessageCallback,
  WebSocketMessageHandlerMessageDeclaration,
} from './types/public';
import { WebSocketMessageHandlerRestriction } from './types/restrictions';
import WebSocketMessageHandlerImplementation from './WebSocketMessageHandlerImplementation';

export class LocalWebSocketMessageHandler<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> implements PublicLocalWebSocketMessageHandler<Schema, RestrictedSchema> {
  readonly type = 'local';

  implementation: WebSocketMessageHandlerImplementation<Schema, RestrictedSchema>;

  constructor(interceptorImplementation: WebSocketInterceptorImplementation<Schema>) {
    this.implementation = new WebSocketMessageHandlerImplementation<Schema, RestrictedSchema>(
      interceptorImplementation,
      this,
    );
  }

  from(sender: WebSocketInterceptorClient<Schema>) {
    this.implementation.from(sender);
    return this;
  }

  with<Restriction extends WebSocketMessageHandlerRestriction<RestrictedSchema>>(
    restriction: Restriction,
  ): PublicLocalWebSocketMessageHandler<
    Schema,
    WebSocketMessageHandlerSchemaWithRestriction<RestrictedSchema, Restriction>
  > {
    this.implementation.with(restriction);
    return this as unknown as PublicLocalWebSocketMessageHandler<
      Schema,
      WebSocketMessageHandlerSchemaWithRestriction<RestrictedSchema, Restriction>
    >;
  }

  delay(minMilliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedSchema>, maxMilliseconds?: number) {
    this.implementation.delay(minMilliseconds, maxMilliseconds);
    return this;
  }

  effect(callback: WebSocketMessageHandlerMessageCallback<Schema, RestrictedSchema>) {
    this.implementation.effect(callback);
    return this;
  }

  respond(declaration: WebSocketMessageHandlerMessageDeclaration<Schema, RestrictedSchema>) {
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

  clear(): PublicLocalWebSocketMessageHandler<Schema, Schema> {
    this.implementation.clear();
    return this as unknown as PublicLocalWebSocketMessageHandler<Schema, Schema>;
  }

  get messages() {
    return this.implementation.messages;
  }
}
