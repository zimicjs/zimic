import { HttpRequestTracker } from '../../requestTracker/types/public';
import {
  AllowAnyStringInRouteParameters,
  HttpInterceptorMethod,
  HttpInterceptorSchema,
  HttpInterceptorSchemaMethod,
  LiteralHttpInterceptorSchemaPath,
} from './schema';

export interface EffectiveHttpInterceptorMethodHandler<
  Schema extends HttpInterceptorSchema,
  Method extends HttpInterceptorSchemaMethod<Schema>,
> {
  <Path extends LiteralHttpInterceptorSchemaPath<Schema, Method>>(path: Path): HttpRequestTracker<Schema, Method, Path>;

  <
    Path extends LiteralHttpInterceptorSchemaPath<Schema, Method> | void = void,
    ActualPath extends Exclude<Path, void> = Exclude<Path, void>,
  >(
    path: AllowAnyStringInRouteParameters<ActualPath>,
  ): HttpRequestTracker<Schema, Method, ActualPath>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EmptyHttpInterceptorMethodHandler = (path: never) => HttpRequestTracker<any, any, never>;

export type HttpInterceptorMethodHandler<Schema extends HttpInterceptorSchema, Method extends HttpInterceptorMethod> =
  Method extends HttpInterceptorSchemaMethod<Schema>
    ? EffectiveHttpInterceptorMethodHandler<Schema, Method>
    : EmptyHttpInterceptorMethodHandler;
