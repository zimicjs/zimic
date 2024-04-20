import { HttpMethod } from '@/http/types/schema';
import { SerializedHttpRequest, SerializedResponse } from '@/utils/fetch';
import { WebSocket } from '@/websocket/types';

export type ServerWebSocketSchema = WebSocket.ServiceSchema<{
  'interceptors/workers/commit/use': {
    event: {
      url: string;
      method: HttpMethod;
    };
  };

  'interceptors/workers/uncommit/use': {
    event?: {
      url: string;
      method: HttpMethod;
    };
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
