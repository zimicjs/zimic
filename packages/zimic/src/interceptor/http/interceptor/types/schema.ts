import { LocalHttpInterceptor } from './public';

export type ExtractHttpInterceptorSchema<Interceptor> =
  Interceptor extends LocalHttpInterceptor<infer Schema> ? Schema : never;
