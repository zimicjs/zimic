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

export interface HttpWorkerReset {
  interceptorBaseURLs: string[];
  handlers: HttpHandlerCommit[];
}

export interface WebSocketHandlerCommit {
  id: string;
  baseURL: string;
}

export interface WebSocketHandlerReset {
  handlers: WebSocketHandlerCommit[];
  clearedHandlerIds?: string[];
}

export type InterceptorServerWebSocketSchema = WebSocketSchema<{
  'interceptors/http/workers/commit': {
    event: HttpHandlerCommit;
    reply: {};
  };

  'interceptors/http/workers/reset': {
    event: HttpWorkerReset;
    reply: {};
  };

  'interceptors/http/responses/create': {
    event: {
      handlerId: string;
      request: SerializedHttpRequest;
    };
    reply: {
      response: SerializedResponse | null;
      error?: boolean;
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
    event: WebSocketHandlerReset;
    reply: {};
  };

  'interceptors/ws/clients/connect': {
    event: {
      handlerIds: string[];
      clientId: string;
      url: string;
      // The number of resets the server had processed from the worker when it sent the connection.
      numberOfResets: number;
    };
    reply: {
      acceptedHandlerIds: string[];
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
    reply: {
      handled: boolean;
      error?: boolean;
    };
  };

  'interceptors/ws/messages/unhandled': {
    event: {
      // Kept in the order of the worker's handlers, so the last holder is the newest.
      handlerIds: string[];
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
