import { HttpServiceSchema } from '@/http/types/schema';

import HttpInterceptorWorker from '../interceptorWorker/HttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../interceptorWorker/RemoteHttpInterceptorWorker';
import UnknownHttpInterceptorWorkerError from './errors/UnknownHttpInterceptorWorkerError';
import HttpInterceptor from './HttpInterceptor';
import RemoteHttpInterceptor from './RemoteHttpInterceptor';
import { HttpInterceptorOptions, LocalHttpInterceptorOptions, RemoteHttpInterceptorOptions } from './types/options';
import {
  HttpInterceptor as PublicHttpInterceptor,
  RemoteHttpInterceptor as PublicRemoteHttpInterceptor,
} from './types/public';

function areLocalHttpInterceptorOptions(options: HttpInterceptorOptions): options is LocalHttpInterceptorOptions {
  return options.worker instanceof HttpInterceptorWorker;
}

function areRemoteHttpInterceptorOptions(options: HttpInterceptorOptions): options is RemoteHttpInterceptorOptions {
  return options.worker instanceof RemoteHttpInterceptorWorker;
}

/**
 * Creates an HTTP interceptor.
 *
 * @param options The options for the interceptor.
 * @returns The created HTTP interceptor.
 * @throws {InvalidHttpInterceptorWorkerPlatform} When the worker platform is invalid.
 * @see {@link https://github.com/diego-aquino/zimic#createhttpinterceptor}
 */
export function createHttpInterceptor<Schema extends HttpServiceSchema>(
  options: LocalHttpInterceptorOptions,
): PublicHttpInterceptor<Schema>;
export function createHttpInterceptor<Schema extends HttpServiceSchema>(
  options: RemoteHttpInterceptorOptions,
): PublicRemoteHttpInterceptor<Schema>;
export function createHttpInterceptor<Schema extends HttpServiceSchema>(
  options: HttpInterceptorOptions,
): PublicHttpInterceptor<Schema> | PublicRemoteHttpInterceptor<Schema> {
  const worker: unknown = options.worker;

  if (areLocalHttpInterceptorOptions(options)) {
    return new HttpInterceptor<Schema>(options);
  } else if (areRemoteHttpInterceptorOptions(options)) {
    return new RemoteHttpInterceptor<Schema>(options);
  }

  throw new UnknownHttpInterceptorWorkerError(worker);
}
