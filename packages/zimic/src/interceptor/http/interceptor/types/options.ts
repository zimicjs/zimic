/**
 * An type of an HTTP interceptor.
 *
 * @see {@link https://github.com/diego-aquino/zimic#httpinterceptor `HttpInterceptor` API reference}
 */
export type HttpInterceptorType = 'local' | 'remote';

/**
 * The platform where the HTTP interceptor is running.
 *
 * @see {@link https://github.com/diego-aquino/zimic#http-interceptorplatform `interceptor.platform()` API reference}
 */
export type HttpInterceptorPlatform = 'node' | 'browser';

export interface BaseHttpInterceptorOptions {
  type: HttpInterceptorType;

  /** The base URL used by the interceptor. This URL will be prepended to any paths used by the interceptor. */
  baseURL: string | URL;
}

/** The options to create a local HTTP interceptor. */
export interface LocalHttpInterceptorOptions extends BaseHttpInterceptorOptions {
  type: 'local';
}

/** The options to create a remote HTTP interceptor. */
export interface RemoteHttpInterceptorOptions extends BaseHttpInterceptorOptions {
  type: 'remote';
}

/** The options to create an HTTP interceptor. */
export type HttpInterceptorOptions = LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions;
