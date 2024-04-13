import {
  HttpMethod,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  LiteralHttpServiceSchemaPath,
  NonLiteralHttpServiceSchemaPath,
  InferLiteralHttpServiceSchemaPath,
} from '@/http/types/schema';

import { PublicLocalHttpRequestTracker, PublicRemoteHttpRequestTracker } from '../../requestTracker/types/public';

export interface EffectiveSyncHttpInterceptorMethodHandler<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
> {
  <Path extends LiteralHttpServiceSchemaPath<Schema, Method>>(
    path: Path,
  ): PublicLocalHttpRequestTracker<Schema, Method, Path>;

  <NonLiteralPath extends NonLiteralHttpServiceSchemaPath<Schema, Method>>(
    path: NonLiteralPath,
  ): PublicLocalHttpRequestTracker<Schema, Method, InferLiteralHttpServiceSchemaPath<Schema, Method, NonLiteralPath>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EmptySyncHttpInterceptorMethodHandler = (path: never) => PublicLocalHttpRequestTracker<any, any, never>;

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
  ): PublicRemoteHttpRequestTracker<Schema, Method, Path>;

  <NonLiteralPath extends NonLiteralHttpServiceSchemaPath<Schema, Method>>(
    path: NonLiteralPath,
  ): PublicRemoteHttpRequestTracker<Schema, Method, InferLiteralHttpServiceSchemaPath<Schema, Method, NonLiteralPath>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EmptyAsyncHttpInterceptorMethodHandler = (path: never) => PublicRemoteHttpRequestTracker<any, any, never>;

export type AsyncHttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  Method extends HttpServiceSchemaMethod<Schema>
    ? EffectiveAsyncHttpInterceptorMethodHandler<Schema, Method>
    : EmptyAsyncHttpInterceptorMethodHandler;

export type HttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  | SyncHttpInterceptorMethodHandler<Schema, Method>
  | AsyncHttpInterceptorMethodHandler<Schema, Method>;
