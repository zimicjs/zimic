import { interceptorServer, InterceptorServerOptions } from '@/server';
import InterceptorServer from '@/server/InterceptorServer';
import { InterceptorServer as PublicInterceptorServer } from '@/server/types/public';

export function createInternalInterceptorServer(options?: InterceptorServerOptions) {
  return interceptorServer.create(options) satisfies PublicInterceptorServer as InterceptorServer;
}
