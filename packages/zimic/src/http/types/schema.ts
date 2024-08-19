import { IfAny, UnionToIntersection, UnionHasMoreThanOneType, Prettify, NonEmptyArray } from '@/types/utils';

import { HttpFormDataSchema } from '../formData/types';
import { HttpHeadersSchema } from '../headers/types';
import { HttpSearchParamsSchema } from '../searchParams/types';
import { HttpBody } from './requests';

export const HTTP_METHODS_WITH_REQUEST_BODY = Object.freeze(['POST', 'PUT', 'PATCH', 'DELETE'] as const);
export type HttpMethodWithRequestBody = (typeof HTTP_METHODS_WITH_REQUEST_BODY)[number];

export const HTTP_METHODS_WITH_RESPONSE_BODY = Object.freeze([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
] as const);
export type HttpMethodWithResponseBody = (typeof HTTP_METHODS_WITH_RESPONSE_BODY)[number];

export const HTTP_METHODS = Object.freeze(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const);
/**
 * A type representing the currently supported
 * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods `HTTP methods`}.
 */
export type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * A schema representing the structure of an HTTP request.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/API-reference:-%60zimic-http%60-schemas Declaring HTTP service schemas}
 */
export interface HttpServiceRequestSchema {
  headers?: HttpHeadersSchema;
  searchParams?: HttpSearchParamsSchema;
  body?: HttpBody;
}

/**
 * A schema representing the structure of an HTTP response.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/API-reference:-%60zimic-http%60-schemas#declaring-http-interceptor-schemas Declaring HTTP Service Schemas}
 */
export interface HttpServiceResponseSchema {
  headers?: HttpHeadersSchema;
  body?: HttpBody;
}

export namespace HttpServiceResponseSchema {
  export interface NoBody extends Omit<HttpServiceResponseSchema, 'body'> {
    body?: null;
  }
}

/**
 * The status codes used in HTTP responses, as defined by
 * {@link https://httpwg.org/specs/rfc9110.html#overview.of.status.codes RFC-9110}.
 *
 * - `HttpStatusCode.Information`:
 *   {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#information_responses `1XX`}
 * - `HttpStatusCode.Success`: {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#successful_responses `2XX`}
 * - `HttpStatusCode.Redirection`:
 *   {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#redirection_messages `3XX`}
 * - `HttpStatusCode.ClientError`:
 *   {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses `4XX`}
 * - `HttpStatusCode.ServerError`:
 *   {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#server_error_responses `5XX`}
 */
export namespace HttpStatusCode {
  export type Information =
    | 100 // Continue
    | 101 // Switching Protocols
    | 102 // Processing
    | 103; // Early Hints

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

  export type Redirection =
    | 300 // Multiple Choices
    | 301 // Moved Permanently
    | 302 // Found
    | 303 // See Other
    | 304 // Not Modified
    | 307 // Temporary Redirect
    | 308; // Permanent Redirect

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

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type HttpStatusCode =
  | HttpStatusCode.Information
  | HttpStatusCode.Success
  | HttpStatusCode.Redirection
  | HttpStatusCode.ClientError
  | HttpStatusCode.ServerError;

export namespace HttpServiceResponseSchemaByStatusCode {
  export type Loose = {
    [StatusCode in HttpStatusCode]?: HttpServiceResponseSchema;
  };

  export type ConvertToStrict<Schema extends Loose> = {
    [StatusCode in keyof Schema]: StatusCode extends 204 ? HttpServiceResponseSchema.NoBody : Schema[StatusCode];
  };

  export type Strict = ConvertToStrict<Loose>;

  export type NoBody = {
    [StatusCode in HttpStatusCode]?: HttpServiceResponseSchema.NoBody;
  };
}

/**
 * A schema representing the structure of HTTP responses by status code.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/API-reference:-%60zimic-http%60-schemas#declaring-http-interceptor-schemas Declaring HTTP Service Schemas}
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type HttpServiceResponseSchemaByStatusCode = HttpServiceResponseSchemaByStatusCode.Strict;

/**
 * Extracts the status codes used in a response schema by status code.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/API-reference:-%60zimic-http%60-schemas#declaring-http-interceptor-schemas Declaring HTTP Service Schemas}
 */
export type HttpServiceResponseSchemaStatusCode<
  ResponseSchemaByStatusCode extends HttpServiceResponseSchemaByStatusCode,
> = Extract<keyof ResponseSchemaByStatusCode, HttpStatusCode>;

/**
 * A schema representing the structure of an HTTP request and response for a given method.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/API-reference:-%60zimic-http%60-schemas#declaring-http-interceptor-schemas Declaring HTTP Service Schemas}
 */
export interface HttpServiceMethodSchema {
  request?: HttpServiceRequestSchema;
  response?: HttpServiceResponseSchemaByStatusCode;
}

export namespace HttpServiceMethodSchema {
  export interface NoRequestBody extends Omit<HttpServiceMethodSchema, 'request'> {
    request?: Omit<HttpServiceRequestSchema, 'body'> & { body?: null };
  }

