import { Default } from '@/types/utils';

import HttpRequestTracker from '../../HttpRequestTracker';
import {
  HttpInterceptorMethod,
  HttpInterceptorSchema,
  HttpInterceptorSchemaMethod,
  HttpInterceptorSchemaPath,
  LiteralHttpInterceptorSchemaPath,
} from './schema';

export interface EffectiveHttpInterceptorMethodHandler<
  Schema extends HttpInterceptorSchema,
  Method extends HttpInterceptorSchemaMethod<Schema>,
> {
  <Path extends LiteralHttpInterceptorSchemaPath<Schema, Method>>(
    path: Path,
  ): HttpRequestTracker<Default<Schema[Path][Method]>>;

  <Path extends LiteralHttpInterceptorSchemaPath<Schema, Method>>(
    // eslint-disable-next-line @typescript-eslint/unified-signatures
    path: HttpInterceptorSchemaPath<Schema, Method>,
  ): HttpRequestTracker<Default<Schema[Path][Method]>>;
}

export type EmptyHttpInterceptorMethodHandler = (path: never) => HttpRequestTracker<never>;

export type HttpInterceptorMethodHandler<Schema extends HttpInterceptorSchema, Method extends HttpInterceptorMethod> =
  Method extends HttpInterceptorSchemaMethod<Schema>
    ? EffectiveHttpInterceptorMethodHandler<Schema, Method>
    : EmptyHttpInterceptorMethodHandler;
