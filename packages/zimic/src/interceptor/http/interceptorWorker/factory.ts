import InternalHttpInterceptorWorker from './InternalHttpInterceptorWorker';
import { HttpInterceptorWorkerOptions } from './types/options';
import { HttpInterceptorWorker } from './types/public';

/**
 * Creates an HTTP interceptor worker.
 *
 * @param {HttpInterceptorWorkerOptions} options The options for the worker.
 *
 * @returns {HttpInterceptorWorker} The created HTTP interceptor worker.
 *
 * @see {@link https://github.com/diego-aquino/zimic#createhttpinterceptorworker}
 */
export function createHttpInterceptorWorker(options: HttpInterceptorWorkerOptions): HttpInterceptorWorker {
  return new InternalHttpInterceptorWorker(options);
}
