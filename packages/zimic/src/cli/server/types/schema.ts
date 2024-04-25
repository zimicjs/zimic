import { HttpMethod } from '@/http/types/schema';
import { SerializedHttpRequest, SerializedResponse } from '@/utils/fetch';
import { WebSocket } from '@/websocket/types';

export type ServerWebSocketSchema = WebSocket.ServiceSchema<{
  'interceptors/workers/use/commit': {
    event: {
      url: string;
      method: HttpMethod;
    };
    reply: {};
  };

  'interceptors/workers/use/reset': {
    event?: {
      url: string;
      method: HttpMethod;
    }[];
    reply: {};
  };

  'interceptors/responses/create': {
    event: {
      request: SerializedHttpRequest;
    };
    reply: {
      response: SerializedResponse | null;
    };
  };
}>;
