import { HttpInterceptorFactory } from '../types/factory';
import { HttpInterceptorOptions } from '../types/options';
import { HttpInterceptor } from '../types/public';
import { HttpInterceptorSchema } from '../types/schema';
import InternalBrowserHttpInterceptor from './InternalBrowserHttpInterceptor';

function createBrowserHttpInterceptor<Schema extends HttpInterceptorSchema>(
  options: HttpInterceptorOptions,
): HttpInterceptor<Schema> {
  return new InternalBrowserHttpInterceptor<Schema>(options);
}

export default createBrowserHttpInterceptor satisfies HttpInterceptorFactory;
