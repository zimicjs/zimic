import { Default, PossiblePromise } from '@/types/utils';

import {
  HttpInterceptorMethodSchema,
  HttpInterceptorRequestSchema,
  HttpInterceptorResponseSchema,
  HttpInterceptorResponseSchemaByStatusCode,
  HttpInterceptorResponseSchemaStatusCode,
} from '../HttpInterceptor/types/schema';
import HttpRequestTracker from './HttpRequestTracker';

export type HttpRequestTrackerResponseAttributeDefinition<
  ResponseSchemaByStatusCode extends HttpInterceptorResponseSchemaByStatusCode,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<ResponseSchemaByStatusCode>,
  AttributeName extends keyof ResponseSchemaByStatusCode[StatusCode],
> = undefined | void extends ResponseSchemaByStatusCode[StatusCode][AttributeName]
  ? { [Name in AttributeName]?: never }
  : { [Name in AttributeName]: ResponseSchemaByStatusCode[StatusCode][AttributeName] };

export type HttpRequestTrackerResponseDefinition<
  ResponseSchemaByStatusCode extends HttpInterceptorResponseSchemaByStatusCode,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<ResponseSchemaByStatusCode>,
> = {
  status: StatusCode;
} & HttpRequestTrackerResponseAttributeDefinition<ResponseSchemaByStatusCode, StatusCode, 'body'>;

export interface HttpInterceptorRequest<RequestSchema extends HttpInterceptorRequestSchema>
  extends Omit<Request, keyof Body> {
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
) => PossiblePromise<HttpRequestTrackerResponseDefinition<Default<MethodSchema['response']>, StatusCode>>;

export interface HttpRequestTrackerResponseDefinitionHandler<MethodSchema extends HttpInterceptorMethodSchema> {
  <StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>>(
    response: HttpRequestTrackerResponseDefinition<Default<MethodSchema['response']>, StatusCode>,
  ): HttpRequestTracker<MethodSchema, StatusCode>;

  <StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>>(
    // eslint-disable-next-line @typescript-eslint/unified-signatures
    computeResponse: HttpRequestTrackerComputeResponseFactory<MethodSchema, StatusCode>,
  ): HttpRequestTracker<MethodSchema, StatusCode>;
}
