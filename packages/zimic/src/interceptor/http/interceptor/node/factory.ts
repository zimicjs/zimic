import { HttpInterceptorOptions } from '../types/options';
import { HttpInterceptor } from '../types/public';
import { HttpInterceptorSchema } from '../types/schema';
import InternalNodeHttpInterceptor from './InternalNodeHttpInterceptor';

function createNodeHttpInterceptor<Schema extends HttpInterceptorSchema>(
  options: HttpInterceptorOptions,
): HttpInterceptor<Schema> {
  return new InternalNodeHttpInterceptor<Schema>(options);
}

export default createNodeHttpInterceptor;
