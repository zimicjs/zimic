export type HttpInterceptorType = 'local' | 'remote';
export type HttpInterceptorPlatform = 'node' | 'browser';

export interface BaseHttpInterceptorOptions {
  type: HttpInterceptorType;

  /** The base URL used by the interceptor. This URL will be prepended to any paths used by the interceptor. */
  baseURL: string;
}

export interface LocalHttpInterceptorOptions extends BaseHttpInterceptorOptions {
  type: Extract<HttpInterceptorType, 'local'>;
}

export interface RemoteHttpInterceptorOptions extends BaseHttpInterceptorOptions {
  type: Extract<HttpInterceptorType, 'remote'>;
  rcpTimeout?: number;
}

/** Options to create an HTTP interceptor. */
export type HttpInterceptorOptions =
  | LocalHttpInterceptorOptions
  | RemoteHttpInterceptorOptions; /** The type of a worker. */
