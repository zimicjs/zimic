import { createHttpInterceptor } from '../interceptor/factory';

/**
 * A namespace of interceptor resources for mocking HTTP requests.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httpinterceptor `HttpInterceptor` API reference}
 */
class HttpInterceptorNamespace {
  /**
   * Creates an HTTP interceptor.
   *
   * @param options The options for the interceptor.
   * @returns The created HTTP interceptor.
   * @throws {InvalidURLError} If the base URL is invalid.
   * @throws {UnsupportedURLProtocolError} If the base URL protocol is not either `http` or `https`.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httpinterceptorcreateoptions `httpInterceptor.create(options)` API reference}
   */
  create = createHttpInterceptor;
}

export default HttpInterceptorNamespace;
