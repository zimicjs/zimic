import HttpInterceptor from '../HttpInterceptor';
import { HttpInterceptorOptions } from '../types/options';
import { HttpInterceptorSchema } from '../types/schema';
import InternalBrowserHttpInterceptor from './InternalBrowserHttpInterceptor';

function createBrowserHttpInterceptor<Schema extends HttpInterceptorSchema>(
  options: HttpInterceptorOptions,
): HttpInterceptor<Schema> {
  return new InternalBrowserHttpInterceptor<Schema>(options);
}

export default createBrowserHttpInterceptor;
