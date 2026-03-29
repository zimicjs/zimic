/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export type WebSocketInterceptorType = 'local' | 'remote';

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export type WebSocketInterceptorPlatform = 'node' | 'browser';

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export interface WebSocketInterceptorMessageSaving {
  enabled: boolean;
  safeLimit: number;
}

export interface SharedWebSocketInterceptorOptions {
  type?: WebSocketInterceptorType;
  baseURL: string;
  messageSaving?: Partial<WebSocketInterceptorMessageSaving>;
}

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export interface LocalWebSocketInterceptorOptions extends SharedWebSocketInterceptorOptions {
  type?: 'local';
}

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export interface RemoteWebSocketInterceptorOptions extends SharedWebSocketInterceptorOptions {
  type: 'remote';
}

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export type WebSocketInterceptorOptions = LocalWebSocketInterceptorOptions | RemoteWebSocketInterceptorOptions;
