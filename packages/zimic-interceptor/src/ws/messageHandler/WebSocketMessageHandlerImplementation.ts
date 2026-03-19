import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import WebSocketInterceptorImplementation from '../interceptor/WebSocketInterceptorImplementation';
import { WebSocketMessageHandlerDelayFactory } from './types/messages';
import { WebSocketMessageHandlerRestriction } from './types/restrictions';

class WebSocketMessageHandlerImplementation<Schema extends WebSocketSchema> {
  constructor(private interceptorImplementation: WebSocketInterceptorImplementation<Schema>) {}

  from(_sender: WebSocketInterceptorClient<Schema>) {
    // TODO
  }

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

export default WebSocketMessageHandlerImplementation;
