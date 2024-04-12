import { IfAny, Prettify, UnionToIntersection } from '@/types/utils';

import { HttpHeadersSchema } from '../headers/types';
import { HttpSearchParamsSchema } from '../searchParams/types';
import { HttpBody } from './requests';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/** A schema representing the structure of an HTTP request. */
export interface HttpServiceRequestSchema {
  headers?: HttpHeadersSchema;
  searchParams?: HttpSearchParamsSchema;
  body?: HttpBody;
}

/** A schema representing the structure of an HTTP response. */
export interface HttpServiceResponseSchema {
  headers?: HttpHeadersSchema;
  body?: HttpBody;
}

/** A schema representing the structures of HTTP responses by status code. */
export interface HttpServiceResponseSchemaByStatusCode {
  [statusCode: number]: HttpServiceResponseSchema;
}

/** Extracts the status codes used in response schema by status code. */
export type HttpServiceResponseSchemaStatusCode<
  ResponseSchemaByStatusCode extends HttpServiceResponseSchemaByStatusCode,
> = Extract<keyof ResponseSchemaByStatusCode, number>;

/** A schema representing the structures of an HTTP request and response for a given method. */
export interface HttpServiceMethodSchema {
  request?: HttpServiceRequestSchema;
  response?: HttpServiceResponseSchemaByStatusCode;
}

/** A schema representing the structures of HTTP request and response by method. */
export type HttpServiceMethodsSchema = {
  [Method in HttpMethod]?: HttpServiceMethodSchema;
};

/** A schema representing the structures of paths, methods, requests, and responses for an HTTP service. */
export interface HttpServiceSchema {
  [path: string]: HttpServiceMethodsSchema;
}

/** A namespace containing utility types for validating HTTP type schemas. */
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

/** Extracts the methods from an HTTP service schema. */
export type HttpServiceSchemaMethod<Schema extends HttpServiceSchema> = IfAny<
  Schema,
  any, // eslint-disable-line @typescript-eslint/no-explicit-any
  Extract<keyof UnionToIntersection<Schema[keyof Schema]>, HttpMethod>
>;

/**
 * Extracts the literal paths from an HTTP service schema containing certain methods. Only the methods defined in the
 * schema are allowed.
 */
export type LiteralHttpServiceSchemaPath<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
> = LooseLiteralHttpServiceSchemaPath<Schema, Method>;

/** Extracts the literal paths from an HTTP service schema containing certain methods. Any method is allowed. */
export type LooseLiteralHttpServiceSchemaPath<Schema extends HttpServiceSchema, Method extends HttpMethod> = {
  [Path in Extract<keyof Schema, string>]: Method extends keyof Schema[Path] ? Path : never;
}[Extract<keyof Schema, string>];

type AllowAnyStringInPathParams<Path extends string> = Path extends `${infer Prefix}:${string}/${infer Suffix}`
  ? `${Prefix}${string}/${AllowAnyStringInPathParams<Suffix>}`
  : Path extends `${infer Prefix}:${string}`
    ? `${Prefix}${string}`
    : Path;

/** Extracts the non-literal paths from an HTTP service schema containing certain methods. */
export type NonLiteralHttpServiceSchemaPath<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
> = AllowAnyStringInPathParams<LiteralHttpServiceSchemaPath<Schema, Method>>;

type RecursiveNonLiteralHttpServiceSchemaPathToLiteral<
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

export type NonLiteralHttpServiceSchemaPathToLiteral<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  NonLiteralPath extends string,
  LiteralPath extends LiteralHttpServiceSchemaPath<Schema, Method> = LiteralHttpServiceSchemaPath<Schema, Method>,
> = LiteralPath extends LiteralPath
  ? RecursiveNonLiteralHttpServiceSchemaPathToLiteral<Schema, Method, NonLiteralPath, LiteralPath>
  : never;

/** Extracts the paths from an HTTP service schema containing certain methods. */
export type HttpServiceSchemaPath<Schema extends HttpServiceSchema, Method extends HttpServiceSchemaMethod<Schema>> =
  | LiteralHttpServiceSchemaPath<Schema, Method>
  | NonLiteralHttpServiceSchemaPath<Schema, Method>;

type RecursivePathParamsSchemaFromPath<Path extends string> =
  Path extends `${infer _Prefix}:${infer ParamName}/${infer Suffix}`
    ? { [Name in ParamName]: string } & RecursivePathParamsSchemaFromPath<Suffix>
    : Path extends `${infer _Prefix}:${infer ParamName}`
      ? { [Name in ParamName]: string }
      : {};

export type PathParamsSchemaFromPath<Path extends string> = Prettify<RecursivePathParamsSchemaFromPath<Path>>;
