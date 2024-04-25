import HttpHeaders from '@/http/headers/HttpHeaders';
import { HttpHeadersInit } from '@/http/headers/types';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpRequest, HttpResponse } from '@/http/types/requests';
import {
  HttpServiceMethodSchema,
  HttpServiceResponseSchema,
  HttpServiceResponseSchemaStatusCode,
} from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';

export type HttpRequestTrackerResponseBodyAttribute<ResponseSchema extends HttpServiceResponseSchema> =
  undefined extends ResponseSchema['body'] ? { body?: null } : { body: ResponseSchema['body'] };

export type HttpRequestTrackerResponseHeadersAttribute<ResponseSchema extends HttpServiceResponseSchema> =
  undefined extends ResponseSchema['headers']
    ? { headers?: undefined }
    : { headers: HttpHeadersInit<Default<ResponseSchema['headers']>> };

/** A declaration of an HTTP response for an intercepted request. */
export type HttpRequestTrackerResponseDeclaration<
  MethodSchema extends HttpServiceMethodSchema,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = {
  status: StatusCode;
} & HttpRequestTrackerResponseBodyAttribute<Default<MethodSchema['response']>[StatusCode]> &
  HttpRequestTrackerResponseHeadersAttribute<Default<MethodSchema['response']>[StatusCode]>;

/**
 * A factory function for creating {@link HttpRequestTrackerResponseDeclaration} objects.
 *
 * @param request The intercepted request.
 * @returns The response declaration.
 */
export type HttpRequestTrackerResponseDeclarationFactory<
  MethodSchema extends HttpServiceMethodSchema,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = (
  request: Omit<HttpInterceptorRequest<MethodSchema>, 'response'>,
) => PossiblePromise<HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>>;

export type HttpRequestHeadersSchema<MethodSchema extends HttpServiceMethodSchema> = Default<
  Default<MethodSchema['request'], { headers: never }>['headers']
>;

export type HttpRequestSearchParamsSchema<MethodSchema extends HttpServiceMethodSchema> = Default<
  Default<MethodSchema['request'], { searchParams: never }>['searchParams']
>;

export type HttpRequestBodySchema<MethodSchema extends HttpServiceMethodSchema> = Default<
  Default<MethodSchema['request'], { body: null }>['body'],
  null
>;

/** A strict representation of an intercepted HTTP request. The body is already parsed by default. */
export interface HttpInterceptorRequest<MethodSchema extends HttpServiceMethodSchema>
  extends Omit<HttpRequest, keyof Body | 'headers'> {
  headers: HttpHeaders<HttpRequestHeadersSchema<MethodSchema>>;
  searchParams: HttpSearchParams<HttpRequestSearchParamsSchema<MethodSchema>>;
  body: HttpRequestBodySchema<MethodSchema>;
  raw: HttpRequest<Default<Default<MethodSchema['request'], { body: null }>['body'], null>>;
}

export type HttpResponseHeadersSchema<
  MethodSchema extends HttpServiceMethodSchema,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = Default<Default<MethodSchema['response']>[StatusCode]['headers']>;

export type HttpResponseBodySchema<
  MethodSchema extends HttpServiceMethodSchema,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = Default<Default<MethodSchema['response']>[StatusCode]['body'], null>;

/** A strict representation of an intercepted HTTP response. The body is already parsed by default. */
export interface HttpInterceptorResponse<
  MethodSchema extends HttpServiceMethodSchema,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> extends Omit<HttpResponse, keyof Body | 'headers'> {
  headers: HttpHeaders<HttpResponseHeadersSchema<MethodSchema, StatusCode>>;
  status: StatusCode;
  body: HttpResponseBodySchema<MethodSchema, StatusCode>;
  raw: HttpResponse<HttpResponseBodySchema<MethodSchema, StatusCode>, StatusCode>;
}

export const HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES = new Set<string>([
  'bodyUsed',
  'arrayBuffer',
  'blob',
  'formData',
  'json',
  'text',
] satisfies Exclude<keyof Body, keyof HttpInterceptorRequest<never>>[]);

export const HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES = new Set(
  HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES,
);

/** A strict representation of a tracked, intercepted HTTP request, along with its response. */
export interface TrackedHttpInterceptorRequest<
  MethodSchema extends HttpServiceMethodSchema,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<MethodSchema['response']>> = never,
> extends HttpInterceptorRequest<MethodSchema> {
  response: StatusCode extends [never] ? never : HttpInterceptorResponse<MethodSchema, StatusCode>;
}
