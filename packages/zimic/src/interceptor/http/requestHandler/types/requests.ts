import HttpHeaders from '@/http/headers/HttpHeaders';
import { HttpHeadersInit } from '@/http/headers/types';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpRequest, HttpResponse } from '@/http/types/requests';
import {
  HttpServiceMethodSchema,
  HttpServiceResponseSchema,
  HttpServiceResponseSchemaStatusCode,
  PathParamsSchemaFromPath,
} from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';

export type HttpRequestHandlerResponseBodyAttribute<ResponseSchema extends HttpServiceResponseSchema> =
  undefined extends ResponseSchema['body'] ? { body?: null } : { body: ResponseSchema['body'] };

export type HttpRequestHandlerResponseHeadersAttribute<ResponseSchema extends HttpServiceResponseSchema> =
  undefined extends ResponseSchema['headers']
    ? { headers?: undefined }
    : { headers: HttpHeadersInit<Default<ResponseSchema['headers']>> };

/** A declaration of an HTTP response for an intercepted request. */
export type HttpRequestHandlerResponseDeclaration<
  MethodSchema extends HttpServiceMethodSchema,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = {
  status: StatusCode;
} & HttpRequestHandlerResponseBodyAttribute<Default<MethodSchema['response']>[StatusCode]> &
  HttpRequestHandlerResponseHeadersAttribute<Default<MethodSchema['response']>[StatusCode]>;

/**
 * A factory function for creating {@link HttpRequestHandlerResponseDeclaration} objects.
 *
 * @param request The intercepted request.
 * @returns The response declaration.
 */
export type HttpRequestHandlerResponseDeclarationFactory<
  Path extends string,
  MethodSchema extends HttpServiceMethodSchema,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = (
  request: Omit<HttpInterceptorRequest<Path, MethodSchema>, 'response'>,
) => PossiblePromise<HttpRequestHandlerResponseDeclaration<MethodSchema, StatusCode>>;

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
export interface HttpInterceptorRequest<Path extends string, MethodSchema extends HttpServiceMethodSchema>
  extends Omit<HttpRequest, keyof Body | 'headers'> {
  headers: HttpHeaders<HttpRequestHeadersSchema<MethodSchema>>;
  pathParams: PathParamsSchemaFromPath<Path>;
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

export const HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES = Object.freeze(
  new Set<string>(['bodyUsed', 'arrayBuffer', 'blob', 'formData', 'json', 'text'] satisfies Exclude<
    keyof Body,
    keyof HttpInterceptorRequest<string, never>
  >[]),
);

export const HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES = Object.freeze(
  new Set(HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES),
);

/** A strict representation of a tracked, intercepted HTTP request, along with its response. */
export interface TrackedHttpInterceptorRequest<
  Path extends string,
  MethodSchema extends HttpServiceMethodSchema,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<MethodSchema['response']>> = never,
> extends HttpInterceptorRequest<Path, MethodSchema> {
  response: StatusCode extends [never] ? never : HttpInterceptorResponse<MethodSchema, StatusCode>;
}
