import UnknownHttpInterceptorWorkerTypeError from './errors/UnknownHttpInterceptorWorkerTypeError';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import RemoteHttpInterceptorWorker from './RemoteHttpInterceptorWorker';
import {
  HttpInterceptorWorkerOptions,
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from './types/options';
import {
  HttpInterceptorWorker as PublicHttpInterceptorWorker,
  RemoteHttpInterceptorWorker as PublicRemoteHttpInterceptorWorker,
} from './types/public';

function areLocalHttpInterceptorOptions(
  options: HttpInterceptorWorkerOptions,
): options is LocalHttpInterceptorWorkerOptions {
  return options.type === 'local';
}

function areRemoteHttpInterceptorWorkerOptions(
  options: HttpInterceptorWorkerOptions,
): options is RemoteHttpInterceptorWorkerOptions {
  return options.type === 'remote';
}

/**
 * Creates an HTTP interceptor worker.
 *
 * @param options The options for the worker.
 * @returns The created HTTP interceptor worker.
 * @see {@link https://github.com/diego-aquino/zimic#createhttpinterceptorworker}
 */
export function createHttpInterceptorWorker(options: LocalHttpInterceptorWorkerOptions): PublicHttpInterceptorWorker;
export function createHttpInterceptorWorker(
  options: RemoteHttpInterceptorWorkerOptions,
): PublicRemoteHttpInterceptorWorker;
export function createHttpInterceptorWorker(
  options: HttpInterceptorWorkerOptions,
): PublicHttpInterceptorWorker | PublicRemoteHttpInterceptorWorker {
  const type: unknown = options.type;

  if (areLocalHttpInterceptorOptions(options)) {
    return new HttpInterceptorWorker();
  } else if (areRemoteHttpInterceptorWorkerOptions(options)) {
    return new RemoteHttpInterceptorWorker(options);
  }

  throw new UnknownHttpInterceptorWorkerTypeError(type);
}
