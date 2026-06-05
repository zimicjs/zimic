import { HttpMethod } from '@zimic/http';

import { SerializedHttpRequest, SerializedResponse } from '@/utils/fetch';
import { WebSocketSchema } from '@/utils/webSocket/types';

export interface HttpHandlerCommit {
  id: string;
  baseURL: string;
  method: HttpMethod;
  path: string;
}

export interface WebSocketHandlerCommit {
  id: string;
  baseURL: string;
}

export type InterceptorServerWebSocketSchema = WebSocketSchema<{
  'interceptors/http/workers/commit': {
    event: HttpHandlerCommit;
    reply: {};
  };

  'interceptors/http/workers/reset': {
    event: HttpHandlerCommit[];
    reply: {};
  };

  'interceptors/web-sockets/workers/commit': {
    event: WebSocketHandlerCommit;
    reply: {};
  };

  'interceptors/web-sockets/workers/reset': {
    event: WebSocketHandlerCommit[];
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

  'interceptors/responses/unhandled': {
    event: {
      request: SerializedHttpRequest;
    };
    reply: {
      wasLogged: boolean;
    };
  };
}>;
