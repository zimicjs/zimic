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
import { Default, IndexUnion, JSONStringified, UnionToIntersection } from '@zimic/utils/types';

import FetchResponseError, { AnyFetchRequestError } from '../errors/FetchResponseError';
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
        ? RequestSchema['body']
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
  method: Method;
  baseURL?: string;
  redirect?: Redirect;
  duplex?: 'half';
} & (Path extends Path ? FetchRequestInitPerPath<Default<Schema[Path][Method]>> : never);

/** @see {@link https://zimic.dev/docs/fetch/api/fetch `fetch` API reference} */
export namespace FetchRequestInit {
  type DefaultHeadersSchema<Schema extends HttpSchema> = {
    [Path in HttpSchemaPath.Literal<Schema>]: {
      [Method in keyof Schema[Path]]: HttpRequestHeadersSchema<Default<Schema[Path][Method]>>;
    }[keyof Schema[Path]];
  }[HttpSchemaPath.Literal<Schema>];

  export type DefaultHeaders<Schema extends HttpSchema> = {
    [HeaderName in keyof UnionToIntersection<Default<DefaultHeadersSchema<Schema>>>]?: IndexUnion<
      DefaultHeadersSchema<Schema>,
      HeaderName
    >;
  };

  type DefaultSearchParamsSchema<Schema extends HttpSchema> = {
    [Path in HttpSchemaPath.Literal<Schema>]: {
      [Method in keyof Schema[Path]]: HttpRequestSearchParamsSchema<Default<Schema[Path][Method]>>;
    }[keyof Schema[Path]];
  }[HttpSchemaPath.Literal<Schema>];

  export type DefaultSearchParams<Schema extends HttpSchema> = {
    [SearchParamName in keyof UnionToIntersection<Default<DefaultSearchParamsSchema<Schema>>>]?: IndexUnion<
      DefaultSearchParamsSchema<Schema>,
      SearchParamName
    >;
  };

  export type DefaultBody<Schema extends HttpSchema> = {
    [Path in HttpSchemaPath.Literal<Schema>]: {
      [Method in keyof Schema[Path]]: FetchRequestBodySchema<
        Default<Schema[Path][Method]> extends HttpMethodSchema
          ? Default<Default<Schema[Path][Method]>['request']>
          : never
      >;
    }[keyof Schema[Path]];
  }[HttpSchemaPath.Literal<Schema>];

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch#fetch-defaults `fetch` defaults API reference} */
  export interface Defaults<Schema extends HttpSchema = HttpSchema> extends Omit<RequestInit, 'headers' | 'body'> {
    baseURL: string;
    headers?: DefaultHeaders<Schema>;
    searchParams?: DefaultSearchParams<Schema>;
    body?: DefaultBody<Schema>;
    duplex?: 'half';
  }

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch `fetch` API reference} */
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
  path: AllowAnyStringInPathParams<Path>;
  method: Method;
}

export namespace FetchRequest {
  /** A loosely typed version of a {@link FetchRequest `FetchRequest`}. */
  export interface Loose extends Request {
    path: string;
    method: HttpMethod;
    clone: () => Loose;
  }
}

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `error.toObject()`} */
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
  headers: HttpHeadersSerialized<HttpHeadersSchema>;
  body?: HttpBody | null;
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
  request: FetchRequest<Schema, Method, Path>;
  error: FetchResponseError<Schema, Method, Path>;
}

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response `FetchResponse` API reference} */
export type FetchResponse<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
  /** @deprecated The type parameter `ErrorOnly` will be removed in the next major version. */
  ErrorOnly extends boolean = false,
  Redirect extends RequestRedirect = 'follow',
  StatusCode extends FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect> =
    FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect>,
> = StatusCode extends StatusCode ? FetchResponsePerStatusCode<Schema, Method, Path, StatusCode> : never;

export namespace FetchResponse {
  /** A loosely typed version of a {@link FetchResponse}. */
  export interface Loose extends Response {
    request: FetchRequest.Loose;
    error: AnyFetchRequestError | null;
    clone: () => Loose;
  }
}

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `error.toObject()`} */
export type FetchResponseObject = Pick<
  FetchResponse.Loose,
  'url' | 'type' | 'status' | 'statusText' | 'ok' | 'redirected'
> & {
  headers: HttpHeadersSerialized<HttpHeadersSchema>;
  body?: HttpBody | null;
};

/** @see {@link https://zimic.dev/docs/fetch/api/fetch#fetchrequest `fetch.Request` API reference} */
export type FetchRequestConstructor<Schema extends HttpSchema> = new <
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
>(
  input: FetchInput<Schema, Method, Path>,
  init: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
) => FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>;
