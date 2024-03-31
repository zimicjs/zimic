import { HttpServiceSchema } from '@/http/types/schema';

import HttpInterceptor from './HttpInterceptor';
import { HttpInterceptorOptions } from './types/options';
import { HttpInterceptor as PublicHttpInterceptor } from './types/public';

/**
 * Creates an HTTP interceptor.
 *
 * @param options The options for the interceptor.
 * @returns The created HTTP interceptor.
 * @throws {InvalidHttpInterceptorWorkerPlatform} When the worker platform is invalid.
 * @see {@link https://github.com/diego-aquino/zimic#createhttpinterceptor}
 */
export function createHttpInterceptor<Schema extends HttpServiceSchema>(
  options: HttpInterceptorOptions,
): PublicHttpInterceptor<Schema> {
  return new HttpInterceptor<Schema>(options);
}
