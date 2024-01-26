import { HttpInterceptorOptions } from './options';
import { HttpInterceptor } from './public';
import { HttpInterceptorSchema } from './schema';

export type HttpInterceptorFactory = <Schema extends HttpInterceptorSchema>(
  options: HttpInterceptorOptions,
) => HttpInterceptor<Schema>;
