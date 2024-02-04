import { HttpInterceptorWorker } from '../../interceptorWorker/types/public';

export interface HttpInterceptorOptions {
  /**
   * The {@link https://github.com/diego-aquino/zimic#httpinterceptorworker HttpInterceptorWorker} instance for the
   * interceptor. The worker must be running for this interceptor to intercept requests.
   */
  worker: HttpInterceptorWorker;

  /**
   * The base URL used by the interceptor. This URL will be prepended to any routes used by the interceptor.
   */
  baseURL: string;
}
