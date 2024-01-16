import { Default, PossiblePromise } from '@/types/utils';

import {
  HttpInterceptorMethodSchema,
  HttpInterceptorRequestSchema,
  HttpInterceptorResponseSchema,
  HttpInterceptorResponseSchemaByStatusCode,
  HttpInterceptorResponseSchemaStatusCode,
} from '../HttpInterceptor/types/schema';

export type HttpRequestTrackerResponseAttribute<
  ResponseSchemaByStatusCode extends HttpInterceptorResponseSchemaByStatusCode,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<ResponseSchemaByStatusCode>,
  AttributeName extends keyof ResponseSchemaByStatusCode[StatusCode],
> = undefined | void extends ResponseSchemaByStatusCode[StatusCode][AttributeName]
  ? { [Name in AttributeName]?: never }
  : { [Name in AttributeName]: ResponseSchemaByStatusCode[StatusCode][AttributeName] };

export type HttpRequestTrackerResponse<
  ResponseSchemaByStatusCode extends HttpInterceptorResponseSchemaByStatusCode,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<ResponseSchemaByStatusCode>,
> = {
  status: StatusCode;
} & HttpRequestTrackerResponseAttribute<ResponseSchemaByStatusCode, StatusCode, 'body'>;

export interface HttpInterceptorRequest<RequestSchema extends HttpInterceptorRequestSchema>
  extends Omit<Request, keyof Body> {
  rawBody: Body['body'];
  body: undefined | void extends RequestSchema['body'] ? never : RequestSchema['body'];
}

export interface HttpInterceptorResponse<ResponseSchema extends HttpInterceptorResponseSchema>
  extends Omit<Response, keyof Body> {
  body: ResponseSchema['body'];
}

export interface InterceptedRequest<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> extends HttpInterceptorRequest<Default<MethodSchema['request']>> {
  response: HttpInterceptorResponse<Default<MethodSchema['response']>[StatusCode]>;
}

export type HttpRequestTrackerComputeResponseFactory<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = (
  request: HttpInterceptorRequest<Default<MethodSchema['request']>>,
) => PossiblePromise<HttpRequestTrackerResponse<Default<MethodSchema['response']>, StatusCode>>;
