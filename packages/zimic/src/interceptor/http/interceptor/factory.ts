import { HttpServiceSchema } from '@/http/types/schema';

import UnknownHttpInterceptorTypeError from './errors/UnknownHttpInterceptorTypeError';
import LocalHttpInterceptor from './LocalHttpInterceptor';
import RemoteHttpInterceptor from './RemoteHttpInterceptor';
import { HttpInterceptorOptions, LocalHttpInterceptorOptions, RemoteHttpInterceptorOptions } from './types/options';
import {
  LocalHttpInterceptor as PublicLocalHttpInterceptor,
  RemoteHttpInterceptor as PublicRemoteHttpInterceptor,
} from './types/public';

function matchLocalHttpInterceptorOptions(options: HttpInterceptorOptions): options is LocalHttpInterceptorOptions {
  return options.type === 'local';
}

function matchRemoteHttpInterceptorOptions(options: HttpInterceptorOptions): options is RemoteHttpInterceptorOptions {
  return options.type === 'remote';
}

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

  if (matchLocalHttpInterceptorOptions(options)) {
    return new LocalHttpInterceptor<Schema>(options);
  } else if (matchRemoteHttpInterceptorOptions(options)) {
    return new RemoteHttpInterceptor<Schema>(options);
  }

  throw new UnknownHttpInterceptorTypeError(type);
}
