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

/**
 * The options to create a {@link FetchRequest} instance, compatible with
 * {@link https://developer.mozilla.org/docs/Web/API/RequestInit `RequestInit`}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetch `fetch` API reference}
 * @see {@link https://developer.mozilla.org/docs/Web/API/RequestInit `RequestInit`}
 */
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

/**
 * A request instance typed with an HTTP schema, closely compatible with the
 * {@link https://developer.mozilla.org/docs/Web/API/Request native Request class}.
 *
 * On top of the properties available in native {@link https://developer.mozilla.org/docs/Web/API/Request `Request`}
 * instances, fetch requests have their URL automatically prefixed with the base URL of their fetch instance. Default
 * options are also applied, if present in the fetch instance.
 *
 * The path of the request is extracted from the URL, excluding the base URL, and is available in the `path` property.
 *
 * @example
 *   import { type HttpSchema } from '@zimic/http';
 *   import { createFetch } from '@zimic/fetch';
 *
 *   interface User {
 *     id: string;
 *     username: string;
 *   }
 *
 *   type Schema = HttpSchema<{
 *     '/users': {
 *       POST: {
 *         request: {
 *           headers: { 'content-type': 'application/json' };
 *           body: { username: string };
 *         };
 *         response: {
 *           201: { body: User };
 *         };
 *       };
 *     };
 *   }>;
 *
 *   const fetch = createFetch<Schema>({
 *     baseURL: 'http://localhost:3000',
 *   });
 *
 *   const request = new fetch.Request('/users', {
 *     method: 'POST',
 *     headers: { 'content-type': 'application/json' },
 *     body: JSON.stringify({ username: 'me' }),
 *   });
 *
 *   console.log(request); // FetchRequest<Schema, 'POST', '/users'>
 *   console.log(request.path); // '/users'
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchrequest `FetchRequest` API reference}
 * @see {@link https://developer.mozilla.org/docs/Web/API/Request}
 */
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

/**
 * A {@link FetchResponse `FetchResponse`} instance with a specific status code.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchresponse `FetchResponse` API reference}
 * @see {@link https://developer.mozilla.org/docs/Web/API/Response}
 */
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

/**
 * A response instance typed with an HTTP schema, closely compatible with the
 * {@link https://developer.mozilla.org/docs/Web/API/Response native Response class}.
 *
 * On top of the properties available in native Response instances, fetch responses have a reference to the request that
 * originated them, available in the `request` property.
 *
 * If the response has a failure status code (4XX or 5XX), an error is available in the `error` property.
 *
 * @example
 *   import { type HttpSchema } from '@zimic/http';
 *   import { createFetch } from '@zimic/fetch';
 *
 *   interface User {
 *     id: string;
 *     username: string;
 *   }
 *
 *   type Schema = HttpSchema<{
 *     '/users/:userId': {
 *       GET: {
 *         response: {
 *           200: { body: User };
 *           404: { body: { message: string } };
 *         };
 *       };
 *     };
 *   }>;
 *
 *   const fetch = createFetch<Schema>({
 *     baseURL: 'http://localhost:3000',
 *   });
 *
 *   const response = await fetch(`/users/${userId}`, {
 *     method: 'GET',
 *   });
 *
 *   console.log(response); // FetchResponse<Schema, 'GET', '/users'>
 *
 *   if (response.status === 404) {
 *     const errorBody = await response.json(); // { message: string }
 *     console.error(errorBody.message);
 *     return null;
 *   } else {
 *     const user = await response.json(); // User
 *     return user;
 *   }
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchresponse `FetchResponse` API reference}
 * @see {@link https://developer.mozilla.org/docs/Web/API/Response}
 */
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

/**
 * A constructor for {@link FetchRequest} instances, typed with an HTTP schema and compatible with the
 * {@link https://developer.mozilla.org/docs/Web/API/Request Request class constructor}.
 *
 * @example
 *   import { type HttpSchema } from '@zimic/http';
 *   import { createFetch } from '@zimic/fetch';
 *
 *   type Schema = HttpSchema<{
 *     // ...
 *   }>;
 *
 *   const fetch = createFetch<Schema>({
 *     baseURL: 'http://localhost:3000',
 *   });
 *
 *   const request = new fetch.Request('POST', '/users', {
 *     body: JSON.stringify({ username: 'me' }),
 *   });
 *   console.log(request); // FetchRequest<Schema, 'POST', '/users'>
 *
 * @param input The resource to fetch, either a path, a URL, or a {@link FetchRequest request}. If a path is provided, it
 *   is automatically prefixed with the base URL of the fetch instance when the request is sent. If a URL or a request
 *   is provided, it is used as is.
 * @param init The request options. If a path or a URL is provided as the first argument, this argument is required and
 *   should contain at least the method of the request. If the first argument is a {@link FetchRequest request}, this
 *   argument is optional.
 * @returns A promise that resolves to the response to the request.
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchresponse `FetchResponse` API reference}
 * @see {@link https://developer.mozilla.org/docs/Web/API/Request}
 */
export type FetchRequestConstructor<Schema extends HttpSchema> = new <
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
>(
  input: FetchInput<Schema, Method, Path>,
  init: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
) => FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>;
