import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import WebSocketInterceptorImplementation from '../interceptor/WebSocketInterceptorImplementation';
import { WebSocketMessageHandlerDelayFactory } from './types/messages';
import {
  LocalWebSocketMessageHandler as PublicLocalWebSocketMessageHandler,
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
    );
  }

  from(sender: WebSocketInterceptorClient<Schema>) {
    this.implementation.from(sender);
    return this;
  }

  with(restriction: WebSocketMessageHandlerRestriction<RestrictedSchema>) {
    this.implementation.with(restriction);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
    return this as any; // TODO
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

  times(minNumberOfRequests: number, maxNumberOfRequests?: number) {
    this.implementation.times(minNumberOfRequests, maxNumberOfRequests);
    return this;
  }

  checkTimes() {
    this.implementation.checkTimes();
  }

  clear() {
    this.implementation.clear();
    return this;
  }

  get messages() {
    return this.implementation.messages;
  }
}
