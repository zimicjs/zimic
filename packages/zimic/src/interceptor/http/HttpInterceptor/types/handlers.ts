import { Default } from '@/types/utils';

import HttpRequestTracker from '../../HttpRequestTracker';
import {
  HttpInterceptorMethod,
  HttpInterceptorSchema,
  HttpInterceptorSchemaMethod,
  HttpInterceptorSchemaPath,
  LiteralHttpInterceptorSchemaPath,
} from './schema';

export type EmptyHttpInterceptorMethodHandler = (path: never) => HttpRequestTracker<never>;

export type StrictHttpInterceptorMethodHandler<
  Schema extends HttpInterceptorSchema,
  Method extends HttpInterceptorSchemaMethod<Schema>,
> = <Path extends LiteralHttpInterceptorSchemaPath<Schema, Method>>(
  path: Path | HttpInterceptorSchemaPath<Schema, Method>,
) => HttpRequestTracker<Default<Schema[Path][Method]>>;

export type HttpInterceptorMethodHandler<Schema extends HttpInterceptorSchema, Method extends HttpInterceptorMethod> =
  Method extends HttpInterceptorSchemaMethod<Schema>
    ? StrictHttpInterceptorMethodHandler<Schema, Method>
    : EmptyHttpInterceptorMethodHandler;
