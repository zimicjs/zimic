import { HttpBody, HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@zimic/http';

import { Default } from '@/types/utils';

import { HttpResponseFactoryContext } from '../../interceptorWorker/types/requests';
import { HttpInterceptorRequest } from '../../requestHandler/types/requests';

export type HttpInterceptorRequestContext<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> = HttpResponseFactoryContext<Default<Default<Schema[Path][Method]>['request']>['body']>;

export type UnhandledHttpInterceptorRequestPath = string;

export type UnhandledHttpInterceptorRequestMethodSchema = HttpSchema.Method<{
  request: {
    headers: Record<string, string>;
    searchParams: Record<string, string | string[]>;
    body: HttpBody;
  };
}>;

export type UnhandledHttpInterceptorRequest = Omit<
  HttpInterceptorRequest<string, UnhandledHttpInterceptorRequestMethodSchema>,
  'response'
>;
