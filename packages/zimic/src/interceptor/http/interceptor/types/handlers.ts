import {
  HttpMethod,
  HttpSchema,
  HttpSchemaMethod,
  NonLiteralHttpSchemaPath,
  LiteralHttpSchemaPathFromNonLiteral,
} from '@/http/types/schema';

import { LocalHttpRequestHandler, RemoteHttpRequestHandler } from '../../requestHandler/types/public';

export type SyncHttpInterceptorMethodHandler<Schema extends HttpSchema, Method extends HttpMethod> =
  Method extends HttpSchemaMethod<Schema>
    ? <Path extends NonLiteralHttpSchemaPath<Schema, Method>>(
        path: Path,
      ) => LocalHttpRequestHandler<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (path: never) => LocalHttpRequestHandler<any, any, never>;

export type AsyncHttpInterceptorMethodHandler<Schema extends HttpSchema, Method extends HttpMethod> =
  Method extends HttpSchemaMethod<Schema>
    ? <Path extends NonLiteralHttpSchemaPath<Schema, Method>>(
        path: Path,
      ) => RemoteHttpRequestHandler<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (path: never) => RemoteHttpRequestHandler<any, any, never>;

export type HttpInterceptorMethodHandler<Schema extends HttpSchema, Method extends HttpMethod> =
  | SyncHttpInterceptorMethodHandler<Schema, Method>
  | AsyncHttpInterceptorMethodHandler<Schema, Method>;
