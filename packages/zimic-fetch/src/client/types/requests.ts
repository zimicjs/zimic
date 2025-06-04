import {
  HttpRequestSchema,
  HttpMethod,
  HttpSchema,
  HttpSchemaPath,
  HttpSchemaMethod,
  HttpMethodSchema,
  HttpResponseSchemaStatusCode,
  HttpStatusCode,
  HttpResponse,
  HttpRequest,
  AllowAnyStringInPathParams,
  LiteralHttpSchemaPathFromNonLiteral,
  HttpResponseBodySchema,
  HttpResponseHeadersSchema,
  HttpRequestHeadersSchema,
  HttpHeadersSchema,
  HttpSearchParamsSchema,
  HttpHeadersInit,
  HttpHeadersSerialized,
  HttpSearchParamsInit,
  HttpBody,
  HttpRequestBodySchema,
  HttpRequestSearchParamsSchema,
  HttpSearchParams,
  HttpFormData,
} from '@zimic/http';
import { Default } from '@zimic/utils/types';

import FetchResponseError, { AnyFetchRequestError } from '../errors/FetchResponseError';
import { JSONStringified } from './json';
import { FetchInput } from './public';

type FetchRequestInitWithHeaders<HeadersSchema extends HttpHeadersSchema | undefined> = [HeadersSchema] extends [never]
  ? { headers?: undefined }
  : undefined extends HeadersSchema
    ? { headers?: HttpHeadersInit<Default<HeadersSchema>> }
    : { headers: HttpHeadersInit<Default<HeadersSchema>> };

type FetchRequestInitWithSearchParams<SearchParamsSchema extends HttpSearchParamsSchema | undefined> = [
  SearchParamsSchema,
] extends [never]
  ? { searchParams?: undefined }
  : undefined extends SearchParamsSchema
    ? { searchParams?: HttpSearchParamsInit<Default<SearchParamsSchema>> }
    : { searchParams: HttpSearchParamsInit<Default<SearchParamsSchema>> };

type FetchRequestBodySchema<RequestSchema extends HttpRequestSchema> = 'body' extends keyof RequestSchema
  ? [RequestSchema['body']] extends [never]
    ? null | undefined
    : [Extract<RequestSchema['body'], BodyInit | HttpSearchParams | HttpFormData>] extends [never]
      ? undefined extends RequestSchema['body']
        ? JSONStringified<Exclude<RequestSchema['body'], null | undefined>> | null | undefined
        : JSONStringified<Exclude<RequestSchema['body'], null>> | Extract<RequestSchema['body'], null>
      : undefined extends RequestSchema['body']
        ? RequestSchema['body'] | null
        : RequestSchema['body']
  : null | undefined;

type FetchRequestInitWithBody<BodySchema extends HttpBody> = [BodySchema] extends [never]
  ? { body?: BodySchema }
  : undefined extends BodySchema
    ? { body?: BodySchema }
    : { body: BodySchema };

type FetchRequestInitPerPath<MethodSchema extends HttpMethodSchema> = FetchRequestInitWithHeaders<
  HttpRequestHeadersSchema<MethodSchema>
> &
  FetchRequestInitWithSearchParams<HttpRequestSearchParamsSchema<MethodSchema>> &
  FetchRequestInitWithBody<FetchRequestBodySchema<Default<MethodSchema['request']>>>;

/** @see {@link https://zimic.dev/docs/fetch/api/fetch `fetch` API reference} */
export type FetchRequestInit<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  Redirect extends RequestRedirect = 'follow',
> = Omit<RequestInit, 'method' | 'headers' | 'body'> & {
  /** The HTTP method of the request. */
  method: Method;
  /** The base URL to prefix the path of the request. */
  baseURL?: string;
  redirect?: Redirect;
} & (Path extends Path ? FetchRequestInitPerPath<Default<Schema[Path][Method]>> : never);

export namespace FetchRequestInit {
  /** The default options for each request sent by a fetch instance. */
  export interface Defaults extends Omit<RequestInit, 'headers'> {
    baseURL: string;
    /** The HTTP method of the request. */
    method?: HttpMethod;
    /** The headers of the request. */
    headers?: HttpHeadersSchema.Loose;
    /** The search parameters of the request. */
    searchParams?: HttpSearchParamsSchema.Loose;
  }

  /** A loosely typed version of {@link FetchRequestInit `FetchRequestInit`}. */
  export type Loose = Partial<Defaults>;
}

type AllFetchResponseStatusCode<MethodSchema extends HttpMethodSchema> = HttpResponseSchemaStatusCode<
  Default<MethodSchema['response']>
>;

type FilterFetchResponseStatusCodeByError<
  StatusCode extends HttpStatusCode,
  ErrorOnly extends boolean,
> = ErrorOnly extends true ? Extract<StatusCode, HttpStatusCode.ClientError | HttpStatusCode.ServerError> : StatusCode;

type FilterFetchResponseStatusCodeByRedirect<
  StatusCode extends HttpStatusCode,
  Redirect extends RequestRedirect,
