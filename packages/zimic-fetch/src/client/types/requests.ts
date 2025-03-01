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
  HttpSearchParams,
  HttpHeaders,
  AllowAnyStringInPathParams,
  LiteralHttpSchemaPathFromNonLiteral,
  JSONValue,
  HttpResponseBodySchema,
  HttpResponseHeadersSchema,
  HttpRequestHeadersSchema,
  HttpHeadersSchema,
  HttpSearchParamsSchema,
} from '@zimic/http';
import { Default, DefaultNoExclude, IfNever, ReplaceBy } from '@zimic/utils/types';

import FetchResponseError, { AnyFetchRequestError } from '../errors/FetchResponseError';
import { JSONStringified } from './json';
import { FetchInput } from './public';

type FetchRequestInitHeaders<RequestSchema extends HttpRequestSchema> =
  | RequestSchema['headers']
  | HttpHeaders<Default<RequestSchema['headers']>>;

type FetchRequestInitWithHeaders<RequestSchema extends HttpRequestSchema> = [RequestSchema['headers']] extends [never]
  ? { headers?: undefined }
  : undefined extends RequestSchema['headers']
    ? { headers?: FetchRequestInitHeaders<RequestSchema> }
    : { headers: FetchRequestInitHeaders<RequestSchema> };

type FetchRequestInitSearchParams<RequestSchema extends HttpRequestSchema> =
  | RequestSchema['searchParams']
  | HttpSearchParams<Default<RequestSchema['searchParams']>>;

type FetchRequestInitWithSearchParams<RequestSchema extends HttpRequestSchema> = [
  RequestSchema['searchParams'],
] extends [never]
  ? { searchParams?: undefined }
  : undefined extends RequestSchema['searchParams']
    ? { searchParams?: FetchRequestInitSearchParams<RequestSchema> }
    : { searchParams: FetchRequestInitSearchParams<RequestSchema> };

type FetchRequestInitWithBody<RequestSchema extends HttpRequestSchema> = [RequestSchema['body']] extends [never]
  ? { body?: null }
  : RequestSchema['body'] extends string
    ? undefined extends RequestSchema['body']
      ? { body?: ReplaceBy<RequestSchema['body'], undefined, null> }
      : { body: RequestSchema['body'] }
    : RequestSchema['body'] extends JSONValue
      ? undefined extends RequestSchema['body']
        ? { body?: JSONStringified<ReplaceBy<RequestSchema['body'], undefined, null>> }
        : { body: JSONStringified<RequestSchema['body']> }
      : undefined extends RequestSchema['body']
        ? { body?: ReplaceBy<RequestSchema['body'], undefined, null> }
        : { body: RequestSchema['body'] };

type FetchRequestInitPerPath<RequestSchema extends HttpRequestSchema> = FetchRequestInitWithHeaders<RequestSchema> &
  FetchRequestInitWithSearchParams<RequestSchema> &
  FetchRequestInitWithBody<RequestSchema>;

/**
 * The options to create a {@link FetchRequest} instance.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetch `fetch` API reference}
 * @see {@link https://developer.mozilla.org/docs/Web/API/RequestInit}
 */
export type FetchRequestInit<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  Redirect extends RequestRedirect = 'follow',
> = Omit<RequestInit, 'method' | 'headers' | 'body'> & {
  method: Method;
  baseURL?: string;
  redirect?: Redirect;
} & (Path extends Path ? FetchRequestInitPerPath<Default<Default<Schema[Path][Method]>['request']>> : never);

export namespace FetchRequestInit {
  /** The default options for each request sent by a fetch instance. */
  export interface Defaults extends Omit<RequestInit, 'headers'> {
    baseURL: string;
    method?: HttpMethod;
    headers?: HttpHeadersSchema;
    searchParams?: HttpSearchParamsSchema;
  }

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

type HttpRequestBodySchema<MethodSchema extends HttpMethodSchema> = ReplaceBy<
  ReplaceBy<IfNever<DefaultNoExclude<Default<MethodSchema['request']>['body']>, null>, undefined, null>,
  ArrayBuffer,
  Blob
>;

/**
 * A request instance typed with an HTTP schema, closely compatible with the
 * {@link https://developer.mozilla.org/docs/Web/API/Request native Request class}.
 *
 * On top of the properties available in native Request instances, fetch requests have their URL automatically prefixed
 * with the base URL of their fetch instance. Default options are also applied, if present in the fetch instance.
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
 *   console.log(request); // FetchRequest<Schema, 'POST', '/users'>
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
    HttpRequestHeadersSchema<Default<Schema[Path][Method]>>
  > {
  path: AllowAnyStringInPathParams<Path>;
  method: Method;
}

export namespace FetchRequest {
  /** A loosely typed version of {@link FetchRequest}. */
  export interface Loose extends Request {
    path: string;
    method: HttpMethod;
    clone: () => Loose;
  }
}

export interface FetchResponsePerStatusCode<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
  StatusCode extends HttpStatusCode = HttpStatusCode,
> extends HttpResponse<
    HttpResponseBodySchema<Default<Schema[Path][Method]>, StatusCode>,
    StatusCode,
    HttpResponseHeadersSchema<Default<Schema[Path][Method]>, StatusCode>
  > {
  request: FetchRequest<Schema, Method, Path>;

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
  /** A loosely typed version of {@link FetchResponse}. */
  export interface Loose extends Response {
    request: FetchRequest.Loose;
    error: AnyFetchRequestError | null;
    clone: () => Loose;
  }
}

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
