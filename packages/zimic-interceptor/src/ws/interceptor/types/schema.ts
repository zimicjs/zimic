import { LocalWebSocketInterceptor, RemoteWebSocketInterceptor } from './public';

export type InferWebSocketInterceptorSchema<Interceptor> =
  Interceptor extends LocalWebSocketInterceptor<infer Schema>
    ? Schema
    : Interceptor extends RemoteWebSocketInterceptor<infer Schema>
      ? Schema
      : never;
