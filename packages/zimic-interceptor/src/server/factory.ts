import { assertTypeOf } from '@zimic/utils/validation';

import InterceptorServer from './InterceptorServer';
import { InterceptorServerOptions } from './types/options';
import { InterceptorServer as PublicInterceptorServer } from './types/public';

/** @see {@link https://zimic.dev/docs/interceptor/api/create-interceptor-server `createInterceptorServer` API reference} */
export function createInterceptorServer(options: InterceptorServerOptions = {}): PublicInterceptorServer {
  assertTypeOf('options.hostname', options.hostname, 'string', { optional: true });
  assertTypeOf('options.port', options.port, 'number', { optional: true });
  assertTypeOf('options.logUnhandledRequests', options.logUnhandledRequests, 'boolean', { optional: true });
  assertTypeOf('options.tokensDirectory', options.tokensDirectory, 'string', { optional: true });

  return new InterceptorServer(options);
}
