import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import WebSocketInterceptorImplementation from '../interceptor/WebSocketInterceptorImplementation';
import { WebSocketMessageHandlerDelayFactory } from './types/messages';
import { WebSocketMessageHandlerMessageCallback, WebSocketMessageHandlerMessageDeclaration } from './types/public';
import { WebSocketMessageHandlerRestriction } from './types/restrictions';

class WebSocketMessageHandlerImplementation<Schema extends WebSocketSchema, RestrictedSchema extends Schema = Schema> {
  constructor(private _interceptorImplementation: WebSocketInterceptorImplementation<Schema>) {}

  from(_sender: WebSocketInterceptorClient<Schema>) {
    // TODO
  }

  with(_restriction: WebSocketMessageHandlerRestriction<RestrictedSchema>) {
    // TODO
  }

  delay(_minMilliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedSchema>, _maxMilliseconds?: number) {
    // TODO
  }

  effect(_callback: WebSocketMessageHandlerMessageCallback<Schema, RestrictedSchema>) {
    // TODO
  }

  respond(_declaration: WebSocketMessageHandlerMessageDeclaration<Schema, RestrictedSchema>) {
    // TODO
  }

  times(_minNumberOfRequests: number, _maxNumberOfRequests?: number) {
    // TODO
  }

  checkTimes() {
    // TODO
  }

  clear() {
    // TODO
  }

  get messages() {
    // TODO
    return [];
  }
}

export default WebSocketMessageHandlerImplementation;
