import InterceptorServer from './InterceptorServer';
import { InterceptorServerOptions } from './types/options';
import { InterceptorServer as PublicInterceptorServer } from './types/public';

/** @see {@link https://zimic.dev/docs/interceptor/api/create-interceptor-server `createInterceptorServer` API reference} */
export function createInterceptorServer(options: InterceptorServerOptions = {}): PublicInterceptorServer {
  return new InterceptorServer(options);
}
