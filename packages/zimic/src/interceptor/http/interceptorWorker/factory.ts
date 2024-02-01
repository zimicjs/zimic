import InternalHttpInterceptorWorker from './InternalHttpInterceptorWorker';
import { HttpInterceptorWorkerOptions } from './types/options';
import { HttpInterceptorWorker } from './types/public';

export function createHttpInterceptorWorker(options: HttpInterceptorWorkerOptions): HttpInterceptorWorker {
  return new InternalHttpInterceptorWorker(options);
}
