import { createHttpInterceptor } from '../interceptor/factory';
import { UnhandledRequestStrategy } from '../interceptor/types/options';
import HttpInterceptorWorkerStore from '../interceptorWorker/HttpInterceptorWorkerStore';

/** Default HTTP interceptor settings. */
export class HttpInterceptorNamespaceDefault {
  local: {
    /**
     * Gets or sets the default strategy for unhandled requests. If a request does not start with the base URL of any
     * interceptors, this strategy will be used. If a function is provided, it will be called with the unhandled
     * request.
     *
     * You can override this default for specific interceptors by using `onUnhandledRequest` in
     * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httpinterceptorcreateoptions `httpInterceptor.create(options)`}.
     *
     * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
     */
    get onUnhandledRequest(): UnhandledRequestStrategy.Local;
    set onUnhandledRequest(strategy: UnhandledRequestStrategy.Local);
  };

  remote: {
    /**
     * Gets or sets the default strategy for unhandled requests. If a request does not start with the base URL of any
     * interceptors, this strategy will be used. If a function is provided, it will be called with the unhandled
     * request.
     *
     * You can override this default for specific interceptors by using `onUnhandledRequest` in
     * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httpinterceptorcreateoptions `httpInterceptor.create(options)`}.
     *
     * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
     */
    get onUnhandledRequest(): UnhandledRequestStrategy.Remote;
    set onUnhandledRequest(strategy: UnhandledRequestStrategy.Remote);
  };

  constructor() {
    const workerStore = new HttpInterceptorWorkerStore();

    this.local = {
      get onUnhandledRequest() {
        return workerStore.defaultOnUnhandledRequest('local');
      },
      set onUnhandledRequest(strategy: UnhandledRequestStrategy.Local) {
        workerStore.setDefaultOnUnhandledRequest('local', strategy);
      },
    };

    this.remote = {
      get onUnhandledRequest() {
        return workerStore.defaultOnUnhandledRequest('remote');
      },
      set onUnhandledRequest(strategy: UnhandledRequestStrategy.Remote) {
        workerStore.setDefaultOnUnhandledRequest('remote', strategy);
      },
    };
  }
}

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

  /** Default HTTP interceptor settings. */
  default = Object.freeze(new HttpInterceptorNamespaceDefault());
}

export default HttpInterceptorNamespace;
