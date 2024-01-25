import { HttpInterceptorMethodHandler } from './handlers';
import { HttpInterceptorSchema } from './schema';

export interface HttpInterceptor<Schema extends HttpInterceptorSchema> {
  baseURL: () => string;
  isRunning: () => boolean;

  start: () => Promise<void>;
  stop: () => void;

  get: HttpInterceptorMethodHandler<Schema, 'GET'>;
  post: HttpInterceptorMethodHandler<Schema, 'POST'>;
  patch: HttpInterceptorMethodHandler<Schema, 'PATCH'>;
  put: HttpInterceptorMethodHandler<Schema, 'PUT'>;
  delete: HttpInterceptorMethodHandler<Schema, 'DELETE'>;
  head: HttpInterceptorMethodHandler<Schema, 'HEAD'>;
  options: HttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  clearHandlers: () => void;
}
