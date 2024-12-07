import { IfAny, UnionToIntersection, UnionHasMoreThanOneType, Prettify, NonEmptyArray } from '@/types/utils';

import { HttpFormDataSchema, HttpFormDataSerialized } from '../formData/types';
import { HttpHeadersSchema, HttpHeadersSerialized } from '../headers/types';
import { HttpPathParamsSchema, HttpPathParamsSerialized } from '../pathParams/types';
import { HttpSearchParamsSchema, HttpSearchParamsSerialized } from '../searchParams/types';
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
 * {@link https://developer.mozilla.org/docs/Web/HTTP/Methods `HTTP methods`}.
 */
export type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * A schema representing the structure of an HTTP request.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas Declaring HTTP interceptor schemas}
 */
export interface HttpRequestSchema {
  headers?: HttpHeadersSchema.Loose;
  searchParams?: HttpSearchParamsSchema.Loose;
  body?: HttpBody.Loose;
}

type ConvertToStrictHttpRequestSchema<Schema> = {
  [Key in keyof Schema]: Key extends 'headers'
    ? HttpHeadersSerialized<Schema[Key]>
    : Key extends 'searchParams'
      ? HttpSearchParamsSerialized<Schema[Key]>
      : Key extends 'body'
        ? HttpBody.ConvertToStrict<Schema[Key]>
        : Schema[Key];
};

/**
 * A schema representing the structure of an HTTP response.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas Declaring HTTP interceptor schemas}
 */
export interface HttpResponseSchema {
  headers?: HttpHeadersSchema.Loose;
  body?: HttpBody.Loose;
}

export namespace HttpResponseSchema {
  /** A schema representing the structure of an HTTP response with no body. */
  export interface NoBody extends Omit<HttpResponseSchema, 'body'> {
    body?: null;
  }
}

type ConvertToStrictHttpResponseSchema<Schema> = ConvertToStrictHttpRequestSchema<Schema>;

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

export type HttpStatusCode =
  | HttpStatusCode.Information
  | HttpStatusCode.Success
  | HttpStatusCode.Redirection
  | HttpStatusCode.ClientError
  | HttpStatusCode.ServerError;

export namespace HttpResponseSchemaByStatusCode {
  /** A loose version of HTTP responses by status code. JSON values are not strictly typed. */
  export type Loose = {
    [StatusCode in HttpStatusCode]?: HttpResponseSchema;
  };

  /**
   * Converts a possibly loose HTTP response schema by status code to be strictly typed. JSON values are serialized to
   * their strict form.
   */
  export type ConvertToStrict<Schema extends Loose> = {
    [StatusCode in keyof Schema]: StatusCode extends 204 ? HttpResponseSchema.NoBody : Schema[StatusCode];
  };

  /** A schema representing the structure of HTTP responses by status code with no body. */
  export type NoBody = {
    [StatusCode in HttpStatusCode]?: HttpResponseSchema.NoBody;
  };
}

/**
 * A schema representing the structure of HTTP responses by status code.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas Declaring HTTP interceptor schemas}
 */
export type HttpResponseSchemaByStatusCode =
  HttpResponseSchemaByStatusCode.ConvertToStrict<HttpResponseSchemaByStatusCode.Loose>;

type ConvertToStrictHttpResponseSchemaByStatusCode<Schema> = {
  [Key in keyof Schema]: ConvertToStrictHttpResponseSchema<Schema[Key]>;
};

/**
 * Extracts the status codes used in a response schema by status code.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas Declaring HTTP interceptor schemas}
 */
export type HttpResponseSchemaStatusCode<ResponseSchemaByStatusCode extends HttpResponseSchemaByStatusCode> = Extract<
  keyof ResponseSchemaByStatusCode,
  HttpStatusCode
>;

/**
 * A schema representing the structure of an HTTP request and response for a given method.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas Declaring HTTP interceptor schemas}
 */
export interface HttpMethodSchema {
  request?: HttpRequestSchema;
  response?: HttpResponseSchemaByStatusCode;
}

export namespace HttpMethodSchema {
  /** A schema representing the structure of an HTTP request and response for a given method, having no request body. */
  export interface NoRequestBody extends Omit<HttpMethodSchema, 'request'> {
    request?: Omit<HttpRequestSchema, 'body'> & { body?: null };
  }

