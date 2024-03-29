import { HttpInterceptor } from './public';

export type ExtractHttpInterceptorSchema<Interceptor> =
  Interceptor extends HttpInterceptor<infer Schema> ? Schema : never;
