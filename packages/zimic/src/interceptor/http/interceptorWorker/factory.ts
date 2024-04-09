import UnknownHttpInterceptorWorkerTypeError from './errors/UnknownHttpInterceptorWorkerTypeError';
import LocalHttpInterceptorWorker from './LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from './RemoteHttpInterceptorWorker';
import {
  HttpInterceptorWorkerOptions,
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from './types/options';
import {
  LocalHttpInterceptorWorker as PublicLocalHttpInterceptorWorker,
  RemoteHttpInterceptorWorker as PublicRemoteHttpInterceptorWorker,
  HttpInterceptorWorker,
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
export function createHttpInterceptorWorker(
  options: LocalHttpInterceptorWorkerOptions,
): PublicLocalHttpInterceptorWorker;
export function createHttpInterceptorWorker(
  options: RemoteHttpInterceptorWorkerOptions,
): PublicRemoteHttpInterceptorWorker;
export function createHttpInterceptorWorker(options: HttpInterceptorWorkerOptions): HttpInterceptorWorker;
export function createHttpInterceptorWorker(options: HttpInterceptorWorkerOptions): HttpInterceptorWorker {
  const type: unknown = options.type;

  if (areLocalHttpInterceptorOptions(options)) {
    return new LocalHttpInterceptorWorker();
  } else if (areRemoteHttpInterceptorWorkerOptions(options)) {
    return new RemoteHttpInterceptorWorker(options);
  }

  throw new UnknownHttpInterceptorWorkerTypeError(type);
}
