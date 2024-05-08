import UnknownHttpInterceptorWorkerTypeError from './errors/UnknownHttpInterceptorWorkerTypeError';
import LocalHttpInterceptorWorker from './LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from './RemoteHttpInterceptorWorker';
import {
  HttpInterceptorWorkerOptions,
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from './types/options';

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

export function createHttpInterceptorWorker(options: LocalHttpInterceptorWorkerOptions): LocalHttpInterceptorWorker;
export function createHttpInterceptorWorker(options: RemoteHttpInterceptorWorkerOptions): RemoteHttpInterceptorWorker;
export function createHttpInterceptorWorker(
  options: HttpInterceptorWorkerOptions,
): LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker;
export function createHttpInterceptorWorker(
  options: HttpInterceptorWorkerOptions,
): LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker {
  const type = options.type;

  if (areLocalHttpInterceptorOptions(options)) {
    return new LocalHttpInterceptorWorker(options);
  } else if (areRemoteHttpInterceptorWorkerOptions(options)) {
    return new RemoteHttpInterceptorWorker(options);
  }

  throw new UnknownHttpInterceptorWorkerTypeError(type);
}
