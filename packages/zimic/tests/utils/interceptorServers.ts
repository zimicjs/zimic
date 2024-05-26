import { InterceptorServerOptions, createInterceptorServer } from '@/interceptor/server';
import InterceptorServer from '@/interceptor/server/InterceptorServer';
import { InterceptorServer as PublicInterceptorServer } from '@/interceptor/server/types/public';

export function createInternalInterceptorServer(options?: InterceptorServerOptions) {
  return createInterceptorServer(options) satisfies PublicInterceptorServer as InterceptorServer;
}
