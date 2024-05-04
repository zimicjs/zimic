import {
  PublicLocalHttpInterceptorWorker,
  PublicRemoteHttpInterceptorWorker,
} from '../../interceptorWorker/types/public';

export interface LocalHttpInterceptorOptions {
  /**
   * The {@link https://github.com/diego-aquino/zimic#httpinterceptorworker HttpInterceptorWorker} instance for the
   * interceptor. The worker must be running for this interceptor to intercept requests.
   */
  worker: PublicLocalHttpInterceptorWorker;

  /** The base URL used by the interceptor. This URL will be prepended to any paths used by the interceptor. */
  baseURL: string;
}

export interface RemoteHttpInterceptorOptions {
  /**
   * The {@link https://github.com/diego-aquino/zimic#httpinterceptorworker HttpInterceptorWorker} instance for the
   * interceptor. The worker must be running for this interceptor to intercept requests.
   */
  worker: PublicRemoteHttpInterceptorWorker;

  /**
   * The path prefix used by the interceptor. This prefix will be append to the mock server URL and prepended to any
   * paths used by the interceptor.
   */
  pathPrefix: string;
}

/** Options to create an HTTP interceptor. */
export type HttpInterceptorOptions = LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions;
