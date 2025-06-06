import InterceptorServer from './InterceptorServer';
import { InterceptorServerOptions } from './types/options';
import { InterceptorServer as PublicInterceptorServer } from './types/public';

/**
 * Creates an {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 *
 * @param options The options to create the server.
 * @returns The created server.
 * @see {@link https://zimic.dev/docs/interceptor/cli/server-programmatic-usage `zimic-interceptor server` programmatic usage}
 * @see {@link https://zimic.dev/docs/interceptor/guides/http/remote-interceptors Remote HTTP Interceptors} .
 */
export function createInterceptorServer(options: InterceptorServerOptions = {}): PublicInterceptorServer {
  return new InterceptorServer(options);
}
