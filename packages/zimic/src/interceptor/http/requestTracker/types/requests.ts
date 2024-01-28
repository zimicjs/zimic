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
  ? { [Name in AttributeName]?: null }
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
  body: Default<Default<MethodSchema['request'], { body: null }>['body'], null>;
  raw: HttpResponse<Default<MethodSchema['request']>['body']>;
}

export interface HttpInterceptorResponse<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> extends Omit<HttpResponse, keyof Body> {
  status: StatusCode;
  body: Default<Default<MethodSchema['response']>[StatusCode]['body'], null>;
  raw: HttpResponse<Default<MethodSchema['response']>[StatusCode]['body']>;
}

export const HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES = new Set<
  Exclude<keyof Body, keyof HttpInterceptorRequest<never>>
>(['bodyUsed', 'arrayBuffer', 'blob', 'formData', 'json', 'text']);

export const HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES =
  HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES satisfies Set<
    Exclude<keyof Body, keyof HttpInterceptorResponse<never, never>>
  >;

export interface TrackedHttpInterceptorRequest<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>> = never,
> extends HttpInterceptorRequest<MethodSchema> {
  response: StatusCode extends [never] ? never : HttpInterceptorResponse<MethodSchema, StatusCode>;
}
