import { Default } from '@/types/utils';

import BaseHttpRequestTracker from '../../requestTracker/BaseHttpRequestTracker';
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
  <Path extends LiteralHttpInterceptorSchemaPath<Schema, Method>>(
    path: Path,
  ): BaseHttpRequestTracker<Default<Schema[Path][Method]>>;

  <
    Path extends LiteralHttpInterceptorSchemaPath<Schema, Method> | void = void,
    ActualPath extends Exclude<Path, void> = Exclude<Path, void>,
  >(
    path: AllowAnyStringInRouteParameters<ActualPath>,
  ): BaseHttpRequestTracker<Default<Schema[ActualPath][Method]>>;
}

export type EmptyHttpInterceptorMethodHandler = (path: never) => BaseHttpRequestTracker<never>;

export type HttpInterceptorMethodHandler<Schema extends HttpInterceptorSchema, Method extends HttpInterceptorMethod> =
  Method extends HttpInterceptorSchemaMethod<Schema>
    ? EffectiveHttpInterceptorMethodHandler<Schema, Method>
    : EmptyHttpInterceptorMethodHandler;
