import {
  HttpMethod,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  LiteralHttpServiceSchemaPath,
  NonLiteralHttpServiceSchemaPath,
  InferLiteralHttpServiceSchemaPath,
} from '@/http/types/schema';

import { HttpRequestTracker, RemoteHttpRequestTracker } from '../../requestTracker/types/public';

export interface EffectiveSyncHttpInterceptorMethodHandler<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
> {
  <Path extends LiteralHttpServiceSchemaPath<Schema, Method>>(path: Path): HttpRequestTracker<Schema, Method, Path>;

  <NonLiteralPath extends NonLiteralHttpServiceSchemaPath<Schema, Method>>(
    path: NonLiteralPath,
  ): HttpRequestTracker<Schema, Method, InferLiteralHttpServiceSchemaPath<Schema, Method, NonLiteralPath>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EmptySyncHttpInterceptorMethodHandler = (path: never) => HttpRequestTracker<any, any, never>;

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

  <
    Path extends LiteralHttpServiceSchemaPath<Schema, Method> | void = void,
    ActualPath extends Exclude<Path, void> = Exclude<Path, void>,
  >(
    path: AllowAnyStringInPathParameters<ActualPath>,
  ): RemoteHttpRequestTracker<Schema, Method, ActualPath>;
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
