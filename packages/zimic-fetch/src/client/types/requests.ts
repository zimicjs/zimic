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
  export interface Loose extends Response {
    request: FetchRequest.Loose;
    error: AnyFetchRequestError | null;
    clone: () => Loose;
  }
}

export type FetchRequestConstructor<Schema extends HttpSchema> = new <
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
>(
  input: FetchInput<Schema, Method, Path>,
  init: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
) => FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>;
