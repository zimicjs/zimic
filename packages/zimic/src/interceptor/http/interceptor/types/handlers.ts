import {
  HttpMethod,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  NonLiteralHttpServiceSchemaPath,
  InferLiteralHttpServiceSchemaPath,
} from '@/http/types/schema';

import { LocalHttpRequestTracker, RemoteHttpRequestTracker } from '../../requestTracker/types/public';

export type SyncHttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  Method extends HttpServiceSchemaMethod<Schema>
    ? <Path extends NonLiteralHttpServiceSchemaPath<Schema, Method>>(
        path: Path,
      ) => LocalHttpRequestTracker<Schema, Method, InferLiteralHttpServiceSchemaPath<Schema, Method, Path>>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (path: never) => LocalHttpRequestTracker<any, any, never>;

export type AsyncHttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  Method extends HttpServiceSchemaMethod<Schema>
    ? <Path extends NonLiteralHttpServiceSchemaPath<Schema, Method>>(
        path: Path,
      ) => RemoteHttpRequestTracker<Schema, Method, InferLiteralHttpServiceSchemaPath<Schema, Method, Path>>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (path: never) => RemoteHttpRequestTracker<any, any, never>;

export type HttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  | SyncHttpInterceptorMethodHandler<Schema, Method>
  | AsyncHttpInterceptorMethodHandler<Schema, Method>;
