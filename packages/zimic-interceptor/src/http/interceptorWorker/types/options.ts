export interface LocalHttpInterceptorWorkerOptions {
  type: 'local';
}

export interface RemoteHttpInterceptorWorkerOptions {
  type: 'remote';
  serverURL: URL;
}

export type HttpInterceptorWorkerOptions = LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions;

export type HttpInterceptorWorkerType = HttpInterceptorWorkerOptions['type'];
