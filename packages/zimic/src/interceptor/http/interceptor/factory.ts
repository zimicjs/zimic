import { HttpServiceSchema } from '@/http/types/schema';

import UnknownHttpInterceptorTypeError from './errors/UnknownHttpInterceptorTypeError';
import LocalHttpInterceptor from './LocalHttpInterceptor';
import RemoteHttpInterceptor from './RemoteHttpInterceptor';
import { HttpInterceptorOptions, LocalHttpInterceptorOptions, RemoteHttpInterceptorOptions } from './types/options';
import {
  LocalHttpInterceptor as PublicLocalHttpInterceptor,
  RemoteHttpInterceptor as PublicRemoteHttpInterceptor,
} from './types/public';

function isLocalHttpInterceptorOptions(options: HttpInterceptorOptions) {
  return options.type === 'local';
}

function isRemoteHttpInterceptorOptions(options: HttpInterceptorOptions) {
  return options.type === 'remote';
}

/**
 * Creates an HTTP interceptor.
 *
 * @param options The options for the interceptor.
 * @returns The created HTTP interceptor.
 * @throws {InvalidURLError} If the base URL is invalid.
 * @throws {UnsupportedURLProtocolError} If the base URL protocol is not either `http` or `https`.
 * @see {@link https://github.com/zimicjs/zimic#httpinterceptorcreate `httpInterceptor.create()` API reference}
 */
export function createHttpInterceptor<Schema extends HttpServiceSchema>(
  options: LocalHttpInterceptorOptions,
): PublicLocalHttpInterceptor<Schema>;
export function createHttpInterceptor<Schema extends HttpServiceSchema>(
  options: RemoteHttpInterceptorOptions,
): PublicRemoteHttpInterceptor<Schema>;
export function createHttpInterceptor<Schema extends HttpServiceSchema>(
  options: HttpInterceptorOptions,
): PublicLocalHttpInterceptor<Schema> | PublicRemoteHttpInterceptor<Schema>;
export function createHttpInterceptor<Schema extends HttpServiceSchema>(
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
