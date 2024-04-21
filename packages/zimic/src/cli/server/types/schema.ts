import { HttpMethod } from '@/http/types/schema';
import { SerializedHttpRequest, SerializedResponse } from '@/utils/fetch';
import { WebSocket } from '@/websocket/types';

export type ServerWebSocketSchema = WebSocket.ServiceSchema<{
  'interceptors/workers/use/commit': {
    event: {
      url: string;
      method: HttpMethod;
    };
  };

  'interceptors/workers/use/uncommit': {
    event?: {
      url: string;
      method: HttpMethod;
    }[];
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
