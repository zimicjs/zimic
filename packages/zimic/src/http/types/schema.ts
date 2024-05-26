import { IfAny, UnionToIntersection, UnionHasMoreThanOneType, Prettify } from '@/types/utils';

import { HttpHeadersSchema } from '../headers/types';
import { HttpSearchParamsSchema } from '../searchParams/types';
import { HttpBody } from './requests';

export const HTTP_METHODS = Object.freeze(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const);
/**
 * A type representing the currently supported
 * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods `HTTP methods`}.
 */
export type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * A schema representing the structure of an HTTP request.
 *
 * @see {@link https://github.com/zimicjs/zimic#declaring-http-service-schemas Declaring HTTP Service Schemas}
 */
export interface HttpServiceRequestSchema {
  headers?: HttpHeadersSchema;
  searchParams?: HttpSearchParamsSchema;
  body?: HttpBody;
}

/**
 * A schema representing the structure of an HTTP response.
 *
 * @see {@link https://github.com/zimicjs/zimic#declaring-http-service-schemas Declaring HTTP Service Schemas}
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
 * A schema representing the structure of HTTP responses by status code.
 *
 * @see {@link https://github.com/zimicjs/zimic#declaring-http-service-schemas Declaring HTTP Service Schemas}
 */
export type HttpServiceResponseSchemaByStatusCode = {
  [statusCode: number]: HttpServiceResponseSchema;
} & {
  204?: HttpServiceResponseSchema.NoBody;
};

// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace HttpServiceResponseSchemaByStatusCode {
  export type NoBody = HttpServiceResponseSchemaByStatusCode & {
    [statusCode: number]: HttpServiceResponseSchema.NoBody;
  };
}

/**
 * Extracts the status codes used in a response schema by status code.
 *
 * @see {@link https://github.com/zimicjs/zimic#declaring-http-service-schemas Declaring HTTP Service Schemas}
 */
export type HttpServiceResponseSchemaStatusCode<
  ResponseSchemaByStatusCode extends HttpServiceResponseSchemaByStatusCode,
> = Extract<keyof ResponseSchemaByStatusCode, number>;

/**
 * A schema representing the structure of an HTTP request and response for a given method.
 *
 * @see {@link https://github.com/zimicjs/zimic#declaring-http-service-schemas Declaring HTTP Service Schemas}
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
 * @see {@link https://github.com/zimicjs/zimic#declaring-http-service-schemas Declaring HTTP Service Schemas}
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
 * @see {@link https://github.com/zimicjs/zimic#declaring-http-service-schemas Declaring HTTP Service Schemas}
 */
export interface HttpServiceSchema {
  [path: string]: HttpServiceMethodsSchema;
}

/**
 * A namespace containing utility types for validating HTTP type schemas.
 *
 * @see {@link https://github.com/zimicjs/zimic#declaring-http-service-schemas Declaring HTTP Service Schemas}
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
  /** Validates that a type is a valid HTTP headers schema. */
  export type Headers<Schema extends HttpHeadersSchema> = Schema;
  /** Validates that a type is a valid HTTP search params schema. */
  export type SearchParams<Schema extends HttpSearchParamsSchema> = Schema;
}

/**
 * Extracts the methods from an HTTP service schema.
 *
 * @see {@link https://github.com/zimicjs/zimic#declaring-http-service-schemas Declaring HTTP Service Schemas}
 */
export type HttpServiceSchemaMethod<Schema extends HttpServiceSchema> = IfAny<
  Schema,
  any, // eslint-disable-line @typescript-eslint/no-explicit-any
  Extract<keyof UnionToIntersection<Schema[keyof Schema]>, HttpMethod>
>;

/**
 * Extracts the literal paths from an HTTP service schema containing certain methods. Only the methods defined in the
 * schema are allowed.
 *
 * @see {@link https://github.com/zimicjs/zimic#declaring-http-service-schemas Declaring HTTP Service Schemas}
 */
export type LiteralHttpServiceSchemaPath<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
> = LooseLiteralHttpServiceSchemaPath<Schema, Method>;

/**
 * Extracts the literal paths from an HTTP service schema containing certain methods. Any method is allowed.
 *
 * @see {@link https://github.com/zimicjs/zimic#declaring-http-service-schemas Declaring HTTP Service Schemas}
 */
export type LooseLiteralHttpServiceSchemaPath<Schema extends HttpServiceSchema, Method extends HttpMethod> = {
  [Path in Extract<keyof Schema, string>]: Method extends keyof Schema[Path] ? Path : never;
}[Extract<keyof Schema, string>];

type AllowAnyStringInPathParams<Path extends string> = Path extends `${infer Prefix}:${string}/${infer Suffix}`
  ? `${Prefix}${string}/${AllowAnyStringInPathParams<Suffix>}`
  : Path extends `${infer Prefix}:${string}`
    ? `${Prefix}${string}`
    : Path;

/**
 * Extracts the non-literal paths from an HTTP service schema containing certain methods.
 *
 * @see {@link https://github.com/zimicjs/zimic#declaring-http-service-schemas Declaring HTTP Service Schemas}
 */
export type NonLiteralHttpServiceSchemaPath<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
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

export type InferLiteralHttpServiceSchemaPath<
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
 * Extracts the paths from an HTTP service schema containing certain methods.
 *
 * @see {@link https://github.com/zimicjs/zimic#declaring-http-service-schemas Declaring HTTP Service Schemas}
 */
export type HttpServiceSchemaPath<Schema extends HttpServiceSchema, Method extends HttpServiceSchemaMethod<Schema>> =
  | LiteralHttpServiceSchemaPath<Schema, Method>
  | NonLiteralHttpServiceSchemaPath<Schema, Method>;

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
 *   '/users/:userId/notifications' -> { userId: string }
 */
export type PathParamsSchemaFromPath<Path extends string> = Prettify<RecursivePathParamsSchemaFromPath<Path>>;
