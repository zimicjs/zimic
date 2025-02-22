import { createInterceptorServer } from '../factory';

/**
 * A namespace of interceptor server resources for handling HTTP requests.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server-programmatic-usage `zimic server` programmatic usage}
 * @see {@link https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors Remote HTTP Interceptors} .
 */
class InterceptorServerNamespace {
  /**
   * Creates an {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server interceptor server}.
   *
   * @param options The options to create the server.
   * @returns The created server.
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server-programmatic-usage `zimic server` programmatic usage}
   * @see {@link https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors Remote HTTP Interceptors} .
   */
  create = createInterceptorServer;
}

export default InterceptorServerNamespace;
