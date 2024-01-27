import { Default, PossiblePromise } from '@/types/utils';

import {
  HttpInterceptorMethodSchema,
  HttpInterceptorResponseSchema,
  HttpInterceptorResponseSchemaStatusCode,
} from '../../interceptor/types/schema';
import { HttpRequest, HttpResponse } from '../../interceptorWorker/types';

export type HttpRequestTrackerResponseAttribute<
  ResponseSchema extends HttpInterceptorResponseSchema,
  AttributeName extends keyof ResponseSchema,
> = undefined | void extends ResponseSchema[AttributeName]
  ? { [Name in AttributeName]?: never }
  : { [Name in AttributeName]: ResponseSchema[AttributeName] };

export type HttpRequestTrackerResponseDeclaration<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = {
  status: StatusCode;
} & HttpRequestTrackerResponseAttribute<Default<MethodSchema['response']>[StatusCode], 'body'>;

export type HttpRequestTrackerResponseDeclarationFactory<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = (
  request: Omit<HttpInterceptorRequest<MethodSchema>, 'response'>,
) => PossiblePromise<HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>>;

export interface HttpInterceptorRequest<MethodSchema extends HttpInterceptorMethodSchema>
  extends Omit<HttpRequest, keyof Body> {
  body: undefined | void extends Default<MethodSchema['request']>['body']
    ? never
    : Default<MethodSchema['request']>['body'];
}

export interface HttpInterceptorResponse<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> extends Omit<HttpResponse, keyof Body> {
  status: StatusCode;
  body: Default<MethodSchema['response']>[StatusCode]['body'];
}

export interface TrackedHttpInterceptorRequest<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>> = never,
> extends HttpInterceptorRequest<MethodSchema> {
  response: HttpInterceptorResponse<MethodSchema, StatusCode>;
}