  /**
   * A schema representing the structure of an HTTP request and response for a given method, having no request and
   * response bodies.
   */
  export interface NoBody extends Omit<NoRequestBody, 'response'> {
    response?: HttpResponseSchemaByStatusCode.NoBody;
  }
}

type ConvertToStrictMethod<Schema> = {
  [Key in keyof Schema]: Key extends 'request'
    ? ConvertToStrictHttpRequestSchema<Schema[Key]>
    : Key extends 'response'
      ? ConvertToStrictHttpResponseSchemaByStatusCode<Schema[Key]>
      : Schema[Key];
};

/**
 * A schema representing the structure of HTTP request and response by method.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas Declaring HTTP interceptor schemas}
 */
export interface HttpMethodsSchema {
  GET?: HttpMethodSchema.NoRequestBody;
  POST?: HttpMethodSchema;
  PUT?: HttpMethodSchema;
  PATCH?: HttpMethodSchema;
  DELETE?: HttpMethodSchema;
  HEAD?: HttpMethodSchema.NoBody;
  OPTIONS?: HttpMethodSchema.NoRequestBody;
}

type ConvertToStrictHttpMethodsSchema<Schema> = {
  [Method in keyof Schema]: ConvertToStrictMethod<Schema[Method]>;
};

interface BaseHttpSchema {
  [path: string]: HttpMethodsSchema;
}

export type ConvertToStrictHttpSchema<Schema extends HttpSchema> = {
  [Path in keyof Schema]: ConvertToStrictHttpMethodsSchema<Schema[Path]>;
};

/**
 * Declares an HTTP service schema.
 *
 * **IMPORTANT**: the input of `HttpSchema` and all of its internal types, except bodies, must be declared inline or as
 * a type aliases (`type`). Types other than bodies cannot be interfaces.
 *
 * @example
 *   import { type HttpSchema } from 'zimic/http';
 *
 *   interface UserListHeaders {
 *     accept: string;
 *   }
 *
 *   interface UserListSearchParams {
 *     name?: string;
 *     limit?: `${number}`;
 *   }
 *
 *   type Schema = HttpSchema<{
 *     '/users': {
 *       GET: {
 *         request: {
 *           headers: UserListHeaders;
 *           searchParams: UserListSearchParams;
 *         };
 *         response: {
 *           200: {
 *             // Inline headers declaration
 *             headers: { 'content-type': string };
 *             body: User[];
 *           };
 *         };
 *       };
 *     };
 *   }>;
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas Declaring HTTP interceptor schemas}
 */
export type HttpSchema<Schema extends BaseHttpSchema = BaseHttpSchema> = ConvertToStrictHttpSchema<Schema>;

export namespace HttpSchema {
  /**
   * Declares an HTTP service methods schema.
   *
   * **IMPORTANT**: the input of `HttpSchema.Methods` and all of its internal types, except bodies, must be declared
   * inline or as a type aliases (`type`). Types other than bodies cannot be interfaces.
   *
   * @example
   *   import { type HttpSchema } from 'zimic/http';
   *
   *   type UserMethods = HttpSchema.Methods<{
   *     GET: {
   *       response: {
   *         200: { body: User[] };
   *       };
   *     };
   *   }>;
   *
   *   type Schema = HttpSchema<{
   *     '/users': UserMethods;
   *   }>;
   */
  export type Methods<Schema extends HttpMethodsSchema> = ConvertToStrictHttpMethodsSchema<Schema>;

  /**
   * Declares an HTTP service method schema.
   *
   * **IMPORTANT**: the input of `HttpSchema.Method` and all of its internal types, except bodies, must be declared
   * inline or as a type aliases (`type`). Types other than bodies cannot be interfaces.
   *
   * @example
   *   import { type HttpSchema } from 'zimic/http';
   *
   *   type UserListMethod = HttpSchema.Method<{
   *     response: {
   *       200: { body: User[] };
   *     };
   *   }>;
   *
   *   type Schema = HttpSchema<{
   *     '/users': {
   *       GET: UserListMethod;
   *     };
   *   }>;
   */
  export type Method<Schema extends HttpMethodSchema> = ConvertToStrictMethod<Schema>;

