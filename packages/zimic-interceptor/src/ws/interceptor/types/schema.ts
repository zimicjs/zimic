import { LocalWebSocketInterceptor, RemoteWebSocketInterceptor } from './public';

/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
export type InferWebSocketInterceptorSchema<Interceptor> =
  Interceptor extends LocalWebSocketInterceptor<infer Schema>
    ? Schema
    : Interceptor extends RemoteWebSocketInterceptor<infer Schema>
      ? Schema
      : never;
