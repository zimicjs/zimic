import { WebSocketSchema, WebSocketClient } from '@zimic/ws';

export interface InterceptedWebSocketInterceptorMessage<
  MessageSchema extends WebSocketSchema,
  ClientSchema extends WebSocketSchema = MessageSchema,
> {
  sender: WebSocketInterceptorClient<ClientSchema>;
  receiver: WebSocketInterceptorClient<ClientSchema>;
  data: MessageSchema;
}

export interface WebSocketInterceptorClient<Schema extends WebSocketSchema> extends Omit<
  WebSocketClient<Schema>,
  'send'
> {
  messages: InterceptedWebSocketInterceptorMessage<Schema>[];
  send: (data: Schema) => void;
}
