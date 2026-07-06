import type { HttpMethod } from '@zimic/http';

import type { SerializedHttpRequest, SerializedResponse } from '@/utils/fetch';
import type { WebSocketSchema } from '@/utils/webSocket/types';
import type { SerializedWebSocketMessageData } from '@/ws/interceptorWorker/types/messages';

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

  'interceptors/http/responses/create': {
    event: {
      handlerId: string;
      request: SerializedHttpRequest;
    };
    reply: {
      response: SerializedResponse | null;
    };
  };

  'interceptors/http/responses/unhandled': {
    event: {
      request: SerializedHttpRequest;
    };
    reply: {
      wasLogged: boolean;
    };
  };

  'interceptors/ws/workers/commit': {
    event: WebSocketHandlerCommit;
    reply: {};
  };

  'interceptors/ws/workers/reset': {
    event: WebSocketHandlerCommit[];
    reply: {};
  };

  'interceptors/ws/clients/connect': {
    event: {
      handlerId: string;
      clientId: string;
      url: string;
    };
    reply: {
      accepted: boolean;
    };
  };

  'interceptors/ws/clients/close': {
    event: {
      clientId: string;
    };
  };

  'interceptors/ws/messages/handle': {
    event: {
      handlerId: string;
      clientId: string;
      data: SerializedWebSocketMessageData;
    };
    reply: {};
  };

  'interceptors/ws/messages/send': {
    event: {
      clientId?: string;
      handlerId?: string;
      data: SerializedWebSocketMessageData;
    };
  };
}>;
