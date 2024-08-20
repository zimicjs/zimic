import { LocalHttpInterceptor, RemoteHttpInterceptor } from './public';

/**
 * Infers the schema of an
 * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httpinterceptor `HttpInterceptor`}.
 *
 * @example
 *   import { httpInterceptor, type InferHttpInterceptorSchema } from 'zimic';
 *
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
 *   type Schema = InferHttpInterceptorSchema<typeof interceptor>;
 *   // {
 *   //   '/users': {
 *   //     GET: {
 *   //       response: { 200: { body: User[] } };
 *   //     };
 *   //   };
 *   // }
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas Declaring service schemas}
 */
export type InferHttpInterceptorSchema<Interceptor> =
  Interceptor extends LocalHttpInterceptor<infer Schema>
    ? Schema
    : Interceptor extends RemoteHttpInterceptor<infer Schema>
      ? Schema
      : never;
