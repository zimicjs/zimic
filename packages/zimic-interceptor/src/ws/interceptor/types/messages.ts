import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

export declare const webSocketInterceptorClientRole: unique symbol;
export declare const webSocketInterceptorServerRole: unique symbol;

export interface InterceptedWebSocketInterceptorMessage<
  MessageSchema extends WebSocketSchema,
  ClientSchema extends WebSocketSchema = MessageSchema,
> {
  sender: WebSocketInterceptorClient<ClientSchema>;
  receiver: WebSocketInterceptorServer<ClientSchema>;
  data: MessageSchema;
}

export interface WebSocketInterceptorClient<Schema extends WebSocketSchema> {
  readonly [webSocketInterceptorClientRole]: true;
  readonly url: string;
  readonly messages: readonly InterceptedWebSocketInterceptorMessage<Schema>[];
  send: (data: WebSocketMessageData<Schema>) => void;
}

export interface WebSocketInterceptorServer<Schema extends WebSocketSchema> {
  readonly [webSocketInterceptorServerRole]: true;
  readonly url: string;
  readonly messages: readonly InterceptedWebSocketInterceptorMessage<Schema>[];
  send: (data: WebSocketMessageData<Schema>) => void;
}
