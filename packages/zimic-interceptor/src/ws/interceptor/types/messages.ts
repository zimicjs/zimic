import { WebSocketSchema, WebSocketClient } from '@zimic/ws';

export interface InterceptedWebSocketInterceptorMessage<Schema extends WebSocketSchema> {
  sender: WebSocketInterceptorClient<Schema>;
  data: Schema;
}

export interface WebSocketInterceptorClient<Schema extends WebSocketSchema> extends WebSocketClient<Schema> {
  messages: InterceptedWebSocketInterceptorMessage<Schema>[];
}
