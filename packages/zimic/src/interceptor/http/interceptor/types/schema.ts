import { LocalHttpInterceptor, RemoteHttpInterceptor } from './public';

/**
 * Extracts the schema of an
 * {@link https://github.com/zimicjs/zimic/wiki/API-reference:-%60zimic-interceptor-http%60#httpinterceptor `HttpInterceptor`}.
 *
 * @example
 *   const interceptor = httpInterceptor.create<{
 *     '/users': {
 *       GET: {
 *         response: { 200: { body: User[] } };
 *       };
 *     };
 *   }>({
 *     type: 'local',
 *     baseURL: 'http://localhost:3000',
 *   });
 *
 *   type Schema = ExtractHttpInterceptorSchema<typeof interceptor>;
 *   // {
 *   //   '/users': {
 *   //     GET: {
 *   //       response: { 200: { body: User[] } };
 *   //     };
 *   //   };
 *   // }
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/API-reference:-Declaring-HTTP-service-schemas Declaring service schemas}
 */
export type ExtractHttpInterceptorSchema<Interceptor> =
  Interceptor extends LocalHttpInterceptor<infer Schema>
    ? Schema
    : Interceptor extends RemoteHttpInterceptor<infer Schema>
      ? Schema
      : never;
