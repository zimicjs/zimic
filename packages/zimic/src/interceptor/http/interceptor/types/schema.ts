import { PublicLocalHttpInterceptor } from './public';

export type ExtractHttpInterceptorSchema<Interceptor> =
  Interceptor extends PublicLocalHttpInterceptor<infer Schema> ? Schema : never;
