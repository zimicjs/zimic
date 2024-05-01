import { HttpMethod } from '@/http/types/schema';
import { JSONValue } from '@/types/json';
import { SerializedHttpRequest, SerializedResponse } from '@/utils/fetch';
import { WebSocket } from '@/websocket/types';

export type HttpHandlerCommit = JSONValue<{
  id: string;
  url: string;
  method: HttpMethod;
}>;

export type ServerWebSocketSchema = WebSocket.ServiceSchema<{
  'interceptors/workers/use/commit': {
    event: HttpHandlerCommit;
    reply: {};
  };

  'interceptors/workers/use/reset': {
    event?: HttpHandlerCommit[];
    reply: {};
  };

  'interceptors/responses/create': {
    event: {
      handlerId: string;
      request: SerializedHttpRequest;
    };
    reply: {
      response: SerializedResponse | null;
    };
  };
}>;
