import { IfAny, Prettify, UnionToIntersection } from '@/types/utils';

import { HttpHeadersSchema } from '../headers/types';
import { HttpSearchParamsSchema } from '../searchParams/types';
import { HttpBody } from './requests';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface HttpServiceRequestSchema {
  headers?: HttpHeadersSchema;
  searchParams?: HttpSearchParamsSchema;
  body?: HttpBody;
}

export interface HttpServiceResponseSchema {
  headers?: HttpHeadersSchema;
  body?: HttpBody;
}

export interface HttpServiceResponseSchemaByStatusCode {
  [statusCode: number]: HttpServiceResponseSchema;
}

export type HttpServiceResponseSchemaStatusCode<
  ResponseSchemaByStatusCode extends HttpServiceResponseSchemaByStatusCode,
> = Extract<keyof ResponseSchemaByStatusCode, number>;

export interface HttpServiceMethodSchema {
  request?: HttpServiceRequestSchema;
  response?: HttpServiceResponseSchemaByStatusCode;
}

export type HttpServiceMethodsSchema = {
  [Method in HttpMethod]?: HttpServiceMethodSchema;
};

export interface HttpServiceSchema {
  [path: string]: HttpServiceMethodsSchema;
}

export namespace HttpSchema {
  export type Paths<Schema extends HttpServiceSchema> = Prettify<Schema>;
  export type Methods<Schema extends HttpServiceMethodsSchema> = Prettify<Schema>;
  export type Method<Schema extends HttpServiceMethodSchema> = Prettify<Schema>;
  export type Request<Schema extends HttpServiceRequestSchema> = Prettify<Schema>;
  export type ResponseByStatusCode<Schema extends HttpServiceResponseSchemaByStatusCode> = Prettify<Schema>;
  export type Response<Schema extends HttpServiceResponseSchema> = Prettify<Schema>;
  export type Headers<Schema extends HttpHeadersSchema> = Prettify<Schema>;
  export type SearchParams<Schema extends HttpSearchParamsSchema> = Prettify<Schema>;
}

export type HttpServiceSchemaMethod<Schema extends HttpServiceSchema> = IfAny<
  Schema,
  any, // eslint-disable-line @typescript-eslint/no-explicit-any
  Extract<keyof UnionToIntersection<Schema[keyof Schema]>, HttpMethod>
>;

export type LiteralHttpServiceSchemaPath<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
> = LooseLiteralHttpServiceSchemaPath<Schema, Method>;

export type LooseLiteralHttpServiceSchemaPath<Schema extends HttpServiceSchema, Method extends HttpMethod> = {
  [Path in Extract<keyof Schema, string>]: Method extends keyof Schema[Path] ? Path : never;
}[Extract<keyof Schema, string>];

export type AllowAnyStringInPathParameters<Path extends string> =
  Path extends `${infer Prefix}:${string}/${infer Suffix}`
    ? `${Prefix}${string}/${AllowAnyStringInPathParameters<Suffix>}`
    : Path extends `${infer Prefix}:${string}`
      ? `${Prefix}${string}`
      : Path;

export type NonLiteralHttpServiceSchemaPath<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
> = AllowAnyStringInPathParameters<LiteralHttpServiceSchemaPath<Schema, Method>>;

export type HttpServiceSchemaPath<Schema extends HttpServiceSchema, Method extends HttpServiceSchemaMethod<Schema>> =
  | LiteralHttpServiceSchemaPath<Schema, Method>
  | NonLiteralHttpServiceSchemaPath<Schema, Method>;
