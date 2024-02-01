import { HttpInterceptorMethodHandler } from './handlers';
import { HttpInterceptorSchema } from './schema';

export interface HttpInterceptor<Schema extends HttpInterceptorSchema> {
  get: HttpInterceptorMethodHandler<Schema, 'GET'>;
  post: HttpInterceptorMethodHandler<Schema, 'POST'>;
  patch: HttpInterceptorMethodHandler<Schema, 'PATCH'>;
  put: HttpInterceptorMethodHandler<Schema, 'PUT'>;
  delete: HttpInterceptorMethodHandler<Schema, 'DELETE'>;
  head: HttpInterceptorMethodHandler<Schema, 'HEAD'>;
  options: HttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  clear: () => void;
}