> = Redirect extends 'error'
  ? FilterFetchResponseStatusCodeByRedirect<StatusCode, 'follow'>
  : Redirect extends 'follow'
    ? Exclude<StatusCode, Exclude<HttpStatusCode.Redirection, 304>>
    : StatusCode;

type FetchResponseStatusCode<
  MethodSchema extends HttpMethodSchema,
  ErrorOnly extends boolean,
  Redirect extends RequestRedirect,
> = FilterFetchResponseStatusCodeByRedirect<
  FilterFetchResponseStatusCodeByError<AllFetchResponseStatusCode<MethodSchema>, ErrorOnly>,
  Redirect
>;

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-request `FetchRequest` API reference} */
export interface FetchRequest<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
> extends HttpRequest<
    HttpRequestBodySchema<Default<Schema[Path][Method]>>,
    Default<HttpRequestHeadersSchema<Default<Schema[Path][Method]>>>
  > {
  /** The path of the request, excluding the base URL. */
  path: AllowAnyStringInPathParams<Path>;
  /** The HTTP method of the request. */
  method: Method;
}

export namespace FetchRequest {
  /** A loosely typed version of a {@link FetchRequest `FetchRequest`}. */
  export interface Loose extends Request {
    /** The path of the request, excluding the base URL. */
    path: string;
    /** The HTTP method of the request. */
    method: HttpMethod;
    /** Clones the request instance, returning a new instance with the same properties. */
    clone: () => Loose;
  }
}

/**
 * A plain object representation of a {@link FetchRequest `FetchRequest`}, compatible with JSON.
 *
 * If the body is included in the object, it is represented as a string or null if empty.
 */
export type FetchRequestObject = Pick<
  FetchRequest.Loose,
  | 'url'
  | 'path'
  | 'method'
  | 'cache'
  | 'destination'
  | 'credentials'
  | 'integrity'
  | 'keepalive'
  | 'mode'
  | 'redirect'
  | 'referrer'
  | 'referrerPolicy'
> & {
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/headers) */
  headers: HttpHeadersSerialized<HttpHeadersSchema>;
  /**
   * The body of the response, represented as a string or null if empty.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/body)
   */
  body?: string | null;
};

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response `FetchResponse` API reference} */
export interface FetchResponsePerStatusCode<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
  StatusCode extends HttpStatusCode = HttpStatusCode,
> extends HttpResponse<
    HttpResponseBodySchema<Default<Schema[Path][Method]>, StatusCode>,
    Default<HttpResponseHeadersSchema<Default<Schema[Path][Method]>, StatusCode>>,
    StatusCode
  > {
  /** The request that originated the response. */
  request: FetchRequest<Schema, Method, Path>;

  /**
   * An error representing a response with a failure status code (4XX or 5XX). It can be thrown to handle the error
   * upper in the call stack.
   *
   * If the response has a success status code (1XX, 2XX or 3XX), this property will be null.
   */
  error: StatusCode extends HttpStatusCode.ClientError | HttpStatusCode.ServerError
    ? FetchResponseError<Schema, Method, Path>
    : null;
}

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response `FetchResponse` API reference} */
export type FetchResponse<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
  ErrorOnly extends boolean = false,
  Redirect extends RequestRedirect = 'follow',
  StatusCode extends FetchResponseStatusCode<
    Default<Schema[Path][Method]>,
    ErrorOnly,
    Redirect
  > = FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect>,
> = StatusCode extends StatusCode ? FetchResponsePerStatusCode<Schema, Method, Path, StatusCode> : never;

export namespace FetchResponse {
  /** A loosely typed version of a {@link FetchResponse}. */
  export interface Loose extends Response {
    /** The request that originated the response. */
    request: FetchRequest.Loose;

    /**
     * An error representing a response with a failure status code (4XX or 5XX). It can be thrown to handle the error
     * upper in the call stack.
     *
     * If the response has a success status code (1XX, 2XX or 3XX), this property will be null.
     */
    error: AnyFetchRequestError | null;

    /** Clones the request instance, returning a new instance with the same properties. */
    clone: () => Loose;
  }
}

/**
 * A plain object representation of a {@link FetchResponse `FetchResponse`}, compatible with JSON.
 *
 * If the body is included in the object, it is represented as a string or null if empty.
 */
export type FetchResponseObject = Pick<
  FetchResponse.Loose,
  'url' | 'type' | 'status' | 'statusText' | 'ok' | 'redirected'
> & {
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/headers) */
  headers: HttpHeadersSerialized<HttpHeadersSchema>;
  /**
   * The body of the response, represented as a string or null if empty.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/body)
   */
  body?: string | null;
};

/** @see {@link https://zimic.dev/docs/fetch/api/fetch#fetchrequest `fetch.Request` API reference} */
export type FetchRequestConstructor<Schema extends HttpSchema> = new <
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
>(
  input: FetchInput<Schema, Method, Path>,
  init: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
) => FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>;