  /**
   * Declares an HTTP service request schema.
   *
   * **IMPORTANT**: the input of `HttpSchema.Request` and all of its internal types, except bodies, must be declared
   * inline or as a type aliases (`type`). Types other than bodies cannot be interfaces.
   *
   * @example
   *   import { type HttpSchema } from 'zimic/http';
   *
   *   type UserCreationRequest = HttpSchema.Request<{
   *     headers: { 'content-type': 'application/json' };
   *     body: User;
   *   }>;
   *
   *   type Schema = HttpSchema<{
   *     '/users': {
   *       POST: {
   *         request: UserCreationRequest;
   *         response: {
   *           201: { body: User };
   *         };
   *       };
   *     };
   *   }>;
   */
  export type Request<Schema extends HttpRequestSchema> = ConvertToStrictHttpRequestSchema<Schema>;

  /**
   * Declares an HTTP service response schema by status code.
   *
   * **IMPORTANT**: the input of `HttpSchema.ResponseByStatusCode` and all of its internal types, except bodies, must be
   * declared inline or as a type aliases (`type`). Types other than bodies cannot be interfaces.
   *
   * @example
   *   import { type HttpSchema } from 'zimic/http';
   *
   *   type UserListResponseByStatusCode = HttpSchema.ResponseByStatusCode<{
   *     200: { body: User[] };
   *     400: { body: { message: string } };
   *   }>;
   *
   *   type Schema = HttpSchema<{
   *     '/users': {
   *       GET: {
   *         response: UserListResponseByStatusCode;
   *       };
   *     };
   *   }>;
   */
  export type ResponseByStatusCode<Schema extends HttpResponseSchemaByStatusCode> =
    ConvertToStrictHttpResponseSchemaByStatusCode<Schema>;

  /**
   * Declares an HTTP service response schema.
   *
   * **IMPORTANT**: the input of `HttpSchema.Response` and all of its internal types, except bodies, must be declared
   * inline or as a type aliases (`type`). Types other than bodies cannot be interfaces.
   *
   * @example
   *   import { type HttpSchema } from 'zimic/http';
   *
   *   type UserListSuccessResponse = HttpSchema.Response<{
   *     body: User[];
   *   }>;
   *
   *   type Schema = HttpSchema<{
   *     '/users': {
   *       GET: {
   *         response: {
   *           200: UserListSuccessResponse;
   *         };
   *       };
   *     };
   *   }>;
   */
  export type Response<Schema extends HttpResponseSchema> = ConvertToStrictHttpResponseSchema<Schema>;

  /**
   * Declares an HTTP body schema. JSON values are serialized to their strict form using
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic#jsonserialized `JSONSerialized`} if necessary.
   *
   * @example
   *   import { type HttpSchema } from 'zimic/http';
   *
   *   type UserListSuccessResponseBody = HttpSchema.Body<User[]>;
   *
   *   type Schema = HttpSchema<{
   *     '/users': {
   *       GET: {
   *         response: {
   *           200: { body: UserListSuccessResponseBody };
   *         };
   *       };
   *     };
   *   }>;
   */
  export type Body<Schema extends HttpBody.Loose> = HttpBody.ConvertToStrict<Schema>;

  /**
   * Declares an HTTP headers schema. Headers are serialized to their strict form using
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#httpheadersserialized `HttpHeadersSerialized`} if
   * necessary.
   *
   * @example
   *   import { type HttpSchema } from 'zimic/http';
   *
   *   type UserListHeaders = HttpSchema.Headers<{
   *     accept: 'application/json';
   *   }>;
   *
   *   type Schema = HttpSchema<{
   *     '/users': {
   *       GET: {
   *         request: {
   *           headers: UserListHeaders;
   *         };
   *         response: {
   *           200: { body: User[] };
   *         };
   *       };
   *     };
   *   }>;
   */
  export type Headers<Schema extends HttpHeadersSchema.Loose> = HttpHeadersSerialized<Schema>;

  /**
   * Declares an HTTP search params schema. Search params are serialized to their strict form using
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#httpsearchparamsserialized `HttpSearchParamsSerialized`}
   * if necessary.
   *
   * @example
   *   import { type HttpSchema } from 'zimic/http';
   *
   *   type UserListSearchParams = HttpSchema.SearchParams<{
   *     limit: `${number}`;
   *     offset: `${number}`;
   *   }>;
   *
   *   type Schema = HttpSchema<{
   *     '/users': {
   *       GET: {
   *         request: {
   *           searchParams: UserListSearchParams;
   *         };
   *         response: {
   *           200: { body: User[] };
   *         };
   *       };
   *     };
   *   }>;
   */
  export type SearchParams<Schema extends HttpSearchParamsSchema.Loose> = HttpSearchParamsSerialized<Schema>;

