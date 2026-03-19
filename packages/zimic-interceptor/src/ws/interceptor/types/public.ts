import { WebSocketSchema } from '@zimic/ws';

import { LocalWebSocketMessageHandler, RemoteWebSocketMessageHandler } from '@/ws/messageHandler/types/public';

import { WebSocketInterceptorClient } from './messages';
import { WebSocketInterceptorMessageSaving, WebSocketInterceptorPlatform } from './options';

export interface WebSocketInterceptor<Schema extends WebSocketSchema> {
  baseURL: string;
  messageSaving: WebSocketInterceptorMessageSaving;

  get platform(): WebSocketInterceptorPlatform | null;
  get isRunning(): boolean;

  get server(): WebSocketInterceptorClient<Schema>;
  get clients(): WebSocketInterceptorClient<Schema>[];

  start: () => Promise<void>;
  stop: () => Promise<void>;

  checkTimes: (() => void) | (() => Promise<void>);
  clear: (() => void) | (() => Promise<void>);
}

export interface LocalWebSocketInterceptor<Schema extends WebSocketSchema> extends WebSocketInterceptor<Schema> {
  get type(): 'local';

  message: () => LocalWebSocketMessageHandler<Schema>;

  checkTimes: () => void;
  clear: () => void;
}

export interface RemoteWebSocketInterceptor<Schema extends WebSocketSchema> extends WebSocketInterceptor<Schema> {
  get type(): 'remote';

  message: () => RemoteWebSocketMessageHandler<Schema>;

  checkTimes: () => Promise<void>;
  clear: () => Promise<void>;
}
