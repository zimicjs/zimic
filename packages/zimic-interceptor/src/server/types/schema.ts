import { HttpMethod } from '@zimic/http';

import { SerializedHttpRequest, SerializedResponse } from '@/utils/fetch';
import { WebSocketSchema } from '@/webSocket/types';

export interface HttpHandlerCommit {
  id: string;
  url: { base: string; full: string };
  method: HttpMethod;
}

export type InterceptorServerWebSocketSchema = WebSocketSchema<{
  'interceptors/workers/commit': {
    event: HttpHandlerCommit;
    reply: {};
  };

  'interceptors/workers/reset': {
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

  'interceptors/responses/unhandled': {
    event: {
      request: SerializedHttpRequest;
    };
    reply: {
      wasLogged: boolean;
    };
  };
}>;
