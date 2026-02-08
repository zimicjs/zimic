import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import WebSocketInterceptorClient from '../interceptor/WebSocketInterceptorClient';
import { WebSocketMessageHandlerDelayFactory } from './types/messages';
import { WebSocketMessageHandlerRestriction } from './types/restrictions';

export class WebSocketMessageHandlerClient<Schema extends WebSocketSchema> {
  constructor(private interceptorClient: WebSocketInterceptorClient<Schema>) {}

  with(_restriction: WebSocketMessageHandlerRestriction<Schema>) {
    // TODO
  }

  delay(_minMilliseconds: number | WebSocketMessageHandlerDelayFactory<Schema>, _maxMilliseconds?: number) {
    // TODO
  }

  send(_message: WebSocketMessageData<Schema>) {
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
}
