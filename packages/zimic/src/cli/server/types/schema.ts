import { SerializedHttpRequest, SerializedResponse } from '@/utils/fetch';
import { WebSocket } from '@/websocket/types';

export type RemoteHttpInterceptorWebSocketSchema = WebSocket.ServiceSchema<{
  'interceptors/requests/create-response': {
    event: {
      request: SerializedHttpRequest;
    };
    reply: {
      response: SerializedResponse;
    };
  };
}>;
