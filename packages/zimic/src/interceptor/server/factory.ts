import InterceptorServer from './InterceptorServer';
import { InterceptorServerOptions } from './types/options';
import { InterceptorServer as PublicInterceptorServer } from './types/public';

/**
 * Creates an {@link https://github.com/zimicjs/zimic#zimic-server interceptor server}.
 *
 * @param options The options to create the server.
 * @returns The created server.
 * @see {@link https://github.com/zimicjs/zimic#zimic-server `zimic server` API reference}
 * @see {@link https://github.com/zimicjs/zimic#remote-http-interceptors Remote HTTP Interceptors} .
 */
export function createInterceptorServer(options?: InterceptorServerOptions): PublicInterceptorServer {
  return new InterceptorServer(options);
}
