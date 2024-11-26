import HttpHeaders from '@/http/headers/HttpHeaders';
import { HttpHeadersInit } from '@/http/headers/types';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpRequest, HttpResponse } from '@/http/types/requests';
import {
  HttpMethodSchema,
  HttpResponseSchema,
  HttpResponseSchemaStatusCode,
  InferPathParams,
} from '@/http/types/schema';
import { Default, DefaultNoExclude, IfNever, PossiblePromise, ReplaceBy } from '@/types/utils';

export type HttpRequestHandlerResponseBodyAttribute<ResponseSchema extends HttpResponseSchema> =
  undefined extends ResponseSchema['body'] ? { body?: null } : { body: ResponseSchema['body'] };

export type HttpRequestHandlerResponseHeadersAttribute<ResponseSchema extends HttpResponseSchema> =
  undefined extends ResponseSchema['headers']
    ? { headers?: undefined }
    : { headers: HttpHeadersInit<Default<ResponseSchema['headers']>> };

/** A declaration of an HTTP response for an intercepted request. */
export type HttpRequestHandlerResponseDeclaration<
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = StatusCode extends StatusCode
  ? {
      status: StatusCode;
    } & HttpRequestHandlerResponseBodyAttribute<Default<Default<MethodSchema['response']>[StatusCode]>> &
      HttpRequestHandlerResponseHeadersAttribute<Default<Default<MethodSchema['response']>[StatusCode]>>
  : never;

/**
 * A factory to create {@link HttpRequestHandlerResponseDeclaration} objects.
 *
 * @param request The intercepted request.
 * @returns The response declaration.
 */
export type HttpRequestHandlerResponseDeclarationFactory<
  Path extends string,
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = (
  request: Omit<HttpInterceptorRequest<Path, MethodSchema>, 'response'>,
) => PossiblePromise<HttpRequestHandlerResponseDeclaration<MethodSchema, StatusCode>>;

export type HttpRequestHeadersSchema<MethodSchema extends HttpMethodSchema> = Default<
  DefaultNoExclude<Default<MethodSchema['request']>['headers']>
>;

export type HttpRequestSearchParamsSchema<MethodSchema extends HttpMethodSchema> = Default<
  DefaultNoExclude<Default<MethodSchema['request']>['searchParams']>
>;

export type HttpRequestBodySchema<MethodSchema extends HttpMethodSchema> = ReplaceBy<
  ReplaceBy<IfNever<DefaultNoExclude<Default<MethodSchema['request']>['body']>, null>, undefined, null>,
  ArrayBuffer,
  Blob
>;

/**
 * A strict representation of an intercepted HTTP request. The body, search params and path params are already parsed by
 * default.
 */
export interface HttpInterceptorRequest<Path extends string, MethodSchema extends HttpMethodSchema>
  extends Omit<HttpRequest, keyof Body | 'headers' | 'clone'> {
  /** The headers of the request. */
  headers: HttpHeaders<HttpRequestHeadersSchema<MethodSchema>>;
  /** The path parameters of the request. They are parsed from the path string when using dynamic paths. */
  pathParams: InferPathParams<Path>;
  /** The search parameters of the request. */
  searchParams: HttpSearchParams<HttpRequestSearchParamsSchema<MethodSchema>>;
  /** The body of the request. It is already parsed by default. */
  body: ReplaceBy<HttpRequestBodySchema<MethodSchema>, ArrayBuffer, Blob>;
  /** The raw request object. */
  raw: HttpRequest<HttpRequestBodySchema<MethodSchema>>;
}

export type HttpResponseHeadersSchema<
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = IfNever<Default<DefaultNoExclude<Default<Default<MethodSchema['response']>[StatusCode]>['headers']>>, {}>;

export type HttpResponseBodySchema<
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> = ReplaceBy<
  ReplaceBy<
    IfNever<DefaultNoExclude<Default<Default<MethodSchema['response']>[StatusCode]>['body']>, null>,
    undefined,
    null
  >,
  ArrayBuffer,
  Blob
>;

/**
 * A strict representation of an intercepted HTTP response. The body, search params and path params are already parsed
 * by default.
 */
export interface HttpInterceptorResponse<
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpResponseSchemaStatusCode<Default<MethodSchema['response']>>,
> extends Omit<HttpResponse, keyof Body | 'headers' | 'clone'> {
  /** The headers of the response. */
  headers: HttpHeaders<HttpResponseHeadersSchema<MethodSchema, StatusCode>>;
  /** The status code of the response. */
  status: StatusCode;
  /** The body of the response. It is already parsed by default. */
  body: HttpResponseBodySchema<MethodSchema, StatusCode>;
  /** The raw response object. */
  raw: HttpResponse<HttpResponseBodySchema<MethodSchema, StatusCode>, StatusCode>;
}

export const HTTP_INTERCEPTOR_REQUEST_HIDDEN_PROPERTIES = Object.freeze(
  new Set<Exclude<keyof HttpRequest, keyof HttpInterceptorRequest<string, never>>>([
    'bodyUsed',
    'arrayBuffer',
    'blob',
    'formData',
    'json',
    'text',
    'clone',
  ]),
);

export const HTTP_INTERCEPTOR_RESPONSE_HIDDEN_PROPERTIES = Object.freeze(
  new Set<Exclude<keyof HttpResponse, keyof HttpInterceptorResponse<never, never>>>(
    HTTP_INTERCEPTOR_REQUEST_HIDDEN_PROPERTIES,
  ),
);

/**
 * A strict representation of an intercepted HTTP request, along with its response. The body, search params and path
 * params are already parsed by default.
 */
export interface TrackedHttpInterceptorRequest<
  Path extends string,
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpResponseSchemaStatusCode<Default<MethodSchema['response']>> = never,
> extends HttpInterceptorRequest<Path, MethodSchema> {
  /** The response that was returned for the intercepted request. */
  response: StatusCode extends [never] ? never : HttpInterceptorResponse<MethodSchema, StatusCode>;
}
