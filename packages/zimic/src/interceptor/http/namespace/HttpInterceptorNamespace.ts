import { createHttpInterceptor } from '../interceptor/factory';
import { UnhandledRequestStrategy } from '../interceptor/types/options';
import HttpInterceptorWorkerStore from '../interceptorWorker/HttpInterceptorWorkerStore';

/** Default HTTP interceptor settings. */
export class HttpInterceptorNamespaceDefault {
  private workerStore = new HttpInterceptorWorkerStore();

  /**
   * Sets the default strategy for unhandled requests. If a request does not start with the base URL of any
   * interceptors, this strategy will be used. If a function is provided, it will be called with the unhandled request.
   * You can override this default for specific interceptors by using `onUnhandledRequest` in
   * {@link https://github.com/zimicjs/zimic#httpinterceptorcreate `httpInterceptor.create()`}.
   *
   * @param strategy The default strategy to be set.
   * @see {@link https://github.com/zimicjs/zimic#unhandled-requests Unhandled requests}
   */
  onUnhandledRequest(strategy: UnhandledRequestStrategy) {
    this.workerStore.setDefaultUnhandledRequestStrategy(strategy);
  }
}

/**
 * A namespace of interceptor resources for mocking HTTP requests.
 *
 * @see {@link https://github.com/zimicjs/zimic#zimicinterceptor-api-reference `zimic/interceptor` API reference}
 */
class HttpInterceptorNamespace {
  /**
   * Creates an HTTP interceptor.
   *
   * @param options The options for the interceptor.
   * @returns The created HTTP interceptor.
   * @throws {InvalidURLError} If the base URL is invalid.
   * @throws {UnsupportedURLProtocolError} If the base URL protocol is not either `http` or `https`.
   * @see {@link https://github.com/zimicjs/zimic#httpinterceptorcreate `httpInterceptor.create()` API reference}
   */
  create = createHttpInterceptor;

  /** Default HTTP interceptor settings. */
  default = Object.freeze(new HttpInterceptorNamespaceDefault());
}

export default HttpInterceptorNamespace;
