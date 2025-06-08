import { LocalHttpInterceptor, RemoteHttpInterceptor } from './public';

/**
 * Infers the schema of an {@link https://zimic.dev/docs/interceptor/api/http-interceptor `HttpInterceptor`}.
 *
 * @example
 *   import { type InferHttpInterceptorSchema } from '@zimic/http';
 *
 *   const interceptor = createHttpInterceptor<{
 *     '/users': {
 *       GET: {
 *         response: { 200: { body: User[] } };
 *       };
 *     };
 *   }>({
 *     baseURL: 'http://localhost:3000',
 *   });
 *
 *   type Schema = InferHttpInterceptorSchema<typeof interceptor>;
 *   // {
 *   //   '/users': {
 *   //     GET: {
 *   //       response: { 200: { body: User[] } };
 *   //     };
 *   //   };
 *   // }
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor `HttpInterceptor` API reference}
 */
export type InferHttpInterceptorSchema<Interceptor> =
  Interceptor extends LocalHttpInterceptor<infer Schema>
    ? Schema
    : Interceptor extends RemoteHttpInterceptor<infer Schema>
      ? Schema
      : never;
