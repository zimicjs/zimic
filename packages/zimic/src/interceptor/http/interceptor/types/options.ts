/**
 * An type of an HTTP interceptor.
 *
 * @see {@link https://github.com/diego-aquino/zimic#httpinterceptor `HttpInterceptor` API reference}
 */
export type HttpInterceptorType = 'local' | 'remote';

/**
 * The platform where an HTTP interceptor is running.
 *
 * @see {@link https://github.com/diego-aquino/zimic#http-interceptorplatform `interceptor.platform()` API reference}
 */
export type HttpInterceptorPlatform = 'node' | 'browser';

export interface BaseHttpInterceptorOptions {
  /** The type of the HTTP interceptor. */
  type: HttpInterceptorType;

  /**
   * Represents the URL that should be matched by the interceptor. Any request starting with this base URL will be
   * intercepted if a matching {@link https://github.com/diego-aquino/zimic#httprequesthandler handler} exists.
   *
   * For {@link https://github.com/diego-aquino/zimic#remote-http-interceptors remote interceptors}, this base URL should
   * point to an {@link https://github.com/diego-aquino/zimic#zimic-server interceptor server}. It may include additional
   * paths to differentiate between conflicting mocks.
   */
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

/**
 * The options to create an HTTP interceptor.
 *
 * @see {@link https://github.com/diego-aquino/zimic#httpcreateinterceptor `http.createInterceptor()` API reference}
 */
export type HttpInterceptorOptions = LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions;
