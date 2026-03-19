import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import WebSocketInterceptorImplementation from '../interceptor/WebSocketInterceptorImplementation';
import { WebSocketMessageHandlerDelayFactory } from './types/messages';
import { WebSocketMessageInterceptedCallback } from './types/public';
import { WebSocketMessageHandlerRestriction } from './types/restrictions';

class WebSocketMessageHandlerImplementation<Schema extends WebSocketSchema> {
  constructor(private _interceptorImplementation: WebSocketInterceptorImplementation<Schema>) {}

  from(_sender: WebSocketInterceptorClient<Schema>) {
    // TODO
  }

  with(_restriction: WebSocketMessageHandlerRestriction<Schema>) {
    // TODO
  }

  delay(_minMilliseconds: number | WebSocketMessageHandlerDelayFactory<Schema>, _maxMilliseconds?: number) {
    // TODO
  }

  run(_callback: WebSocketMessageInterceptedCallback<Schema>) {
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
