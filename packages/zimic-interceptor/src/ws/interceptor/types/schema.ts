import { LocalWebSocketInterceptor, RemoteWebSocketInterceptor } from './public';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Infers the schema of a `WebSocketInterceptor`. Resolves to `never` if the type is not a local or remote WebSocket
 * interceptor.
 *
 * @example
 *   import {
 *     createWebSocketInterceptor,
 *     type InferWebSocketInterceptorSchema,
 *   } from '@zimic/interceptor/experimental/ws';
 *   import { type WebSocketSchema } from '@zimic/ws';
 *
 *   const interceptor = createWebSocketInterceptor<WebSocketSchema<{ type: 'ping' } | { type: 'pong' }>>({
 *     baseURL: 'ws://localhost:3000',
 *   });
 *
 *   type Schema = InferWebSocketInterceptorSchema<typeof interceptor>;
 *   // WebSocketSchema<{ type: 'ping' } | { type: 'pong' }>
 */
export type InferWebSocketInterceptorSchema<Interceptor> =
  Interceptor extends LocalWebSocketInterceptor<infer Schema>
    ? Schema
    : Interceptor extends RemoteWebSocketInterceptor<infer Schema>
      ? Schema
      : never;
