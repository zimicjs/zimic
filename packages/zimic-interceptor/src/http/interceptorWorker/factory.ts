import LocalHttpInterceptorWorker from './LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from './RemoteHttpInterceptorWorker';
import {
  HttpInterceptorWorkerOptions,
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from './types/options';

export function createHttpInterceptorWorker(options: LocalHttpInterceptorWorkerOptions): LocalHttpInterceptorWorker;
export function createHttpInterceptorWorker(options: RemoteHttpInterceptorWorkerOptions): RemoteHttpInterceptorWorker;
export function createHttpInterceptorWorker(
  options: HttpInterceptorWorkerOptions,
): LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker;
export function createHttpInterceptorWorker(
  options: HttpInterceptorWorkerOptions,
): LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker {
  if (options.type === 'local') {
    return new LocalHttpInterceptorWorker(options);
  } else {
    return new RemoteHttpInterceptorWorker(options);
  }
}
