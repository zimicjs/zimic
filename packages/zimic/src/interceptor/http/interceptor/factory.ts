import { HttpServiceSchema } from '@/http/types/schema';

import LocalHttpInterceptorWorker from '../interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../interceptorWorker/RemoteHttpInterceptorWorker';
import UnknownHttpInterceptorWorkerError from './errors/UnknownHttpInterceptorWorkerError';
import LocalHttpInterceptor from './LocalHttpInterceptor';
import RemoteHttpInterceptor from './RemoteHttpInterceptor';
import { HttpInterceptorOptions, LocalHttpInterceptorOptions, RemoteHttpInterceptorOptions } from './types/options';
import { PublicHttpInterceptor, PublicLocalHttpInterceptor, PublicRemoteHttpInterceptor } from './types/public';

function areLocalHttpInterceptorOptions(options: HttpInterceptorOptions): options is LocalHttpInterceptorOptions {
  return options.worker instanceof LocalHttpInterceptorWorker;
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
): PublicLocalHttpInterceptor<Schema>;
export function createHttpInterceptor<Schema extends HttpServiceSchema>(
  options: RemoteHttpInterceptorOptions,
): PublicRemoteHttpInterceptor<Schema>;
export function createHttpInterceptor<Schema extends HttpServiceSchema>(
  options: HttpInterceptorOptions,
): PublicHttpInterceptor<Schema>;
export function createHttpInterceptor<Schema extends HttpServiceSchema>(
  options: HttpInterceptorOptions,
): PublicHttpInterceptor<Schema> {
  const worker = options.worker;

  if (areLocalHttpInterceptorOptions(options)) {
    return new LocalHttpInterceptor<Schema>(options);
  } else if (areRemoteHttpInterceptorOptions(options)) {
    return new RemoteHttpInterceptor<Schema>(options);
  }

  throw new UnknownHttpInterceptorWorkerError(worker);
}
