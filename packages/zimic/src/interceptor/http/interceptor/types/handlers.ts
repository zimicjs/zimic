import {
  HttpMethod,
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  LiteralHttpSchemaPathFromNonLiteral,
} from '@/http/types/schema';

import {
  HttpRequestHandler,
  LocalHttpRequestHandler,
  RemoteHttpRequestHandler,
} from '../../requestHandler/types/public';

export type SyncHttpInterceptorMethodHandler<Schema extends HttpSchema, Method extends HttpMethod = HttpMethod> =
  Method extends HttpSchemaMethod<Schema>
    ? <Path extends HttpSchemaPath.NonLiteral<Schema, Method>>(
        path: Path,
      ) => LocalHttpRequestHandler<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (path: never) => LocalHttpRequestHandler<any, any, never>;

export type AsyncHttpInterceptorMethodHandler<Schema extends HttpSchema, Method extends HttpMethod = HttpMethod> =
  Method extends HttpSchemaMethod<Schema>
    ? <Path extends HttpSchemaPath.NonLiteral<Schema, Method>>(
        path: Path,
      ) => RemoteHttpRequestHandler<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (path: never) => RemoteHttpRequestHandler<any, any, never>;

export type HttpInterceptorMethodHandler<Schema extends HttpSchema, Method extends HttpMethod = HttpMethod> =
  Method extends HttpSchemaMethod<Schema>
    ? <Path extends HttpSchemaPath.NonLiteral<Schema, Method>>(
        path: Path,
      ) =>
        | LocalHttpRequestHandler<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>
        | RemoteHttpRequestHandler<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (path: never) => HttpRequestHandler<any, any, never>;
