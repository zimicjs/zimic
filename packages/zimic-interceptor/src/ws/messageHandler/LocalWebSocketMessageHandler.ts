import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import WebSocketInterceptorImplementation from '../interceptor/WebSocketInterceptorImplementation';
import { WebSocketMessageHandlerDelayFactory } from './types/messages';
import { LocalWebSocketMessageHandler as PublicLocalWebSocketMessageHandler } from './types/public';
import { WebSocketMessageHandlerRestriction } from './types/restrictions';
import WebSocketMessageHandlerImplementation from './WebSocketMessageHandlerImplementation';

export class LocalWebSocketMessageHandler<
  Schema extends WebSocketSchema,
> implements PublicLocalWebSocketMessageHandler<Schema> {
  readonly type = 'local';

  client: WebSocketMessageHandlerImplementation<Schema>;

  constructor(interceptorImplementation: WebSocketInterceptorImplementation<Schema>) {
    this.client = new WebSocketMessageHandlerImplementation<Schema>(interceptorImplementation);
  }

  from(sender: WebSocketInterceptorClient<Schema>) {
    this.client.from(sender);
    return this;
  }

  with(restriction: WebSocketMessageHandlerRestriction<Schema>) {
    this.client.with(restriction);
    return this;
  }

  delay(minMilliseconds: number | WebSocketMessageHandlerDelayFactory<Schema>, maxMilliseconds?: number) {
    this.client.delay(minMilliseconds, maxMilliseconds);
    return this;
  }

  send(message: WebSocketMessageData<Schema>) {
    this.client.send(message);
    return this;
  }

  times(minNumberOfRequests: number, maxNumberOfRequests?: number) {
    this.client.times(minNumberOfRequests, maxNumberOfRequests);
    return this;
  }

  checkTimes() {
    this.client.checkTimes();
  }

  clear() {
    this.client.clear();
    return this;
  }
}
