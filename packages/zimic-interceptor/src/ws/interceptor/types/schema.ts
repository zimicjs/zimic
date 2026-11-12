import { IfNever } from '@zimic/utils/types';
import {
  LiteralWebSocketSchemaPathFromNonLiteral,
  WebSocketSchema,
  WebSocketSchemaMessage,
  WebSocketSchemaPath,
} from '@zimic/ws';

import { LocalWebSocketInterceptor, RemoteWebSocketInterceptor } from './public';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Infers the schema of a {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor `WebSocketInterceptor`}.
 * Resolves to `never` if the type is not a local or remote WebSocket interceptor.
 *
 * @example
 *   import {
 *     createWebSocketInterceptor,
 *     type InferWebSocketInterceptorSchema,
 *   } from '@zimic/interceptor/experimental/ws';
 *   import { type WebSocketSchema } from '@zimic/ws';
 *
 *   const interceptor = createWebSocketInterceptor<
 *     WebSocketSchema<{ '/rooms/:roomId': { message: { type: 'ping' } | { type: 'pong' } } }>
 *   >({
 *     baseURL: 'ws://localhost:3000',
 *   });
 *
 *   type Schema = InferWebSocketInterceptorSchema<typeof interceptor>;
 *   // WebSocketSchema<{ '/rooms/:roomId': { message: { type: 'ping' } | { type: 'pong' } } }>
 *
 * @see {@link https://zimic.dev/docs/ws/guides/schemas#using-schemas-with-interceptors Using schemas with interceptors}
 */
export type InferWebSocketInterceptorSchema<Interceptor> =
  Interceptor extends LocalWebSocketInterceptor<infer Schema>
    ? Schema
    : Interceptor extends RemoteWebSocketInterceptor<infer Schema>
      ? Schema
      : never;

/**
 * The path type of a handler declared with a path argument. Handlers declared without one, where the argument is
 * inferred as `never`, have the path type `string`.
 */
export type WebSocketInterceptorHandlerPath<Schema extends WebSocketSchema, NonLiteralPath extends string> = IfNever<
  NonLiteralPath,
  string,
  LiteralWebSocketSchemaPathFromNonLiteral<Schema, NonLiteralPath>
>;

/** The schema paths described by a handler path. A handler without a path, typed as `string`, describes all of them. */
export type DeclaredWebSocketInterceptorPath<Schema extends WebSocketSchema, Path extends string> = Extract<
  Path extends WebSocketSchemaPath.Literal<Schema> ? Path : WebSocketSchemaPath.Literal<Schema>,
  WebSocketSchemaPath.Literal<Schema>
>;

/** The messages of the schema paths described by a handler path. */
export type WebSocketInterceptorPathMessage<
  Schema extends WebSocketSchema,
  Path extends string,
> = WebSocketSchemaMessage<Schema, DeclaredWebSocketInterceptorPath<Schema, Path>>;
