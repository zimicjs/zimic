import { HttpServiceSchema, HttpServiceSchemaMethod, HttpServiceSchemaPath } from '@/http/types/schema';
import { Default } from '@/types/utils';

import { HttpRequestHandlerContext } from '../../interceptorWorker/types/requests';

export type HttpInterceptorRequestContext<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
> = HttpRequestHandlerContext<Default<Default<Schema[Path][Method]>['request']>['body']>;
