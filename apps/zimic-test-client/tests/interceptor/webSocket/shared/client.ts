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
  removeEventListener: (type: 'open' | 'error', listener: ClientTestWebSocketLifecycleListener) => void;
}

export async function waitForClientTestWebSocketOpen(socket: OpeningClientTestWebSocket) {
  await new Promise<void>((resolve, reject) => {
    function removeListeners() {
      socket.removeEventListener('open', handleOpen); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('error', handleError); // eslint-disable-line @typescript-eslint/no-use-before-define
    }

    function handleOpen() {
      removeListeners();
      resolve();
    }

    function handleError(error: unknown) {
      removeListeners();
      reject(error);
    }

    socket.addEventListener('open', handleOpen);
    socket.addEventListener('error', handleError);
  });
}

// The messages of the schemas whose interceptors use a framed protocol.
interface ClientTestFramedProtocolMessage {
  type: string;
  data: unknown;
}

export interface ClientTestFramedProtocol {
  // Clients of the protocol connect to this path, such as `/socket.io`, which ends the base URL of each interceptor.
  path: string;
  create: <Message extends ClientTestFramedProtocolMessage>(options: {
    type: WebSocketInterceptorType;
    baseURL: string;
  }) => WebSocketInterceptorProtocol<Message>;
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
  framedProtocol?: ClientTestFramedProtocol;
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
