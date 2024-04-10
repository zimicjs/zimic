import {
  HttpMethod,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  LiteralHttpServiceSchemaPath,
  NonLiteralHttpServiceSchemaPath,
  InferLiteralHttpServiceSchemaPath,
} from '@/http/types/schema';

import { LocalHttpRequestTracker, RemoteHttpRequestTracker } from '../../requestTracker/types/public';

export interface EffectiveSyncHttpInterceptorMethodHandler<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
> {
  <Path extends LiteralHttpServiceSchemaPath<Schema, Method>>(
    path: Path,
  ): LocalHttpRequestTracker<Schema, Method, Path>;

  <NonLiteralPath extends NonLiteralHttpServiceSchemaPath<Schema, Method>>(
    path: NonLiteralPath,
  ): LocalHttpRequestTracker<Schema, Method, InferLiteralHttpServiceSchemaPath<Schema, Method, NonLiteralPath>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EmptySyncHttpInterceptorMethodHandler = (path: never) => LocalHttpRequestTracker<any, any, never>;

export type SyncHttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  Method extends HttpServiceSchemaMethod<Schema>
    ? EffectiveSyncHttpInterceptorMethodHandler<Schema, Method>
    : EmptySyncHttpInterceptorMethodHandler;

export interface EffectiveAsyncHttpInterceptorMethodHandler<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
> {
  <Path extends LiteralHttpServiceSchemaPath<Schema, Method>>(
    path: Path,
  ): RemoteHttpRequestTracker<Schema, Method, Path>;

  <NonLiteralPath extends NonLiteralHttpServiceSchemaPath<Schema, Method>>(
    path: NonLiteralPath,
  ): RemoteHttpRequestTracker<Schema, Method, InferLiteralHttpServiceSchemaPath<Schema, Method, NonLiteralPath>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EmptyAsyncHttpInterceptorMethodHandler = (path: never) => RemoteHttpRequestTracker<any, any, never>;

export type AsyncHttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  Method extends HttpServiceSchemaMethod<Schema>
    ? EffectiveAsyncHttpInterceptorMethodHandler<Schema, Method>
    : EmptyAsyncHttpInterceptorMethodHandler;

export type HttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  | SyncHttpInterceptorMethodHandler<Schema, Method>
  | AsyncHttpInterceptorMethodHandler<Schema, Method>;
