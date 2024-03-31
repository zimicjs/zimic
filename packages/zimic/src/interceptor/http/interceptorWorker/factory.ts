import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpInterceptorWorkerOptions } from './types/options';
import { HttpInterceptorWorker as PublicHttpInterceptorWorker } from './types/public';

/**
 * Creates an HTTP interceptor worker.
 *
 * @param options The options for the worker.
 * @returns The created HTTP interceptor worker.
 * @see {@link https://github.com/diego-aquino/zimic#createhttpinterceptorworker}
 */
export function createHttpInterceptorWorker(options: HttpInterceptorWorkerOptions): PublicHttpInterceptorWorker {
  return new HttpInterceptorWorker(options);
}
