import { createHttpInterceptor } from '../interceptor/factory';
import { UnhandledRequestStrategy } from '../interceptor/types/options';

export interface HttpInterceptorNamespaceDefault {
  /**
   * Sets the default strategy for unhandled requests. If a request does not start with the base URL of any
   * interceptors, this strategy will be used. If a function is provided, it will be called with the unhandled request.
   * You can override this default for specific interceptors by using `onUnhandledRequest` in
   * {@link https://github.com/diego-aquino/zimic#httpcreateinterceptor `http.createInterceptor`}.
   *
   * @param strategy The default strategy to be set.
   */
  onUnhandledRequest: (strategy: UnhandledRequestStrategy) => void;
}

/**
 * A set of interceptor resources for mocking HTTP requests.
 *
 * @see {@link https://github.com/diego-aquino/zimic#zimicinterceptor-api-reference `zimic/interceptor` API reference}
 */
export interface HttpInterceptorNamespace {
  /**
   * Creates an HTTP interceptor.
   *
   * @param options The options for the interceptor.
   * @returns The created HTTP interceptor.
   * @throws {InvalidURLError} If the base URL is invalid.
   * @throws {UnsupportedURLProtocolError} If the base URL protocol is not either `http` or `https`.
   * @see {@link https://github.com/diego-aquino/zimic#httpcreateinterceptor `http.createInterceptor` API reference}
   * @see {@link https://github.com/diego-aquino/zimic#declaring-http-service-schemas Declaring service schemas}
   */
  createInterceptor: typeof createHttpInterceptor;

  /** Default settings. */
  default: HttpInterceptorNamespaceDefault;
}