  /**
   * Declares an HTTP path params schema. Path params are serialized to their strict form using
   * {@link HttpPathParamsSerialized} if necessary.
   *
   * @example
   *   import { type HttpSchema, InferPathParams } from 'zimic/http';
   *
   *   type Schema = HttpSchema<{
   *     '/users/:userId': {
   *       GET: {
   *         response: {
   *           200: { body: User };
   *         };
   *       };
   *     };
   *   }>;
   *
   *   type UserByIdPathParams = HttpSchema.PathParams<{
   *     userId: string;
   *   }>;
   *
   *   // Or infer from the path string
   *   type UserByIdPathParams = InferPathParams<Schema, '/users/:userId'>;
   */
  export type PathParams<Schema extends HttpPathParamsSchema.Loose> = HttpPathParamsSerialized<Schema>;

  /**
   * Declares an HTTP form data schema. Form data is serialized to their strict form using
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#httpformdataserialized `HttpFormDataSerialized`} if
   * necessary.
   *
   * @example
   *   import { HttpFormData, type HttpSchema } from 'zimic/http';
   *
   *   type UserCreationFormData = HttpFormData<
   *     HttpSchema.FormData<{
   *       name: string;
   *       email: string;
   *     }>
   *   >;
   *
   *   type Schema = HttpSchema<{
   *     '/users': {
   *       POST: {
   *         request: {
   *           body: UserCreationFormData;
   *         };
   *         response: {
   *           201: { body: User };
   *         };
   *       };
   *     };
   *   }>;
   */
  export type FormData<Schema extends HttpFormDataSchema.Loose> = HttpFormDataSerialized<Schema>;
}

/**
 * Extracts the methods from an HTTP service schema.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas Declaring HTTP interceptor schemas}
 */
export type HttpSchemaMethod<Schema extends HttpSchema> = IfAny<
  Schema,
  any, // eslint-disable-line @typescript-eslint/no-explicit-any
  Extract<keyof UnionToIntersection<Schema[keyof Schema]>, HttpMethod>
>;

type AllowAnyStringInPathParams<Path extends string> = Path extends `${infer Prefix}:${string}/${infer Suffix}`
  ? `${Prefix}${string}/${AllowAnyStringInPathParams<Suffix>}`
  : Path extends `${infer Prefix}:${string}`
    ? `${Prefix}${string}`
    : Path;

/**
 * Extracts the paths from an HTTP service schema. Optionally receives a second argument with one or more methods to
 * filter the paths with. Only the methods defined in the schema are allowed.
 *
 * @example
 *   import { type HttpSchema, type HttpSchemaPath } from 'zimic/http';
 *
 *   type Schema = HttpSchema<{
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
 *   type Path = HttpSchemaPath<Schema>;
 *   // "/users" | "/users/:userId" | "/users/${string}"
 *
 *   type GetPath = HttpSchemaPath<Schema, 'GET'>;
 *   // "/users"
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas Declaring HTTP interceptor schemas}
 */
export namespace HttpSchemaPath {
  type LooseLiteral<Schema extends HttpSchema, Method extends HttpMethod = HttpMethod> = {
    [Path in Extract<keyof Schema, string>]: Method extends keyof Schema[Path] ? Path : never;
  }[Extract<keyof Schema, string>];

  /**
   * Extracts the literal paths from an HTTP service schema. Optionally receives a second argument with one or more
   * methods to filter the paths with. Only the methods defined in the schema are allowed.
   *
   * @example
   *   import { type HttpSchema, type HttpSchemaPath } from 'zimic/http';
   *
   *   type Schema = HttpSchema<{
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
   *   type LiteralPath = HttpSchemaPath.Literal<Schema>;
   *   // "/users" | "/users/:userId"
   *
   *   type LiteralGetPath = HttpSchemaPath.Literal<Schema, 'GET'>;
   *   // "/users"
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas Declaring HTTP interceptor schemas}
   */
  export type Literal<
    Schema extends HttpSchema,
    Method extends HttpSchemaMethod<Schema> = HttpSchemaMethod<Schema>,
  > = LooseLiteral<Schema, Method>;

