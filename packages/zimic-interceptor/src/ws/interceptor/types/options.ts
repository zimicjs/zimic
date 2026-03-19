export type WebSocketInterceptorType = 'local' | 'remote';

export type WebSocketInterceptorPlatform = 'node' | 'browser';

export interface WebSocketInterceptorMessageSaving {
  enabled: boolean;
  safeLimit: number;
}

export interface SharedWebSocketInterceptorOptions {
  type?: WebSocketInterceptorType;
  baseURL: string;
  messageSaving?: Partial<WebSocketInterceptorMessageSaving>;
}

export interface LocalWebSocketInterceptorOptions extends SharedWebSocketInterceptorOptions {
  type?: 'local';
}

export interface RemoteWebSocketInterceptorOptions extends SharedWebSocketInterceptorOptions {
  type: 'remote';
}

export type WebSocketInterceptorOptions = LocalWebSocketInterceptorOptions | RemoteWebSocketInterceptorOptions;
