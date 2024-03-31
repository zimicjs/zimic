import {
  AllowAnyStringInPathParameters,
  HttpMethod,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  LiteralHttpServiceSchemaPath,
} from '@/http/types/schema';

import { HttpRequestTracker } from '../../requestTracker/types/public';

export interface EffectiveHttpInterceptorMethodHandler<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
> {
  <Path extends LiteralHttpServiceSchemaPath<Schema, Method>>(path: Path): HttpRequestTracker<Schema, Method, Path>;

  <
    Path extends LiteralHttpServiceSchemaPath<Schema, Method> | void = void,
    ActualPath extends Exclude<Path, void> = Exclude<Path, void>,
  >(
    path: AllowAnyStringInPathParameters<ActualPath>,
  ): HttpRequestTracker<Schema, Method, ActualPath>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EmptyHttpInterceptorMethodHandler = (path: never) => HttpRequestTracker<any, any, never>;

export type HttpInterceptorMethodHandler<Schema extends HttpServiceSchema, Method extends HttpMethod> =
  Method extends HttpServiceSchemaMethod<Schema>
    ? EffectiveHttpInterceptorMethodHandler<Schema, Method>
    : EmptyHttpInterceptorMethodHandler;
