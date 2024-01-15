import { Default } from '@/types/utils';

import HttpRequestTracker from '../../HttpRequestTracker';
import {
  HttpInterceptorMethod,
  HttpInterceptorSchema,
  HttpInterceptorSchemaPath,
  LiteralHttpInterceptorSchemaPath,
} from './schema';

export interface HttpInterceptorMethodHandler<
  Schema extends HttpInterceptorSchema,
  Method extends HttpInterceptorMethod,
> {
  <Path extends LiteralHttpInterceptorSchemaPath<Schema>>(
    path: Path,
  ): HttpRequestTracker<Default<Schema[Path][Method]>>;

  <Path extends LiteralHttpInterceptorSchemaPath<Schema> = never>(
    path: HttpInterceptorSchemaPath<Schema>, // eslint-disable-line @typescript-eslint/unified-signatures
  ): HttpRequestTracker<Default<Schema[Path][Method]>>;
}
