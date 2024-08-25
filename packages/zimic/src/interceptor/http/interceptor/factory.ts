import { HttpSchema } from '@/http/types/schema';

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
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httpinterceptorcreateoptions `httpInterceptor.create(options)` API reference}
 */
export function createHttpInterceptor<Schema extends HttpSchema>(
  options: LocalHttpInterceptorOptions,
): PublicLocalHttpInterceptor<HttpSchema.ConvertToStrict<Schema>>;
export function createHttpInterceptor<Schema extends HttpSchema>(
  options: RemoteHttpInterceptorOptions,
): PublicRemoteHttpInterceptor<HttpSchema.ConvertToStrict<Schema>>;
export function createHttpInterceptor<Schema extends HttpSchema>(
  options: HttpInterceptorOptions,
):
  | PublicLocalHttpInterceptor<HttpSchema.ConvertToStrict<Schema>>
  | PublicRemoteHttpInterceptor<HttpSchema.ConvertToStrict<Schema>>;
export function createHttpInterceptor<Schema extends HttpSchema>(
  options: HttpInterceptorOptions,
):
  | PublicLocalHttpInterceptor<HttpSchema.ConvertToStrict<Schema>>
  | PublicRemoteHttpInterceptor<HttpSchema.ConvertToStrict<Schema>> {
  const type = options.type;

  if (isLocalHttpInterceptorOptions(options)) {
    return new LocalHttpInterceptor<HttpSchema.ConvertToStrict<Schema>>(options);
  } else if (isRemoteHttpInterceptorOptions(options)) {
    return new RemoteHttpInterceptor<HttpSchema.ConvertToStrict<Schema>>(options);
  }

  throw new UnknownHttpInterceptorTypeError(type);
}
