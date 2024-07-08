import { createInterceptorServer } from '../factory';

/**
 * A namespace of interceptor server resources for handling HTTP requests.
 *
 * @see {@link https://github.com/zimicjs/zimic#zimic-server `zimic server` API reference}
 * @see {@link https://github.com/zimicjs/zimic#remote-http-interceptors Remote HTTP Interceptors} .
 */
class InterceptorServerNamespace {
  /**
   * Creates an {@link https://github.com/zimicjs/zimic#zimic-server interceptor server}.
   *
   * @param options The options to create the server.
   * @returns The created server.
   * @see {@link https://github.com/zimicjs/zimic#zimic-server `zimic server` API reference}
   * @see {@link https://github.com/zimicjs/zimic#remote-http-interceptors Remote HTTP Interceptors} .
   */
  create = createInterceptorServer;
}

export default InterceptorServerNamespace;
