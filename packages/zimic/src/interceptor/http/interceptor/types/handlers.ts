import {
  HttpMethod,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  NonLiteralHttpServiceSchemaPath,
  InferLiteralHttpServiceSchemaPath,
} from '@/http/types/schema';

import { PublicLocalHttpRequestTracker, PublicRemoteHttpRequestTracker } from '../../requestTracker/types/public';

export type SyncHttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  Method extends HttpServiceSchemaMethod<Schema>
    ? <Path extends NonLiteralHttpServiceSchemaPath<Schema, Method>>(
        path: Path,
      ) => PublicLocalHttpRequestTracker<Schema, Method, InferLiteralHttpServiceSchemaPath<Schema, Method, Path>>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (path: never) => PublicLocalHttpRequestTracker<any, any, never>;

export type AsyncHttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  Method extends HttpServiceSchemaMethod<Schema>
    ? <Path extends NonLiteralHttpServiceSchemaPath<Schema, Method>>(
        path: Path,
      ) => PublicRemoteHttpRequestTracker<Schema, Method, InferLiteralHttpServiceSchemaPath<Schema, Method, Path>>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (path: never) => PublicRemoteHttpRequestTracker<any, any, never>;

export type HttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  | SyncHttpInterceptorMethodHandler<Schema, Method>
  | AsyncHttpInterceptorMethodHandler<Schema, Method>;
