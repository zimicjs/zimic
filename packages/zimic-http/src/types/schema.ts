import {
  IfAny,
  UnionToIntersection,
  UnionHasMoreThanOneType,
  Prettify,
  NonEmptyArray,
  Branded,
} from '@zimic/utils/types';

import { HttpFormDataSchema } from '../formData/types';
import { HttpHeadersSchema } from '../headers/types';
import { HttpPathParamsSchema } from '../pathParams/types';
import { HttpSearchParamsSchema } from '../searchParams/types';
import { HttpBody } from './requests';

export const HTTP_METHODS = Object.freeze(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const);
/**
 * A type representing the currently supported
 * {@link https://developer.mozilla.org/docs/Web/HTTP/Methods `HTTP methods`}.
 */
export type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * A schema representing the structure of an HTTP request.
 *
 * @see {@link https://zimic.dev/docs/http/api/http-schema `HttpSchema` API reference}
 */
export interface HttpRequestSchema {
  headers?: HttpHeadersSchema.Loose;
  searchParams?: HttpSearchParamsSchema.Loose;
  body?: HttpBody.Loose;
}

/**
 * A schema representing the structure of an HTTP response.
 *
 * @see {@link https://zimic.dev/docs/http/api/http-schema `HttpSchema` API reference}
 */
export interface HttpResponseSchema {
  headers?: HttpHeadersSchema.Loose;
  body?: HttpBody.Loose;
}

/**
 * The status codes used in HTTP responses, as defined by
 * {@link https://httpwg.org/specs/rfc9110.html#overview.of.status.codes RFC-9110}.
 *
 * - `HttpStatusCode.Information`: {@link https://developer.mozilla.org/docs/Web/HTTP/Status#information_responses `1XX`}
 * - `HttpStatusCode.Success`: {@link https://developer.mozilla.org/docs/Web/HTTP/Status#successful_responses `2XX`}
 * - `HttpStatusCode.Redirection`: {@link https://developer.mozilla.org/docs/Web/HTTP/Status#redirection_messages `3XX`}
 * - `HttpStatusCode.ClientError`: {@link https://developer.mozilla.org/docs/Web/HTTP/Status#client_error_responses `4XX`}
 * - `HttpStatusCode.ServerError`: {@link https://developer.mozilla.org/docs/Web/HTTP/Status#server_error_responses `5XX`}
 */
export type HttpStatusCode =
  | HttpStatusCode.Information
  | HttpStatusCode.Success
  | HttpStatusCode.Redirection
  | HttpStatusCode.ClientError
  | HttpStatusCode.ServerError;

export namespace HttpStatusCode {
  /**
   * An HTTP status code in the `1XX` range, representing an informational response.
   *
   * @see {@link https://developer.mozilla.org/docs/Web/HTTP/Status#information_responses `1XX`}
   */
  export type Information =
    | 100 // Continue
    | 101 // Switching Protocols
    | 102 // Processing
    | 103; // Early Hints

  /**
   * An HTTP status code in the `2XX` range, representing a successful response.
   *
   * @see {@link https://developer.mozilla.org/docs/Web/HTTP/Status#successful_responses `2XX`}
   */
  export type Success =
    | 200 // OK
    | 201 // Created
    | 202 // Accepted
    | 203 // Non-Authoritative Information
    | 204 // No Content
    | 205 // Reset Content
    | 206 // Partial Content
    | 207 // Multi-Status
    | 208 // Already Reported
    | 226; // IM Used

  /**
   * An HTTP status code in the `3XX` range, representing a redirection response.
   *
   * @see {@link https://developer.mozilla.org/docs/Web/HTTP/Status#redirection_messages `3XX`}
   */
  export type Redirection =
    | 300 // Multiple Choices
    | 301 // Moved Permanently
    | 302 // Found
    | 303 // See Other
    | 304 // Not Modified
    | 307 // Temporary Redirect
    | 308; // Permanent Redirect

  /**
   * An HTTP status code in the `4XX` range, representing a client error response.
   *
   * @see {@link https://developer.mozilla.org/docs/Web/HTTP/Status#client_error_responses `4XX`}
   */
  export type ClientError =
    | 400 // Bad Request
    | 401 // Unauthorized
    | 402 // Payment Required
    | 403 // Forbidden
    | 404 // Not Found
    | 405 // Method Not Allowed
    | 406 // Not Acceptable
    | 407 // Proxy Authentication Required
    | 408 // Request Timeout
    | 409 // Conflict
    | 410 // Gone
    | 411 // Length Required
    | 412 // Precondition Failed
    | 413 // Content Too Large
    | 414 // URI Too Long
    | 415 // Unsupported Media Type
    | 416 // Range Not Satisfiable
    | 417 // Expectation Failed
    | 418 // I'm a teapot
    | 421 // Misdirected Request
    | 422 // Unprocessable Content
    | 423 // Locked
    | 424 // Failed Dependency
    | 425 // Too Early
    | 426 // Upgrade Required
    | 428 // Precondition Required
    | 429 // Too Many Requests
    | 431 // Request Header Fields Too Large
    | 451; // Unavailable For Legal Reasons

  /**
   * An HTTP status code in the `5XX` range, representing a server error response.
   *
   * @see {@link https://developer.mozilla.org/docs/Web/HTTP/Status#server_error_responses `5XX`}
   */
  export type ServerError =
    | 500 // Internal Server Error
    | 501 // Not Implemented
    | 502 // Bad Gateway
    | 503 // Service Unavailable
    | 504 // Gateway Timeout
    | 505 // HTTP Version Not Supported
    | 506 // Variant Also Negotiates
    | 507 // Insufficient Storage
    | 508 // Loop Detected
    | 510 // Not Extended
    | 511; // Network Authentication Required
}

/**
 * A schema representing the structure of HTTP responses by status code.
 *
 * @see {@link https://zimic.dev/docs/http/api/http-schema `HttpSchema` API reference}
 */
export type HttpResponseSchemaByStatusCode = {
  [StatusCode in HttpStatusCode]?: HttpResponseSchema;
};

/**
 * Extracts the status codes used in a response schema by status code.
 *
 * @see {@link https://zimic.dev/docs/http/api/http-schema `HttpSchema` API reference}
 */
export type HttpResponseSchemaStatusCode<ResponseSchemaByStatusCode extends HttpResponseSchemaByStatusCode> =
  keyof ResponseSchemaByStatusCode & HttpStatusCode;

/**
 * A schema representing the structure of an HTTP request and response for a given method.
 *
 * @see {@link https://zimic.dev/docs/http/api/http-schema `HttpSchema` API reference}
 */
export interface HttpMethodSchema {
  request?: HttpRequestSchema;
  response?: HttpResponseSchemaByStatusCode;
}

/**
 * A schema representing the structure of HTTP request and response by method.
 *
 * @see {@link https://zimic.dev/docs/http/api/http-schema `HttpSchema` API reference}
 */
export interface HttpMethodsSchema {
  GET?: HttpMethodSchema;
  POST?: HttpMethodSchema;
  PUT?: HttpMethodSchema;
  PATCH?: HttpMethodSchema;
  DELETE?: HttpMethodSchema;
  HEAD?: HttpMethodSchema;
  OPTIONS?: HttpMethodSchema;
}

interface BaseHttpSchema {
  [path: string]: HttpMethodsSchema;
}

/** @see {@link https://zimic.dev/docs/http/api/http-schema `HttpSchema` API reference} */
export type HttpSchema<Schema extends BaseHttpSchema = BaseHttpSchema> = Branded<Schema, 'HttpSchema'>;

export namespace HttpSchema {
  /** @see {@link https://zimic.dev/docs/http/api/http-schema#httpschemamethods `HttpSchema.Methods` API reference} */
  export type Methods<Schema extends HttpMethodsSchema> = Schema;

  /** @see {@link https://zimic.dev/docs/http/api/http-schema#httpschemamethod `HttpSchema.Method` API reference} */
  export type Method<Schema extends HttpMethodSchema> = Schema;

  /** @see {@link https://zimic.dev/docs/http/api/http-schema#httpschemarequest `HttpSchema.Request` API reference} */
  export type Request<Schema extends HttpRequestSchema> = Schema;

  /** @see {@link https://zimic.dev/docs/http/api/http-schema#httpschemaresponsebystatuscode `HttpSchema.ResponseByStatusCode` API reference} */
  export type ResponseByStatusCode<Schema extends HttpResponseSchemaByStatusCode> = Schema;

  /** @see {@link https://zimic.dev/docs/http/api/http-schema#httpschemaresponse  `HttpSchema.Response` API reference} */
  export type Response<Schema extends HttpResponseSchema> = Schema;

  /** @see {@link https://zimic.dev/docs/http/api/http-schema#httpschemabody `HttpSchema.Body` API reference} */
  export type Body<Schema extends HttpBody.Loose> = Schema;

  /** @see {@link https://zimic.dev/docs/http/api/http-schema#httpschemaheaders `HttpSchema.Headers` API reference} */
  export type Headers<Schema extends HttpHeadersSchema.Loose> = Schema;

  /** @see {@link https://zimic.dev/docs/http/api/http-schema#httpschemasearchparams `HttpSchema.SearchParams` API reference} */
  export type SearchParams<Schema extends HttpSearchParamsSchema.Loose> = Schema;

  /** @see {@link https://zimic.dev/docs/http/api/http-schema#httpschemapathparams `HttpSchema.PathParams` API reference} */
  export type PathParams<Schema extends HttpPathParamsSchema.Loose> = Schema;

  /** @see {@link https://zimic.dev/docs/http/api/http-schema#httpschemaformdata `HttpSchema.FormData` API reference} */
  export type FormData<Schema extends HttpFormDataSchema.Loose> = Schema;
}

/**
 * Extracts the methods from an HTTP service schema.
 *
 * @see {@link https://zimic.dev/docs/http/api/http-schema `HttpSchema` API reference}
 */
export type HttpSchemaMethod<Schema extends HttpSchema> = IfAny<
  Schema,
  any, // eslint-disable-line @typescript-eslint/no-explicit-any
  keyof UnionToIntersection<Schema[keyof Schema]> & HttpMethod
>;

type RepeatingPathParamModifier = '+';
type OptionalPathParamModifier = '?' | '*';

type ConvertPathParamToRecord<PathParam extends string> = PathParam extends `${infer PathParamWithoutSlash}/`
  ? ConvertPathParamToRecord<PathParamWithoutSlash>
  : PathParam extends `${infer PathParamWithoutSlash}\\:`
    ? ConvertPathParamToRecord<PathParamWithoutSlash>
    : PathParam extends `${infer PathParamWithoutModifier}${OptionalPathParamModifier}`
      ? { [Name in PathParamWithoutModifier]?: string }
      : PathParam extends `${infer PathParamWithoutModifier}${RepeatingPathParamModifier}`
        ? { [Name in PathParamWithoutModifier]: string }
        : { [Name in PathParam]: string };

type RecursiveInferPathParams<Path extends string> = Path extends `${infer Prefix}:${infer PathParamWithRemainingPath}`
  ? PathParamWithRemainingPath extends `${infer PathParam}/${infer RemainingPath}`
    ? Prefix extends `${string}\\`
      ? RecursiveInferPathParams<RemainingPath>
      : ConvertPathParamToRecord<PathParam> & RecursiveInferPathParams<RemainingPath>
    : PathParamWithRemainingPath extends `${infer PathParam}\\:${infer RemainingPath}`
      ? Prefix extends `${string}\\`
        ? RecursiveInferPathParams<`\\:${RemainingPath}`>
        : ConvertPathParamToRecord<PathParam> & RecursiveInferPathParams<`\\:${RemainingPath}`>
      : PathParamWithRemainingPath extends `${infer PathParam}:${infer RemainingPath}`
        ? Prefix extends `${string}\\`
          ? RecursiveInferPathParams<RemainingPath>
          : ConvertPathParamToRecord<PathParam> & RecursiveInferPathParams<`:${RemainingPath}`>
        : Prefix extends `${string}\\`
          ? {}
          : ConvertPathParamToRecord<PathParamWithRemainingPath>
  : {};

/** @see {@link https://zimic.dev/docs/http/api/http-schema#inferpathparams `InferPathParams` API reference} */
export type InferPathParams<
  PathOrSchema extends string | HttpSchema,
  OptionalPath extends PathOrSchema extends HttpSchema ? HttpSchemaPath.Literal<PathOrSchema> : never = never,
> = Prettify<
  RecursiveInferPathParams<
    PathOrSchema extends HttpSchema ? OptionalPath : PathOrSchema extends string ? PathOrSchema : never
  >
>;

type WithoutEscapedColons<Path extends string> = Path extends `${infer Prefix}\\:${infer Suffix}`
  ? WithoutEscapedColons<`${Prefix}:${Suffix}`>
  : Path;

type ConvertPathParamToString<PathParam extends string> = PathParam extends `${infer PathParamWithoutSlash}/`
  ? `${ConvertPathParamToString<PathParamWithoutSlash>}/`
  : PathParam extends `${infer PathParamWithoutSlash}\\:`
    ? `${ConvertPathParamToString<PathParamWithoutSlash>}:`
    : string;

export type AllowAnyStringInPathParams<Path extends string> =
  Path extends `${infer Prefix}:${infer PathParamWithRemainingPath}`
    ? PathParamWithRemainingPath extends `${infer PathParam}/${infer RemainingPath}`
      ? Prefix extends `${infer PrefixPrefix}\\`
        ? `${PrefixPrefix}:${AllowAnyStringInPathParams<PathParamWithRemainingPath>}`
        : `${Prefix}${ConvertPathParamToString<PathParam>}/${AllowAnyStringInPathParams<RemainingPath>}`
      : PathParamWithRemainingPath extends `${infer PathParam}\\:${infer RemainingPath}`
        ? Prefix extends `${infer PrefixPrefix}\\`
          ? `${PrefixPrefix}:${AllowAnyStringInPathParams<PathParamWithRemainingPath>}`
          : `${Prefix}${ConvertPathParamToString<PathParam>}:${AllowAnyStringInPathParams<RemainingPath>}`
        : PathParamWithRemainingPath extends `${infer PathParam}:${infer RemainingPath}`
          ? Prefix extends `${infer PrefixPrefix}\\`
            ? `${PrefixPrefix}:${AllowAnyStringInPathParams<PathParamWithRemainingPath>}`
            : `${Prefix}${ConvertPathParamToString<PathParam>}${AllowAnyStringInPathParams<`:${RemainingPath}`>}`
          : Prefix extends `${infer PrefixPrefix}\\`
            ? `${PrefixPrefix}:${PathParamWithRemainingPath}`
            : `${Prefix}${ConvertPathParamToString<PathParamWithRemainingPath>}`
    : Path;

/** @see {@link https://zimic.dev/docs/http/api/http-schema#httpschemapath `HttpSchemaPath` API reference} */
export namespace HttpSchemaPath {
  type LooseLiteral<Schema extends HttpSchema, Method extends HttpMethod = HttpMethod> = {
    [Path in keyof Schema & string]: Method extends keyof Schema[Path] ? Path : never;
  }[keyof Schema & string];

  /** @see {@link https://zimic.dev/docs/http/api/http-schema#httpschemapathliteral `HttpSchemaPath.Literal` API reference} */
  export type Literal<
    Schema extends HttpSchema,
    Method extends HttpSchemaMethod<Schema> = HttpSchemaMethod<Schema>,
  > = WithoutEscapedColons<LooseLiteral<Schema, Method>>;

  /** @see {@link https://zimic.dev/docs/http/api/http-schema#httpschemapathnonliteral `HttpSchemaPath.NonLiteral` API reference} */
  export type NonLiteral<
    Schema extends HttpSchema,
    Method extends HttpSchemaMethod<Schema> = HttpSchemaMethod<Schema>,
  > = AllowAnyStringInPathParams<LooseLiteral<Schema, Method>>;
}

export type HttpSchemaPath<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema> = HttpSchemaMethod<Schema>,
> = HttpSchemaPath.Literal<Schema, Method> | HttpSchemaPath.NonLiteral<Schema, Method>;

type LargestPathPrefix<Path extends string> = Path extends `${infer Prefix}/${infer Suffix}`
  ? `${Prefix}/${Suffix extends `${string}/${string}` ? LargestPathPrefix<Suffix> : ''}`
  : Path;

type ExcludeNonLiteralPathsSupersededByLiteralPath<Path extends string> =
  Path extends `${LargestPathPrefix<Path>}:${string}` ? never : Path;

export type PreferMostStaticLiteralPath<Path extends string> =
  UnionHasMoreThanOneType<Path> extends true ? ExcludeNonLiteralPathsSupersededByLiteralPath<Path> : Path;

type RecursiveInferHttpSchemaPath<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  NonLiteralPath extends string,
  LiteralPath extends HttpSchemaPath.Literal<Schema, Method>,
> =
  NonLiteralPath extends AllowAnyStringInPathParams<LiteralPath>
    ? NonLiteralPath extends `${AllowAnyStringInPathParams<LiteralPath>}/${string}`
      ? never
      : LiteralPath
    : never;

export type LiteralHttpSchemaPathFromNonLiteral<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  NonLiteralPath extends string,
  LiteralPath extends HttpSchemaPath.Literal<Schema, Method> = HttpSchemaPath.Literal<Schema, Method>,
> = PreferMostStaticLiteralPath<
  LiteralPath extends LiteralPath ? RecursiveInferHttpSchemaPath<Schema, Method, NonLiteralPath, LiteralPath> : never
>;

type OmitPastHttpStatusCodes<
  Schema extends HttpResponseSchemaByStatusCode,
  PastSchemas extends HttpResponseSchemaByStatusCode[],
> =
  PastSchemas extends NonEmptyArray<HttpResponseSchemaByStatusCode>
    ? Omit<Schema, keyof UnionToIntersection<PastSchemas[number]>>
    : Schema;

/** @see {@link https://zimic.dev/docs/http/api/http-schema#mergehttpresponsesbystatuscode `MergeHttpResponsesByStatusCode` API reference} */
export type MergeHttpResponsesByStatusCode<
  Schemas extends HttpResponseSchemaByStatusCode[],
  PastSchemas extends HttpResponseSchemaByStatusCode[] = [],
> = Schemas extends [
  infer FirstSchema extends HttpResponseSchemaByStatusCode,
  ...infer RestSchemas extends HttpResponseSchemaByStatusCode[],
]
  ? RestSchemas extends NonEmptyArray<HttpResponseSchemaByStatusCode>
    ? OmitPastHttpStatusCodes<FirstSchema, PastSchemas> &
        MergeHttpResponsesByStatusCode<RestSchemas, [...PastSchemas, FirstSchema]>
    : OmitPastHttpStatusCodes<FirstSchema, PastSchemas>
  : never;
