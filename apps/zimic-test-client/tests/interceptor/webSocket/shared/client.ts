import type {
  WebSocketInterceptorPlatform,
  WebSocketInterceptorProtocol,
  WebSocketInterceptorType,
} from '@zimic/interceptor/experimental/ws';
import type { WebSocketMessageData, WebSocketSchema, WebSocketSchemaMessage } from '@zimic/ws';
import { describe } from 'vitest';

import { declareWebSocketInterceptorTests } from './interceptor';

export interface ClientTestWebSocketMessageEvent<Schema extends WebSocketSchema> {
  data: WebSocketMessageData<WebSocketSchemaMessage<Schema>>;
}

type ClientTestWebSocketMessageListener<Schema extends WebSocketSchema> = (
  event: ClientTestWebSocketMessageEvent<Schema>,
) => void;

export interface ClientTestWebSocketCloseEvent {
  code: number;
  reason: string;
}

type ClientTestWebSocketCloseListener = (event: ClientTestWebSocketCloseEvent) => void;

type ClientTestWebSocketLifecycleListener = (event: unknown) => void;

interface ClientTestWebSocketEventListenerMethod<Schema extends WebSocketSchema> {
  (type: 'message', listener: ClientTestWebSocketMessageListener<Schema>): void;
  (type: 'close', listener: ClientTestWebSocketCloseListener): void;
  (type: 'open' | 'close' | 'error', listener: ClientTestWebSocketLifecycleListener): void;
}

export interface ClientTestWebSocket<Schema extends WebSocketSchema> {
  binaryType: string;
  readonly protocol: string;
  readonly url: string;
  readonly readyState: number;
  readonly CLOSED: number;

  send: (data: WebSocketMessageData<WebSocketSchemaMessage<Schema>>) => void;
  close: (code?: number, reason?: string) => void;
  addEventListener: ClientTestWebSocketEventListenerMethod<Schema>;
  removeEventListener: ClientTestWebSocketEventListenerMethod<Schema>;
}

export interface ClientTestOptions {
  platform: WebSocketInterceptorPlatform;
  defaultBinaryMessageType: typeof Blob | typeof Buffer;
  openSocket: <Schema extends WebSocketSchema>(
    url: string,
    protocols?: string | string[],
  ) => Promise<ClientTestWebSocket<Schema>>;
  // Starts connecting without waiting for the outcome, so tests can observe refused connections through their `open`,
  // `error`, and `close` events.
  createSocket: <Schema extends WebSocketSchema>(
    url: string,
    protocols?: string | string[],
  ) => ClientTestWebSocket<Schema>;
  // Creates the protocol of each interceptor, for clients of a framed protocol.
  createProtocol?: () => WebSocketInterceptorProtocol;
}

export interface ClientTestOptionsByWorkerType extends ClientTestOptions {
  type: WebSocketInterceptorType;
}

export function declareClientTests(options: ClientTestOptions) {
  const interceptorTypes: WebSocketInterceptorType[] = ['local', 'remote'];

  describe.each(interceptorTypes)("WebSocket interceptor (type '%s')", (type) => {
    declareWebSocketInterceptorTests({ ...options, type });
  });
}
