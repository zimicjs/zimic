import {
  HttpMethod,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  NonLiteralHttpServiceSchemaPath,
  InferLiteralHttpServiceSchemaPath,
} from '@/http/types/schema';

import { LocalHttpRequestHandler, RemoteHttpRequestHandler } from '../../requestHandler/types/public';

export type SyncHttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  Method extends HttpServiceSchemaMethod<Schema>
    ? <Path extends NonLiteralHttpServiceSchemaPath<Schema, Method>>(
        path: Path,
      ) => LocalHttpRequestHandler<Schema, Method, InferLiteralHttpServiceSchemaPath<Schema, Method, Path>>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (path: never) => LocalHttpRequestHandler<any, any, never>;

export type AsyncHttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  Method extends HttpServiceSchemaMethod<Schema>
    ? <Path extends NonLiteralHttpServiceSchemaPath<Schema, Method>>(
        path: Path,
      ) => RemoteHttpRequestHandler<Schema, Method, InferLiteralHttpServiceSchemaPath<Schema, Method, Path>>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (path: never) => RemoteHttpRequestHandler<any, any, never>;

export type HttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  | SyncHttpInterceptorMethodHandler<Schema, Method>
  | AsyncHttpInterceptorMethodHandler<Schema, Method>;
