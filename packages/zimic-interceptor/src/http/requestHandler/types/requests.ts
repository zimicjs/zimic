import {
  HttpHeaders,
  HttpHeadersInit,
  HttpMethodSchema,
  HttpRequest,
  HttpRequestBodySchema,
  HttpRequestHeadersSchema,
  HttpRequestSearchParamsSchema,
  HttpResponse,
  HttpResponseBodySchema,
  HttpResponseHeadersSchema,
  HttpResponseSchema,
  HttpSearchParams,
  HttpStatusCode,
  InferPathParams,
} from '@zimic/http';
import { Default, PartialByKey, PossiblePromise, ReplaceBy } from '@zimic/utils/types';

export type HttpRequestHandlerResponseWithBody<ResponseSchema extends HttpResponseSchema> =
  unknown extends ResponseSchema['body']
    ? { body?: null }
    : undefined extends ResponseSchema['body']
      ? { body?: ReplaceBy<ReplaceBy<ResponseSchema['body'], undefined, null>, ArrayBuffer, Blob> }
      : { body: ReplaceBy<ResponseSchema['body'], ArrayBuffer, Blob> };

type HttpRequestHandlerResponseHeaders<ResponseSchema extends HttpResponseSchema> = HttpHeadersInit<
  PartialByKey<Default<ResponseSchema['headers']>, 'content-type'>
>;

export type HttpRequestHandlerResponseWithHeaders<ResponseSchema extends HttpResponseSchema> =
  undefined extends ResponseSchema['headers']
    ? { headers?: HttpRequestHandlerResponseHeaders<ResponseSchema> }
    : keyof ResponseSchema['headers'] extends 'content-type'
      ? { headers?: HttpRequestHandlerResponseHeaders<ResponseSchema> }
      : { headers: HttpRequestHandlerResponseHeaders<ResponseSchema> };

/** A declaration of an HTTP response for an intercepted request. */
export type HttpRequestHandlerResponseDeclaration<
  MethodSchema extends HttpMethodSchema = HttpMethodSchema,
  StatusCode extends HttpStatusCode = HttpStatusCode,
> = StatusCode extends StatusCode
  ? {
      status: StatusCode;
    } & HttpRequestHandlerResponseWithBody<Default<Default<MethodSchema['response']>[StatusCode]>> &
      HttpRequestHandlerResponseWithHeaders<Default<Default<MethodSchema['response']>[StatusCode]>>
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
  StatusCode extends HttpStatusCode = HttpStatusCode,
> = (
  request: Omit<HttpInterceptorRequest<Path, MethodSchema>, 'response'>,
) => PossiblePromise<HttpRequestHandlerResponseDeclaration<MethodSchema, StatusCode>>;

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

/**
 * A strict representation of an intercepted HTTP response. The body, search params and path params are already parsed
 * by default.
 */
export interface HttpInterceptorResponse<MethodSchema extends HttpMethodSchema, StatusCode extends HttpStatusCode>
  extends Omit<HttpResponse, keyof Body | 'headers' | 'clone'> {
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
  StatusCode extends HttpStatusCode = never,
> extends HttpInterceptorRequest<Path, MethodSchema> {
  /** The response that was returned for the intercepted request. */
  response: StatusCode extends [never] ? never : HttpInterceptorResponse<MethodSchema, StatusCode>;
}
