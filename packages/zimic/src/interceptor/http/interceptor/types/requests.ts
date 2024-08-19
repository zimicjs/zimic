import { HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@/http/types/schema';
import { Default } from '@/types/utils';

import { HttpResponseFactoryContext } from '../../interceptorWorker/types/requests';

export type HttpInterceptorRequestContext<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> = HttpResponseFactoryContext<Default<Default<Schema[Path][Method]>['request']>['body']>;
