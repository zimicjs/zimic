import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { LocalWebSocketMessageHandler, RemoteWebSocketMessageHandler } from '@/ws/messageHandler/types/public';

import { WebSocketInterceptorClient, WebSocketInterceptorServer } from './messages';
import {
  RemoteWebSocketInterceptorOptions,
  WebSocketInterceptorMessageSaving,
  WebSocketInterceptorPlatform,
} from './options';

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export interface WebSocketInterceptor<Schema extends WebSocketSchema> {
  baseURL: string;
  messageSaving: WebSocketInterceptorMessageSaving;

  get platform(): WebSocketInterceptorPlatform | null;
  get isRunning(): boolean;

  get server(): WebSocketInterceptorServer<Schema>;
  get clients(): readonly WebSocketInterceptorClient<Schema>[];

  start: () => Promise<void>;
  stop: () => Promise<void>;

  checkTimes: () => PossiblePromise<void>;
  clear: () => PossiblePromise<void>;
}

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export interface LocalWebSocketInterceptor<Schema extends WebSocketSchema> extends WebSocketInterceptor<Schema> {
  get type(): 'local';

  message: () => LocalWebSocketMessageHandler<Schema>;

  checkTimes: () => void;
  clear: () => void;
}

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export interface RemoteWebSocketInterceptor<Schema extends WebSocketSchema> extends WebSocketInterceptor<Schema> {
  get type(): 'remote';

  auth?: RemoteWebSocketInterceptorOptions['auth'];

  message: () => RemoteWebSocketMessageHandler<Schema>;

  checkTimes: () => Promise<void>;
  clear: () => Promise<void>;
}
