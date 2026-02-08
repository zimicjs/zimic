import { WebSocketSchema, WebSocketMessageData, WebSocketClient } from '@zimic/ws';

export interface WebSocketInterceptorClient<Schema extends WebSocketSchema> extends WebSocketClient<Schema> {
  messages: InterceptedWebSocketInterceptorMessage<Schema>[];
}

export interface InterceptedWebSocketInterceptorMessage<Schema extends WebSocketSchema> {
  sender: WebSocketInterceptorClient<Schema>;
  receiver: WebSocketInterceptorClient<Schema>;
  data: WebSocketMessageData<Schema>;
}