  /**
   * Extracts the non-literal paths from an HTTP service schema. Optionally receives a second argument with one or more
   * methods to filter the paths with. Only the methods defined in the schema are allowed.
   *
   * @example
   *   import { type HttpSchema, type HttpSchemaPath } from 'zimic/http';
   *
   *   type Schema = HttpSchema<{
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
   *   type NonLiteralPath = HttpSchemaPath.NonLiteral<Schema>;
   *   // "/users" | "/users/${string}"
   *
   *   type NonLiteralGetPath = HttpSchemaPath.NonLiteral<Schema, 'GET'>;
   *   // "/users"
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas Declaring HTTP interceptor schemas}
   */
  export type NonLiteral<
    Schema extends HttpSchema,
    Method extends HttpSchemaMethod<Schema> = HttpSchemaMethod<Schema>,
  > = AllowAnyStringInPathParams<Literal<Schema, Method>>;
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

type RecursiveInferPathParams<Path extends string> = Path extends `${infer _Prefix}:${infer ParamName}/${infer Suffix}`
  ? { [Name in ParamName]: string } & RecursiveInferPathParams<Suffix>
  : Path extends `${infer _Prefix}:${infer ParamName}`
    ? { [Name in ParamName]: string }
    : {};

/**
 * Infers the path parameters schema from a path string, optionally validating it against an {@link HttpSchema}.
 *
 * If the first argument is a {@link HttpSchema} (recommended), the second argument is checked to be a valid path in that
 * schema.
 *
 * @example
 *   import { HttpSchema, InferPathParams } from 'zimic/http';
 *
 *   type MySchema = HttpSchema<{
 *     '/users/:userId': {
 *       GET: {
 *         response: { 200: { body: User } };
 *       };
 *     };
 *   }>;
 *
 *   // Using a schema to validate the path (recommended):
 *   type PathParams = InferPathParams<MySchema, '/users/:userId'>;
 *   // { userId: string }
 *
 * @example
 *   import { InferPathParams } from 'zimic/http';
 *
 *   // Without using a schema to validate the path (works as `PathParamsSchemaFromPath`):
 *   type PathParams = InferPathParams<'/users/:userId'>;
 *   // { userId: string }
 */
export type InferPathParams<
  PathOrSchema extends string | HttpSchema,
  OptionalPath extends PathOrSchema extends HttpSchema ? HttpSchemaPath.Literal<PathOrSchema> : never = never,
> = Prettify<
  RecursiveInferPathParams<
    PathOrSchema extends HttpSchema ? OptionalPath : PathOrSchema extends string ? PathOrSchema : never
  >
>;

type OmitPastHttpStatusCodes<
  Schema extends HttpResponseSchemaByStatusCode.Loose,
  PastSchemas extends HttpResponseSchemaByStatusCode.Loose[],
> =
  PastSchemas extends NonEmptyArray<HttpResponseSchemaByStatusCode.Loose>
    ? Omit<Schema, keyof UnionToIntersection<PastSchemas[number]>>
    : Schema;

type RecursiveMergeHttpResponsesByStatusCode<
  Schemas extends HttpResponseSchemaByStatusCode.Loose[],
  PastSchemas extends HttpResponseSchemaByStatusCode.Loose[] = [],
> = Schemas extends [
  infer FirstSchema extends HttpResponseSchemaByStatusCode.Loose,
  ...infer RestSchemas extends HttpResponseSchemaByStatusCode.Loose[],
]
  ? RestSchemas extends NonEmptyArray<HttpResponseSchemaByStatusCode.Loose>
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
 *   type MergedResponseByStatusCode = MergeHttpResponsesByStatusCode<
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
 *   type Schema = HttpSchema<{
 *     '/users': {
 *       GET: { response: MergedResponseByStatusCode };
 *     };
 *   }>;
 */
export type MergeHttpResponsesByStatusCode<
  Schemas extends HttpResponseSchemaByStatusCode.Loose[],
  PastSchemas extends HttpResponseSchemaByStatusCode.Loose[] = [],
> = HttpResponseSchemaByStatusCode.ConvertToStrict<RecursiveMergeHttpResponsesByStatusCode<Schemas, PastSchemas>>;
