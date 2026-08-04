import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import type {
  InterceptedWebSocketInterceptorMessage,
  WebSocketInterceptorClient,
  WebSocketInterceptorServer,
  webSocketInterceptorClientRole,
  webSocketInterceptorServerRole,
} from './types/messages';

export interface InternalWebSocketInterceptorClient<
  Schema extends WebSocketSchema,
> extends WebSocketInterceptorClient<Schema> {
  messages: InterceptedWebSocketInterceptorMessage<Schema>[];
}

export interface InternalWebSocketInterceptorServer<
  Schema extends WebSocketSchema,
> extends WebSocketInterceptorServer<Schema> {
  messages: InterceptedWebSocketInterceptorMessage<Schema>[];
}

class WebSocketInterceptorClientImplementation<
  Schema extends WebSocketSchema,
> implements InternalWebSocketInterceptorClient<Schema> {
  #sendMessage: (data: WebSocketMessageData<Schema>) => void;

  declare readonly [webSocketInterceptorClientRole]: true;

  readonly messages: InterceptedWebSocketInterceptorMessage<Schema>[] = [];

  constructor(
    readonly url: string,
    sendMessage: (data: WebSocketMessageData<Schema>) => void,
  ) {
    this.#sendMessage = sendMessage;
  }

  send(data: WebSocketMessageData<Schema>) {
    this.#sendMessage(data);
  }
}

class WebSocketInterceptorServerImplementation<
  Schema extends WebSocketSchema,
> implements InternalWebSocketInterceptorServer<Schema> {
  #getURL: () => string;
  #sendMessage: (data: WebSocketMessageData<Schema>) => void;

  declare readonly [webSocketInterceptorServerRole]: true;

  readonly messages: InterceptedWebSocketInterceptorMessage<Schema>[] = [];

  constructor(getURL: () => string, sendMessage: (data: WebSocketMessageData<Schema>) => void) {
    this.#getURL = getURL;
    this.#sendMessage = sendMessage;
  }

  get url() {
    return this.#getURL();
  }

  send(data: WebSocketMessageData<Schema>) {
    this.#sendMessage(data);
  }
}

export function createWebSocketInterceptorClient<Schema extends WebSocketSchema>(
  url: string,
  send: (data: WebSocketMessageData<Schema>) => void,
) {
  return new WebSocketInterceptorClientImplementation(url, send);
}

export function createWebSocketInterceptorServer<Schema extends WebSocketSchema>(
  getURL: () => string,
  send: (data: WebSocketMessageData<Schema>) => void,
) {
  return new WebSocketInterceptorServerImplementation(getURL, send);
}
