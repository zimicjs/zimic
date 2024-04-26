import { HttpServiceSchema, HttpServiceSchemaMethod, HttpServiceSchemaPath } from '@/http/types/schema';
import { Default } from '@/types/utils';

import { HttpResponseFactoryContext } from '../../interceptorWorker/types/requests';

export type HttpInterceptorRequestContext<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
> = HttpResponseFactoryContext<Default<Default<Schema[Path][Method]>['request']>['body']>;
