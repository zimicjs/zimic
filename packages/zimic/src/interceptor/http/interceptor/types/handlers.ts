import {
  HttpMethod,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  LiteralHttpServiceSchemaPath,
  NonLiteralHttpServiceSchemaPath,
  NonLiteralHttpServiceSchemaPathToLiteral,
} from '@/http/types/schema';

import { HttpRequestTracker } from '../../requestTracker/types/public';

export interface EffectiveHttpInterceptorMethodHandler<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
> {
  <Path extends LiteralHttpServiceSchemaPath<Schema, Method>>(path: Path): HttpRequestTracker<Schema, Method, Path>;

  <NonLiteralPath extends NonLiteralHttpServiceSchemaPath<Schema, Method>>(
    path: NonLiteralPath,
  ): HttpRequestTracker<Schema, Method, NonLiteralHttpServiceSchemaPathToLiteral<Schema, Method, NonLiteralPath>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EmptyHttpInterceptorMethodHandler = (path: never) => HttpRequestTracker<any, any, never>;

export type HttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  Method extends HttpServiceSchemaMethod<Schema>
    ? EffectiveHttpInterceptorMethodHandler<Schema, Method>
    : EmptyHttpInterceptorMethodHandler;
