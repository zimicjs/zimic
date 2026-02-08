import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import WebSocketInterceptorClient from '../interceptor/WebSocketInterceptorClient';
import { WebSocketMessageHandlerDelayFactory } from './types/messages';
import { LocalWebSocketMessageHandler as PublicLocalWebSocketMessageHandler } from './types/public';
import { WebSocketMessageHandlerRestriction } from './types/restrictions';
import { WebSocketMessageHandlerClient } from './WebSocketMessageHandlerClient';

export class LocalWebSocketMessageHandler<
  Schema extends WebSocketSchema,
> implements PublicLocalWebSocketMessageHandler<Schema> {
  readonly type = 'local';

  client: WebSocketMessageHandlerClient<Schema>;

  constructor(interceptorClient: WebSocketInterceptorClient<Schema>) {
    this.client = new WebSocketMessageHandlerClient<Schema>(interceptorClient);
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
