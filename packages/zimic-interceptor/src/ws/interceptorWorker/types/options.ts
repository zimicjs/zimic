export type WebSocketInterceptorWorkerType = 'local' | 'remote';

export interface LocalWebSocketInterceptorWorkerOptions {
  type: 'local';
}

export interface RemoteWebSocketInterceptorWorkerOptions {
  type: 'remote';
  serverURL: URL;
  auth?: { token: string };
}

export type WebSocketInterceptorWorkerOptions =
  | LocalWebSocketInterceptorWorkerOptions
  | RemoteWebSocketInterceptorWorkerOptions;
