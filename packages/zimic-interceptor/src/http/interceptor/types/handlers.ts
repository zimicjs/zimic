import {
  HttpMethod,
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  LiteralHttpSchemaPathFromNonLiteral,
} from '@zimic/http';

import { LocalHttpRequestHandler, RemoteHttpRequestHandler } from '../../requestHandler/types/public';

/** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#declaring-request-handlers Declaring request handlers} */
export type SyncHttpInterceptorMethodHandler<Schema extends HttpSchema, Method extends HttpMethod> =
  Method extends HttpSchemaMethod<Schema>
    ? <Path extends HttpSchemaPath.NonLiteral<Schema, Method>>(
        path: Path,
      ) => LocalHttpRequestHandler<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (path: never) => LocalHttpRequestHandler<any, any, never>;

/** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#declaring-request-handlers Declaring request handlers} */
export type AsyncHttpInterceptorMethodHandler<Schema extends HttpSchema, Method extends HttpMethod> =
  Method extends HttpSchemaMethod<Schema>
    ? <Path extends HttpSchemaPath.NonLiteral<Schema, Method>>(
        path: Path,
      ) => RemoteHttpRequestHandler<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (path: never) => RemoteHttpRequestHandler<any, any, never>;
