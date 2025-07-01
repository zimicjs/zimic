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

type HttpRequestHandlerResponseBody<
  ResponseSchema extends HttpResponseSchema,
  StatusCode extends HttpStatusCode,
> = HttpResponseBodySchema<{ response: { [Code in StatusCode]: ResponseSchema } }, StatusCode>;

export type HttpRequestHandlerResponseWithBody<
  ResponseSchema extends HttpResponseSchema,
  StatusCode extends HttpStatusCode,
> = unknown extends ResponseSchema['body']
  ? { body?: null }
  : undefined extends ResponseSchema['body']
    ? { body?: HttpRequestHandlerResponseBody<ResponseSchema, StatusCode> }
    : { body: HttpRequestHandlerResponseBody<ResponseSchema, StatusCode> };

type HttpRequestHandlerResponseDeclarationHeaders<ResponseSchema extends HttpResponseSchema> = HttpHeadersInit<
  PartialByKey<Default<ResponseSchema['headers']>, 'content-type'>
>;

export type HttpRequestHandlerResponseDeclarationWithHeaders<ResponseSchema extends HttpResponseSchema> =
  undefined extends ResponseSchema['headers']
    ? { headers?: HttpRequestHandlerResponseDeclarationHeaders<ResponseSchema> }
    : Exclude<keyof ResponseSchema['headers'], symbol> extends 'content-type'
      ? { headers?: HttpRequestHandlerResponseDeclarationHeaders<ResponseSchema> }
      : { headers: HttpRequestHandlerResponseDeclarationHeaders<ResponseSchema> };

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrespond `handler.respond()` API reference} */
export type HttpRequestHandlerResponseDeclaration<
  MethodSchema extends HttpMethodSchema = HttpMethodSchema,
  StatusCode extends HttpStatusCode = HttpStatusCode,
> = StatusCode extends StatusCode
  ? { status: StatusCode } & HttpRequestHandlerResponseWithBody<
      Default<Default<MethodSchema['response']>[StatusCode]>,
      StatusCode
    > &
      HttpRequestHandlerResponseDeclarationWithHeaders<Default<Default<MethodSchema['response']>[StatusCode]>>
  : never;

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrespond `handler.respond()` API reference} */
export type HttpRequestHandlerResponseDeclarationFactory<
  Path extends string,
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpStatusCode = HttpStatusCode,
> = (
  request: Omit<HttpInterceptorRequest<Path, MethodSchema>, 'response'>,
) => PossiblePromise<HttpRequestHandlerResponseDeclaration<MethodSchema, StatusCode>>;

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrequests `handler.requests` API reference} */
export interface HttpInterceptorRequest<Path extends string, MethodSchema extends HttpMethodSchema>
  extends Omit<HttpRequest, keyof Body | 'headers' | 'clone'> {
  /**
   * The headers of the request.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/headers#using-request-headers Using request headers}
   */
  headers: HttpHeaders<Default<HttpRequestHeadersSchema<MethodSchema>>>;

  /**
   * The path parameters of the request. They are parsed from the path string when using dynamic paths.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/path-params#using-request-path-params Using request path parameters}
   */
  pathParams: InferPathParams<Path>;

  /**
   * The search parameters of the request.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/search-params#using-request-search-params Using request search parameters}
   */
  searchParams: HttpSearchParams<Default<HttpRequestSearchParamsSchema<MethodSchema>>>;

  /**
   * The body of the request. It is already parsed by default as detailed in
   * {@link https://zimic.dev/docs/interceptor/guides/http/bodies#default-body-parsing Default body parsing}.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/bodies#using-request-bodies Using request bodies}
   */
  body: ReplaceBy<HttpRequestBodySchema<MethodSchema>, ArrayBuffer | ReadableStream, Blob>;

  /** The raw request object. */
  raw: HttpRequest<HttpRequestBodySchema<MethodSchema>, Default<HttpRequestHeadersSchema<MethodSchema>>>;
}

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrequests `handler.requests` API reference} */
export interface HttpInterceptorResponse<MethodSchema extends HttpMethodSchema, StatusCode extends HttpStatusCode>
  extends Omit<HttpResponse, keyof Body | 'headers' | 'clone'> {
  /**
   * The headers of the response.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/headers#using-response-headers Using response headers}
   */
  headers: HttpHeaders<Default<HttpResponseHeadersSchema<MethodSchema, StatusCode>>>;

  /** The status code of the response. */
  status: StatusCode;

  /**
   * The body of the response. It is already parsed by default as detailed in
   * {@link https://zimic.dev/docs/interceptor/guides/http/bodies#default-body-parsing Default body parsing}.
   *
   * @see {@link https://zimic.dev/docs/interceptor/guides/http/bodies#using-response-bodies Using response bodies}
   */
  body: ReplaceBy<HttpResponseBodySchema<MethodSchema, StatusCode>, ArrayBuffer | ReadableStream, Blob>;

  /** The raw response object. */
  raw: HttpResponse<
    HttpResponseBodySchema<MethodSchema, StatusCode>,
    Default<HttpResponseHeadersSchema<MethodSchema, StatusCode>>,
    StatusCode
  >;
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

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrequests `handler.requests` API reference} */
export interface InterceptedHttpInterceptorRequest<
  Path extends string,
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpStatusCode = never,
> extends HttpInterceptorRequest<Path, MethodSchema> {
  /** The response that was returned for the intercepted request. */
  response: StatusCode extends [never] ? never : HttpInterceptorResponse<MethodSchema, StatusCode>;
}
