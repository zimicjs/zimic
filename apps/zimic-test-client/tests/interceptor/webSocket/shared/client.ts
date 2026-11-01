import type { WebSocketInterceptorPlatform, WebSocketInterceptorType } from '@zimic/interceptor/experimental/ws';
import type { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import { describe } from 'vitest';

import { declareWebSocketInterceptorTests } from './interceptor';

export interface ClientTestSocketMessageEvent<Schema extends WebSocketSchema> {
  data: WebSocketMessageData<Schema>;
}

type ClientTestSocketMessageListener<Schema extends WebSocketSchema> = (
  event: ClientTestSocketMessageEvent<Schema>,
) => void;

type ClientTestSocketLifecycleListener = (event: unknown) => void;

interface ClientTestSocketEventListenerMethod<Schema extends WebSocketSchema> {
  (type: 'message', listener: ClientTestSocketMessageListener<Schema>): void;
  (type: 'close' | 'error', listener: ClientTestSocketLifecycleListener): void;
}

// The native `WebSocket` members used by the shared cases, typed to also accept `WebSocketClient` and `ws` sockets.
export interface ClientTestSocket<Schema extends WebSocketSchema> {
  binaryType: string;
  readonly protocol: string;
  readonly url: string;
  readonly readyState: number;
  readonly CLOSED: number;

  send: (data: WebSocketMessageData<Schema>) => void;
  close: (code?: number, reason?: string) => void;
  addEventListener: ClientTestSocketEventListenerMethod<Schema>;
  removeEventListener: ClientTestSocketEventListenerMethod<Schema>;
}

export interface ClientTestOptions {
  platform: WebSocketInterceptorPlatform;
  openSocket: <Schema extends WebSocketSchema>(
    url: string,
    protocols?: string | string[],
  ) => Promise<ClientTestSocket<Schema>>;
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
