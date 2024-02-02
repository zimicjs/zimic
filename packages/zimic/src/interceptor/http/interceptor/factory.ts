import InternalHttpInterceptor from './InternalHttpInterceptor';
import { HttpInterceptorOptions } from './types/options';
import { HttpInterceptor } from './types/public';
import { HttpInterceptorSchema } from './types/schema';

export function createHttpInterceptor<Schema extends HttpInterceptorSchema>(
  options: HttpInterceptorOptions,
): HttpInterceptor<Schema> {
  return new InternalHttpInterceptor<Schema>(options);
}
