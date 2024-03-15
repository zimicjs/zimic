import HttpHeaders from '@/http/headers/HttpHeaders';
import { HttpHeadersInit } from '@/http/headers/types';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpRequest, HttpResponse } from '@/http/types/requests';
import { Default, PossiblePromise } from '@/types/utils';

import {
  HttpInterceptorMethodSchema,
  HttpInterceptorResponseSchema,
  HttpInterceptorResponseSchemaStatusCode,
} from '../../interceptor/types/schema';

export type HttpRequestTrackerResponseBodyAttribute<ResponseSchema extends HttpInterceptorResponseSchema> =
  undefined extends ResponseSchema['body'] ? { body?: null } : { body: ResponseSchema['body'] };

export type HttpRequestTrackerResponseHeadersAttribute<ResponseSchema extends HttpInterceptorResponseSchema> =
  undefined extends ResponseSchema['headers']
    ? { headers?: undefined }
    : { headers: HttpHeadersInit<Default<ResponseSchema['headers']>> };

export type HttpRequestTrackerResponseDeclaration<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = {
  status: StatusCode;
} & HttpRequestTrackerResponseBodyAttribute<Default<MethodSchema['response']>[StatusCode]> &
  HttpRequestTrackerResponseHeadersAttribute<Default<MethodSchema['response']>[StatusCode]>;

export type HttpRequestTrackerResponseDeclarationFactory<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = (
  request: Omit<HttpInterceptorRequest<MethodSchema>, 'response'>,
) => PossiblePromise<HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>>;

export type HttpSearchParamsRequestSchema<MethodSchema extends HttpInterceptorMethodSchema> = Default<
  Default<MethodSchema['request'], { searchParams: never }>['searchParams']
>;

export interface HttpInterceptorRequest<MethodSchema extends HttpInterceptorMethodSchema>
  extends Omit<HttpRequest, keyof Body | 'headers'> {
  headers: HttpHeaders<Default<Default<MethodSchema['request'], { headers: never }>['headers']>>;
  searchParams: HttpSearchParams<HttpSearchParamsRequestSchema<MethodSchema>>;
  body: Default<Default<MethodSchema['request'], { body: null }>['body'], null>;
  raw: HttpRequest<Default<Default<MethodSchema['request'], { body: null }>['body'], null>>;
}

export interface HttpInterceptorResponse<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> extends Omit<HttpResponse, keyof Body | 'headers'> {
  headers: HttpHeaders<Default<Default<MethodSchema['response']>[StatusCode]['headers']>>;
  status: StatusCode;
  body: Default<Default<MethodSchema['response']>[StatusCode]['body'], null>;
  raw: HttpResponse<Default<Default<MethodSchema['response']>[StatusCode]['body'], null>, StatusCode>;
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
