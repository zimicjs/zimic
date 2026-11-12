import type { SerializedHttpRequest, SerializedResponse } from '@/utils/fetch';
import type { WebSocketSchema } from '@/utils/webSocket/types';
import type { SerializedWebSocketMessageData } from '@/ws/interceptorWorker/types/messages';

export interface HttpWorkerReset {
  interceptorBaseURLs: string[];
}

export interface WebSocketInterceptorRegistration {
  id: string;
  baseURL: string;
}

export interface WebSocketWorkerReset {
  interceptors: WebSocketInterceptorRegistration[];
  clearedInterceptorIds?: string[];
}

// A rejected connection has no holders, because the server refuses its handshake.
export type WebSocketClientConnectionReply =
  { action: 'accept'; acceptedInterceptorIds: string[] } | { action: 'reject' };

export interface WebSocketClientDisconnection {
  clientId: string;
  code?: number;
  reason?: string;
}

export type InterceptorServerWebSocketSchema = WebSocketSchema<{
  'interceptors/http/workers/reset': {
    event: HttpWorkerReset;
    reply: {};
  };

  'interceptors/http/requests/handle': {
    event: {
      request: SerializedHttpRequest;
    };
    reply: {
      response: SerializedResponse | null;
      matchedSomeHandler: boolean;
      wasUnhandledRequestLogged: boolean;
    };
  };

  'interceptors/ws/workers/reset': {
    event: WebSocketWorkerReset;
    reply: {};
  };

  // Sent before the server answers the handshake of a client connection, so the worker can reject it.
  'interceptors/ws/clients/connect': {
    event: {
      interceptorIds: string[];
      clientId: string;
      url: string;
      protocols: string[];
      // The number of resets the server had processed from the worker when it sent the connection.
      numberOfResets: number;
    };
    reply: WebSocketClientConnectionReply;
  };

  'interceptors/ws/clients/close': {
    event: {
      clientId: string;
    };
  };

  // Sent by workers to close a client connection, unlike `interceptors/ws/clients/close`, which the server sends after
  // a client connection closes.
  'interceptors/ws/clients/disconnect': {
    event: WebSocketClientDisconnection;
  };

  'interceptors/ws/messages/handle': {
    event: {
      // Kept in the order of the worker's interceptors, so the last holder is the newest.
      interceptorIds: string[];
      clientId: string;
      data: SerializedWebSocketMessageData;
    };
  };

  'interceptors/ws/messages/send': {
    event: {
      clientId: string;
      data: SerializedWebSocketMessageData;
    };
  };
}>;
