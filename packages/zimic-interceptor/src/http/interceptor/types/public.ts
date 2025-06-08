import { HttpSchema } from '@zimic/http';

import { SyncHttpInterceptorMethodHandler, AsyncHttpInterceptorMethodHandler } from './handlers';
import { HttpInterceptorPlatform, RemoteHttpInterceptorOptions, UnhandledRequestStrategy } from './options';

/** @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor` API reference} */
export interface HttpInterceptorRequestSaving {
  /** @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor` API reference} */
  enabled: boolean;
  /** @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor` API reference} */
  safeLimit: number;
}

/** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor `HttpInterceptor` API reference} */
// The schema is still a generic type for backward compatibility.
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface HttpInterceptor<_Schema extends HttpSchema> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorbaseurl `interceptor.baseURL` API reference} */
  baseURL: string;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorrequestsaving `interceptor.requestSaving` API reference} */
  requestSaving: HttpInterceptorRequestSaving;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptoronunhandledrequest `interceptor.onUnhandledRequest` API reference} */
  onUnhandledRequest?: UnhandledRequestStrategy;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorplatform `interceptor.platform` API reference}
   */
  get platform(): HttpInterceptorPlatform | null;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorisrunning `interceptor.isRunning` API reference}
   */
  get isRunning(): boolean;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorstart `interceptor.start()` API reference} */
  start: () => Promise<void>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorstop `interceptor.stop()` API reference} */
  stop: () => Promise<void>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorchecktimes `interceptor.checkTimes()` API reference} */
  checkTimes: (() => void) | (() => Promise<void>);

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorclear `interceptor.clear()` API reference} */
  clear: (() => void) | (() => Promise<void>);
}

/**
 * @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor `HttpInterceptor` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/guides/http/local-interceptors Using local interceptors}
 */
export interface LocalHttpInterceptor<Schema extends HttpSchema> extends HttpInterceptor<Schema> {
  /** @readonly */
  get type(): 'local';

  onUnhandledRequest?: UnhandledRequestStrategy.Local;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorget `interceptor.get()` API reference} */
  get: SyncHttpInterceptorMethodHandler<Schema, 'GET'>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorpost `interceptor.post()` API reference} */
  post: SyncHttpInterceptorMethodHandler<Schema, 'POST'>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorpatch `interceptor.patch()` API reference} */
  patch: SyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorput `interceptor.put()` API reference} */
  put: SyncHttpInterceptorMethodHandler<Schema, 'PUT'>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptordelete `interceptor.delete()` API reference} */
  delete: SyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorhead `interceptor.head()` API reference} */
  head: SyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptoroptions `interceptor.options()` API reference} */
  options: SyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  checkTimes: () => void;

  clear: () => void;
}

/**
 * @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor `HttpInterceptor` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/guides/http/remote-interceptors Using remote interceptors}
 */
export interface RemoteHttpInterceptor<Schema extends HttpSchema> extends HttpInterceptor<Schema> {
  /** @readonly */
  get type(): 'remote';

  onUnhandledRequest?: UnhandledRequestStrategy.Remote;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorauth `interceptor.auth` API reference} */
  auth?: RemoteHttpInterceptorOptions['auth'];

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorget `interceptor.get()` API reference} */
  get: AsyncHttpInterceptorMethodHandler<Schema, 'GET'>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorpost `interceptor.post()` API reference} */
  post: AsyncHttpInterceptorMethodHandler<Schema, 'POST'>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorpatch `interceptor.patch()` API reference} */
  patch: AsyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorput `interceptor.put()` API reference} */
  put: AsyncHttpInterceptorMethodHandler<Schema, 'PUT'>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptordelete `interceptor.delete()` API reference} */
  delete: AsyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorhead `interceptor.head()` API reference} */
  head: AsyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptoroptions `interceptor.options()` API reference} */
  options: AsyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  checkTimes: () => Promise<void>;

  clear: () => Promise<void>;
}
