import { HttpSchema } from '@zimic/http';

import UnknownHttpInterceptorTypeError from './errors/UnknownHttpInterceptorTypeError';
import LocalHttpInterceptor from './LocalHttpInterceptor';
import RemoteHttpInterceptor from './RemoteHttpInterceptor';
import { HttpInterceptorOptions, LocalHttpInterceptorOptions, RemoteHttpInterceptorOptions } from './types/options';
import {
  LocalHttpInterceptor as PublicLocalHttpInterceptor,
  RemoteHttpInterceptor as PublicRemoteHttpInterceptor,
} from './types/public';

function isLocalHttpInterceptorOptions(options: HttpInterceptorOptions): options is LocalHttpInterceptorOptions {
  return options.type === undefined || options.type === 'local';
}

function isRemoteHttpInterceptorOptions(options: HttpInterceptorOptions): options is RemoteHttpInterceptorOptions {
  return options.type === 'remote';
}

/** @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor()` API reference} */
export function createHttpInterceptor<Schema extends HttpSchema>(
  options: LocalHttpInterceptorOptions,
): PublicLocalHttpInterceptor<Schema>;
export function createHttpInterceptor<Schema extends HttpSchema>(
  options: RemoteHttpInterceptorOptions,
): PublicRemoteHttpInterceptor<Schema>;
export function createHttpInterceptor<Schema extends HttpSchema>(
  options: HttpInterceptorOptions,
): PublicLocalHttpInterceptor<Schema> | PublicRemoteHttpInterceptor<Schema>;
export function createHttpInterceptor<Schema extends HttpSchema>(
  options: HttpInterceptorOptions,
): PublicLocalHttpInterceptor<Schema> | PublicRemoteHttpInterceptor<Schema> {
  const type = options.type;

  if (isLocalHttpInterceptorOptions(options)) {
    return new LocalHttpInterceptor<Schema>(options);
  } else if (isRemoteHttpInterceptorOptions(options)) {
    return new RemoteHttpInterceptor<Schema>(options);
  }

  throw new UnknownHttpInterceptorTypeError(type);
}
