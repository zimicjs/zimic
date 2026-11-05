import { HttpSchema } from '@zimic/http';
import { assertEnum, assertTypeOf } from '@zimic/utils/validation';

import UnknownHttpInterceptorTypeError from './errors/UnknownHttpInterceptorTypeError';
import LocalHttpInterceptor from './LocalHttpInterceptor';
import RemoteHttpInterceptor from './RemoteHttpInterceptor';
import {
  HttpInterceptorOptions,
  LocalHttpInterceptorOptions,
  RemoteHttpInterceptorOptions,
  UnhandledRequestStrategy,
} from './types/options';
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
  assertTypeOf('options.baseURL', options.baseURL, 'string');
  assertTypeOf('options.requestSaving', options.requestSaving, 'object', { optional: true });
  assertTypeOf('options.requestSaving.enabled', options.requestSaving?.enabled, 'boolean', { optional: true });
  assertTypeOf('options.requestSaving.safeLimit', options.requestSaving?.safeLimit, 'number', { optional: true });

  assertTypeOf('options.onUnhandledRequest', options.onUnhandledRequest, ['object', 'function'], { optional: true });

  if (typeof options.onUnhandledRequest === 'object') {
    const validActions: UnhandledRequestStrategy.Action[] = isRemoteHttpInterceptorOptions(options)
      ? ['reject']
      : ['bypass', 'reject'];

    assertEnum('options.onUnhandledRequest.action', options.onUnhandledRequest.action, validActions);
    assertTypeOf('options.onUnhandledRequest.log', options.onUnhandledRequest.log, 'boolean', { optional: true });
  }

  const type = options.type;

  if (isLocalHttpInterceptorOptions(options)) {
    return new LocalHttpInterceptor<Schema>(options);
  } else if (isRemoteHttpInterceptorOptions(options)) {
    return new RemoteHttpInterceptor<Schema>(options);
  }

  throw new UnknownHttpInterceptorTypeError(type);
}
