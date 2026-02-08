import { WebSocketSchema } from '@zimic/ws';

import UnknownWebSocketInterceptorTypeError from './errors/UnknownWebSocketInterceptorTypeError';
import LocalWebSocketInterceptor from './LocalWebSocketInterceptor';
import RemoteWebSocketInterceptor from './RemoteWebSocketInterceptor';
import {
  WebSocketInterceptorOptions,
  LocalWebSocketInterceptorOptions,
  RemoteWebSocketInterceptorOptions,
} from './types/options';
import {
  LocalWebSocketInterceptor as PublicLocalWebSocketInterceptor,
  RemoteWebSocketInterceptor as PublicRemoteWebSocketInterceptor,
} from './types/public';

function isLocalWebSocketInterceptorOptions(
  options: WebSocketInterceptorOptions,
): options is LocalWebSocketInterceptorOptions {
  return options.type === undefined || options.type === 'local';
}

function isRemoteWebSocketInterceptorOptions(
  options: WebSocketInterceptorOptions,
): options is RemoteWebSocketInterceptorOptions {
  return options.type === 'remote';
}

/** @see {@link webSockets://zimic.dev/docs/interceptor/api/create-webSocket-interceptor `createWebSocketInterceptor()` API reference} */
export function createWebSocketInterceptor<Schema extends WebSocketSchema>(
  options: LocalWebSocketInterceptorOptions,
): PublicLocalWebSocketInterceptor<Schema>;
export function createWebSocketInterceptor<Schema extends WebSocketSchema>(
  options: RemoteWebSocketInterceptorOptions,
): PublicRemoteWebSocketInterceptor<Schema>;
export function createWebSocketInterceptor<Schema extends WebSocketSchema>(
  options: WebSocketInterceptorOptions,
): PublicLocalWebSocketInterceptor<Schema> | PublicRemoteWebSocketInterceptor<Schema>;
export function createWebSocketInterceptor<Schema extends WebSocketSchema>(
  options: WebSocketInterceptorOptions,
): PublicLocalWebSocketInterceptor<Schema> | PublicRemoteWebSocketInterceptor<Schema> {
  const type = options.type;

  if (isLocalWebSocketInterceptorOptions(options)) {
    return new LocalWebSocketInterceptor<Schema>(options);
  } else if (isRemoteWebSocketInterceptorOptions(options)) {
    return new RemoteWebSocketInterceptor<Schema>(options);
  }

  throw new UnknownWebSocketInterceptorTypeError(type);
}