  export interface NoBody extends Omit<NoRequestBody, 'response'> {
    response?: HttpServiceResponseSchemaByStatusCode.NoBody;
  }
}

/**
 * A schema representing the structure of HTTP request and response by method.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/API-reference:-%60zimic-http%60-schemas#declaring-http-interceptor-schemas Declaring HTTP Service Schemas}
 */
export interface HttpServiceMethodsSchema {
  GET?: HttpServiceMethodSchema.NoRequestBody;
  POST?: HttpServiceMethodSchema;
  PUT?: HttpServiceMethodSchema;
  PATCH?: HttpServiceMethodSchema;
  DELETE?: HttpServiceMethodSchema;
  HEAD?: HttpServiceMethodSchema.NoBody;
  OPTIONS?: HttpServiceMethodSchema.NoRequestBody;
}

/**
 * A schema representing the structure of paths, methods, requests, and responses for an HTTP service.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/API-reference:-%60zimic-http%60-schemas#declaring-http-interceptor-schemas Declaring HTTP Service Schemas}
 */
export interface HttpServiceSchema {
  [path: string]: HttpServiceMethodsSchema;
}

/**
 * A namespace containing utility types for validating HTTP type schemas.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/API-reference:-%60zimic-http%60-schemas#declaring-http-interceptor-schemas Declaring HTTP Service Schemas}
 */
export namespace HttpSchema {
  /** Validates that a type is a valid HTTP service schema. */
  export type Paths<Schema extends HttpServiceSchema> = Schema;
  /** Validates that a type is a valid HTTP service methods schema. */
  export type Methods<Schema extends HttpServiceMethodsSchema> = Schema;
  /** Validates that a type is a valid HTTP service method schema. */
  export type Method<Schema extends HttpServiceMethodSchema> = Schema;
  /** Validates that a type is a valid HTTP service request schema. */
  export type Request<Schema extends HttpServiceRequestSchema> = Schema;
  /** Validates that a type is a valid HTTP service response schema by status code. */
  export type ResponseByStatusCode<Schema extends HttpServiceResponseSchemaByStatusCode> = Schema;
  /** Validates that a type is a valid HTTP service response schema. */
  export type Response<Schema extends HttpServiceResponseSchema> = Schema;
  /** Validates that a type is a valid HTTP body schema. */
  export type Body<Schema extends HttpBody> = Schema;
  /** Validates that a type is a valid HTTP headers schema. */
  export type Headers<Schema extends HttpHeadersSchema> = Schema;
  /** Validates that a type is a valid HTTP search params schema. */
  export type SearchParams<Schema extends HttpSearchParamsSchema> = Schema;
  /** Validates that a type is a valid HTTP form data schema. */
  export type FormData<Schema extends HttpFormDataSchema> = Schema;
}

/**
 * Extracts the methods from an HTTP service schema.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/API-reference:-%60zimic-http%60-schemas#declaring-http-interceptor-schemas Declaring HTTP Service Schemas}
 */
export type HttpServiceSchemaMethod<Schema extends HttpServiceSchema> = IfAny<
  Schema,
  any, // eslint-disable-line @typescript-eslint/no-explicit-any
  Extract<keyof UnionToIntersection<Schema[keyof Schema]>, HttpMethod>
>;

/**
 * Extracts the literal paths from an HTTP service schema. Optionally receives a second argument with one or more
 * methods to filter the paths with. Only the methods defined in the schema are allowed.
 *
 * @example
 *   import { type HttpSchema, type LiteralHttpServiceSchemaPath } from 'zimic/http';
 *
 *   type Schema = HttpSchema.Paths<{
 *     '/users': {
 *       GET: {
 *         response: { 200: { body: User[] } };
 *       };
 *     };
 *     '/users/:userId': {
 *       DELETE: {
 *         response: { 200: { body: User } };
 *       };
 *     };
 *   }>;
 *
 *   type LiteralPath = LiteralHttpServiceSchemaPath<Schema>;
 *   // "/users" | "/users/:userId"
 *
 *   type LiteralGetPath = LiteralHttpServiceSchemaPath<Schema, 'GET'>;
 *   // "/users"
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/API-reference:-%60zimic-http%60-schemas#declaring-http-interceptor-schemas Declaring HTTP Service Schemas}
 */
export type LiteralHttpServiceSchemaPath<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema> = HttpServiceSchemaMethod<Schema>,
> = LooseLiteralHttpServiceSchemaPath<Schema, Method>;

export type LooseLiteralHttpServiceSchemaPath<
  Schema extends HttpServiceSchema,
  Method extends HttpMethod = HttpMethod,
> = {
  [Path in Extract<keyof Schema, string>]: Method extends keyof Schema[Path] ? Path : never;
}[Extract<keyof Schema, string>];

type AllowAnyStringInPathParams<Path extends string> = Path extends `${infer Prefix}:${string}/${infer Suffix}`
  ? `${Prefix}${string}/${AllowAnyStringInPathParams<Suffix>}`
  : Path extends `${infer Prefix}:${string}`
    ? `${Prefix}${string}`
    : Path;

/**
 * Extracts the non-literal paths from an HTTP service schema. Optionally receives a second argument with one or more
 * methods to filter the paths with. Only the methods defined in the schema are allowed.
 *
 * @example
 *   import { type HttpSchema, type NonLiteralHttpServiceSchemaPath } from 'zimic/http';
 *
 *   type Schema = HttpSchema.Paths<{
 *     '/users': {
 *       GET: {
 *         response: { 200: { body: User[] } };
 *       };
 *     };
 *     '/users/:userId': {
 *       DELETE: {
 *         response: { 200: { body: User } };
 *       };
 *     };
 *   }>;
 *
 *   type NonLiteralPath = NonLiteralHttpServiceSchemaPath<Schema>;
 *   // "/users" | "/users/${string}"
 *
 *   type NonLiteralGetPath = NonLiteralHttpServiceSchemaPath<Schema, 'GET'>;
 *   // "/users"
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/API-reference:-%60zimic-http%60-schemas#declaring-http-interceptor-schemas Declaring HTTP Service Schemas}
 */
export type NonLiteralHttpServiceSchemaPath<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema> = HttpServiceSchemaMethod<Schema>,
> = AllowAnyStringInPathParams<LiteralHttpServiceSchemaPath<Schema, Method>>;

type LargestPathPrefix<Path extends string> = Path extends `${infer Prefix}/${infer Suffix}`
  ? `${Prefix}/${Suffix extends `${string}/${string}` ? LargestPathPrefix<Suffix> : ''}`
  : Path;

type ExcludeNonLiteralPathsSupersededByLiteralPath<Path extends string> =
  Path extends `${LargestPathPrefix<Path>}:${string}` ? never : Path;

export type PreferMostStaticLiteralPath<Path extends string> =
  UnionHasMoreThanOneType<Path> extends true ? ExcludeNonLiteralPathsSupersededByLiteralPath<Path> : Path;

type RecursiveInferHttpServiceSchemaPath<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  NonLiteralPath extends string,
  LiteralPath extends LiteralHttpServiceSchemaPath<Schema, Method>,
> =
  NonLiteralPath extends AllowAnyStringInPathParams<LiteralPath>
    ? NonLiteralPath extends `${AllowAnyStringInPathParams<LiteralPath>}/${string}`
      ? never
      : LiteralPath
    : never;

export type LiteralHttpServiceSchemaPathFromNonLiteral<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  NonLiteralPath extends string,
  LiteralPath extends LiteralHttpServiceSchemaPath<Schema, Method> = LiteralHttpServiceSchemaPath<Schema, Method>,
> = PreferMostStaticLiteralPath<
  LiteralPath extends LiteralPath
    ? RecursiveInferHttpServiceSchemaPath<Schema, Method, NonLiteralPath, LiteralPath>
    : never
>;

/**
 * Extracts the paths from an HTTP service schema. Optionally receives a second argument with one or more methods to
 * filter the paths with. Only the methods defined in the schema are allowed.
 *
 * @example
 *   import { type HttpSchema, type HttpServiceSchemaPath } from 'zimic/http';
 *
 *   type Schema = HttpSchema.Paths<{
 *     '/users': {
 *       GET: {
 *         response: { 200: { body: User[] } };
 *       };
 *     };
 *     '/users/:userId': {
 *       DELETE: {
 *         response: { 200: { body: User } };
 *       };
 *     };
 *   }>;
 *
 *   type Path = NonLiteralHttpServiceSchemaPath<Schema>;
 *   // "/users" | "/users/:userId" | "/users/${string}"
 *
 *   type GetPath = NonLiteralHttpServiceSchemaPath<Schema, 'GET'>;
 *   // "/users"
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/API-reference:-%60zimic-http%60-schemas#declaring-http-interceptor-schemas Declaring HTTP Service Schemas}
 */
export type HttpServiceSchemaPath<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema> = HttpServiceSchemaMethod<Schema>,
> = LiteralHttpServiceSchemaPath<Schema, Method> | NonLiteralHttpServiceSchemaPath<Schema, Method>;

type RecursivePathParamsSchemaFromPath<Path extends string> =
  Path extends `${infer _Prefix}:${infer ParamName}/${infer Suffix}`
    ? { [Name in ParamName]: string } & RecursivePathParamsSchemaFromPath<Suffix>
    : Path extends `${infer _Prefix}:${infer ParamName}`
      ? { [Name in ParamName]: string }
      : {};

/**
 * Infers the path parameters schema from a path string.
 *
 * @example
 *   import { PathParamsSchemaFromPath } from 'zimic/http';
 *
 *   type PathParams = PathParamsSchemaFromPath<'/users/:userId/notifications'>;
 *   // { userId: string }
 */
export type PathParamsSchemaFromPath<Path extends string> = Prettify<RecursivePathParamsSchemaFromPath<Path>>;

type OmitPastHttpStatusCodes<
  Schema extends HttpServiceResponseSchemaByStatusCode.Loose,
  PastSchemas extends HttpServiceResponseSchemaByStatusCode.Loose[],
> =
  PastSchemas extends NonEmptyArray<HttpServiceResponseSchemaByStatusCode.Loose>
    ? Omit<Schema, keyof UnionToIntersection<PastSchemas[number]>>
    : Schema;

type RecursiveMergeHttpResponsesByStatusCode<
  Schemas extends HttpServiceResponseSchemaByStatusCode.Loose[],
  PastSchemas extends HttpServiceResponseSchemaByStatusCode.Loose[] = [],
> = Schemas extends [
  infer FirstSchema extends HttpServiceResponseSchemaByStatusCode.Loose,
  ...infer RestSchemas extends HttpServiceResponseSchemaByStatusCode.Loose[],
]
  ? RestSchemas extends NonEmptyArray<HttpServiceResponseSchemaByStatusCode.Loose>
    ? OmitPastHttpStatusCodes<FirstSchema, PastSchemas> &
        RecursiveMergeHttpResponsesByStatusCode<RestSchemas, [...PastSchemas, FirstSchema]>
    : OmitPastHttpStatusCodes<FirstSchema, PastSchemas>
  : never;

/**
 * Merges multiple HTTP response schemas by status code into a single schema. When there are duplicate status codes, the
 * first declaration takes precedence.
 *
 * @example
 *   import { type HttpSchema, type HttpStatusCode, MergeHttpResponsesByStatusCode } from 'zimic/http';
 *
 *   // Overriding the 400 status code with a more specific schema
 *   // and using a generic schema for all other client errors.
 *   type MergedResponses = MergeHttpResponsesByStatusCode<
 *     [
 *       {
 *         400: { body: { message: string; issues: string[] } };
 *       },
 *       {
 *         [StatusCode in HttpStatusCode.ClientError]: { body: { message: string } };
 *       },
 *     ]
 *   >;
 *   // {
 *   //   400: { body: { message: string; issues: string[] } };
 *   //   401: { body: { message: string}; };
 *   //   402: { body: { message: string}; };
 *   //   403: { body: { message: string}; };
 *   //   ...
 *   // }
 *
 *   type Schema = HttpSchema.Paths<{
 *     '/users': {
 *       GET: { response: MergedResponses };
 *     };
 *   }>;
 */
export type MergeHttpResponsesByStatusCode<
  Schemas extends HttpServiceResponseSchemaByStatusCode.Loose[],
  PastSchemas extends HttpServiceResponseSchemaByStatusCode.Loose[] = [],
> = HttpServiceResponseSchemaByStatusCode.ConvertToStrict<
  RecursiveMergeHttpResponsesByStatusCode<Schemas, PastSchemas>
>;
