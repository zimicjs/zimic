import { HttpInterceptor } from './public';

/**
 * A utility type to extract the schema of an HTTP interceptor.
 *
 * @see {@link https://github.com/diego-aquino/zimic#declaring-service-schemas Declaring service schemas}
 */
export type ExtractHttpInterceptorSchema<Interceptor> =
  Interceptor extends HttpInterceptor<infer Schema> ? Schema : never;
