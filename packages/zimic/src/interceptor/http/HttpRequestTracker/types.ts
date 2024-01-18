import { Default, PossiblePromise } from '@/types/utils';

import {
  HttpInterceptorMethodSchema,
  HttpInterceptorResponseSchema,
  HttpInterceptorResponseSchemaStatusCode,
} from '../HttpInterceptor/types/schema';

export type HttpRequestTrackerResponseAttribute<
  ResponseSchema extends HttpInterceptorResponseSchema,
  AttributeName extends keyof ResponseSchema,
> = undefined | void extends ResponseSchema[AttributeName]
  ? { [Name in AttributeName]?: never }
  : { [Name in AttributeName]: ResponseSchema[AttributeName] };

export type HttpRequestTrackerResponse<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = {
  status: StatusCode;
} & HttpRequestTrackerResponseAttribute<Default<MethodSchema['response']>[StatusCode], 'body'>;

export interface HttpInterceptorRequest<MethodSchema extends HttpInterceptorMethodSchema>
  extends Omit<Request, keyof Body> {
  body: undefined | void extends Default<MethodSchema['request']>['body']
    ? never
    : Default<MethodSchema['request']>['body'];
}

export interface HttpInterceptorResponse<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> extends Omit<Response, keyof Body> {
  body: Default<MethodSchema['response']>[StatusCode]['body'];
}

export interface InterceptedHttpRequest<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> extends HttpInterceptorRequest<MethodSchema> {
  response: HttpInterceptorResponse<MethodSchema, StatusCode>;
}

export type HttpRequestTrackerResponseFactory<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = (
  request: HttpInterceptorRequest<MethodSchema>,
) => PossiblePromise<HttpRequestTrackerResponse<MethodSchema, StatusCode>>;

export type HttpRequestTrackerResponseDeclaration<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = HttpRequestTrackerResponse<MethodSchema, StatusCode> | HttpRequestTrackerResponseFactory<MethodSchema, StatusCode>;
