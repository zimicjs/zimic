import HttpInterceptor from './HttpInterceptor';
import { HttpInterceptorOptions } from './types/options';
import { HttpInterceptor as PublicHttpInterceptor } from './types/public';
import { HttpInterceptorSchema } from './types/schema';

/**
 * Creates an HTTP interceptor.
 *
 * @param {HttpInterceptorOptions} options The options for the interceptor.
 * @returns {HttpInterceptor} The created HTTP interceptor.
 * @see {@link https://github.com/diego-aquino/zimic#createhttpinterceptor}
 */
export function createHttpInterceptor<Schema extends HttpInterceptorSchema>(
  options: HttpInterceptorOptions,
): PublicHttpInterceptor<Schema> {
  return new HttpInterceptor<Schema>(options);
}
