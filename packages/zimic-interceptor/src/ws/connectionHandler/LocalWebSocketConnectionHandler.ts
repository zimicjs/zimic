import { WebSocketSchema } from '@zimic/ws';

import WebSocketInterceptorImplementation from '../interceptor/WebSocketInterceptorImplementation';
import { WebSocketConnectionHandlerDelayFactory } from './types/connections';
import {
  LocalWebSocketConnectionHandler as PublicLocalWebSocketConnectionHandler,
  WebSocketConnectionHandlerConnectionCallback,
  WebSocketConnectionHandlerResponseDeclaration,
} from './types/public';
import { WebSocketConnectionHandlerRestriction } from './types/restrictions';
import WebSocketConnectionHandlerImplementation from './WebSocketConnectionHandlerImplementation';

class LocalWebSocketConnectionHandler<
  Schema extends WebSocketSchema,
> implements PublicLocalWebSocketConnectionHandler<Schema> {
  readonly type = 'local';

  implementation: WebSocketConnectionHandlerImplementation<Schema>;

  constructor(interceptorImplementation: WebSocketInterceptorImplementation<Schema>, path: string | undefined) {
    this.implementation = new WebSocketConnectionHandlerImplementation<Schema>(interceptorImplementation, path, this);
  }

  with(restriction: WebSocketConnectionHandlerRestriction) {
    this.implementation.with(restriction);
    return this;
  }

  delay(minMilliseconds: number | WebSocketConnectionHandlerDelayFactory, maxMilliseconds?: number) {
    this.implementation.delay(minMilliseconds, maxMilliseconds);
    return this;
  }

  effect(callback: WebSocketConnectionHandlerConnectionCallback<Schema>) {
    this.implementation.effect(callback);
    return this;
  }

  respond(declaration: WebSocketConnectionHandlerResponseDeclaration) {
    this.implementation.respond(declaration);
    return this;
  }

  times(minNumberOfConnections: number, maxNumberOfConnections?: number) {
    this.implementation.times(minNumberOfConnections, maxNumberOfConnections);
    return this;
  }

  checkTimes() {
    this.implementation.checkTimes();
  }

  get path() {
    return this.implementation.path;
  }

  clear() {
    this.implementation.clear();
    return this;
  }

  get connections() {
    return this.implementation.connections;
  }
}

export default LocalWebSocketConnectionHandler;
