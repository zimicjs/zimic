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

export type ClientTestWebSocketMessageListener<Schema extends WebSocketSchema> = (
  event: ClientTestWebSocketMessageEvent<Schema>,
) => void;

export interface ClientTestWebSocketCloseEvent {
  code: number;
  reason: string;
}

export type ClientTestWebSocketCloseListener = (event: ClientTestWebSocketCloseEvent) => void;

export type ClientTestWebSocketLifecycleListener = (event: unknown) => void;

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

interface OpeningClientTestWebSocket {
  addEventListener: (type: 'open' | 'error', listener: ClientTestWebSocketLifecycleListener) => void;
}

// The listeners stay registered, because a socket emits only one of these events while opening.
export async function waitForClientTestWebSocketOpen(socket: OpeningClientTestWebSocket) {
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', reject);
  });
}

interface ClientTestInterceptorProtocolMessage {
  type: string;
  data: unknown;
}

export interface ClientTestInterceptorProtocol {
  // The path clients of the protocol connect to, such as `/socket.io`, appended to each interceptor base URL.
  path: string;
  create: <
    ServerMessage extends ClientTestInterceptorProtocolMessage,
    ClientMessage extends ClientTestInterceptorProtocolMessage,
  >(options: {
    type: WebSocketInterceptorType;
    baseURL: string;
  }) => WebSocketInterceptorProtocol<ServerMessage, ClientMessage>;
}

export interface ClientTestOptions {
  platform: WebSocketInterceptorPlatform;
  defaultBinaryMessageType: typeof Blob | typeof Buffer;
  openSocket: <Schema extends WebSocketSchema>(
    url: string,
    protocols?: string | string[],
  ) => Promise<ClientTestWebSocket<Schema>>;
  // Returns before the connection settles, so tests can observe refused connections.
  createSocket: <Schema extends WebSocketSchema>(
    url: string,
    protocols?: string | string[],
  ) => ClientTestWebSocket<Schema>;
  interceptorProtocol?: ClientTestInterceptorProtocol;
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
