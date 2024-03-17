import { HttpHeadersSchema } from '@/http/headers/types';
import { HttpSearchParamsSchema } from '@/http/searchParams/types';
import { DefaultBody } from '@/http/types/requests';
import { Default, UnionToIntersection, Prettify, IfAny } from '@/types/utils';

import { HttpRequestHandlerContext } from '../../interceptorWorker/types/requests';
import { HttpInterceptor } from './public';

export const HTTP_INTERCEPTOR_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export type HttpInterceptorMethod = (typeof HTTP_INTERCEPTOR_METHODS)[number];

export type HttpInterceptorHeadersSchema = HttpHeadersSchema;

export type HttpInterceptorSearchParamsSchema = HttpSearchParamsSchema;

export type HttpInterceptorBodySchema = DefaultBody;

export interface HttpInterceptorRequestSchema {
  headers?: HttpInterceptorHeadersSchema;
  searchParams?: HttpInterceptorSearchParamsSchema;
  body?: HttpInterceptorBodySchema;
}

export interface HttpInterceptorResponseSchema {
  headers?: HttpInterceptorHeadersSchema;
  body?: HttpInterceptorBodySchema;
}

export interface HttpInterceptorResponseSchemaByStatusCode {
  [statusCode: number]: HttpInterceptorResponseSchema;
}

export type HttpInterceptorResponseSchemaStatusCode<
  ResponseSchemaByStatusCode extends HttpInterceptorResponseSchemaByStatusCode,
> = Extract<keyof ResponseSchemaByStatusCode, number>;

export interface HttpInterceptorMethodSchema {
  request?: HttpInterceptorRequestSchema;
  response?: HttpInterceptorResponseSchemaByStatusCode;
}

export type HttpInterceptorPathSchema = {
  [Method in HttpInterceptorMethod]?: HttpInterceptorMethodSchema;
};

export interface HttpInterceptorSchema {
  [path: string]: HttpInterceptorPathSchema;
}

export namespace HttpInterceptorSchema {
  export type Root<Schema extends HttpInterceptorSchema> = Prettify<Schema>;
  export type Path<Schema extends HttpInterceptorPathSchema> = Prettify<Schema>;
  export type Method<Schema extends HttpInterceptorMethodSchema> = Prettify<Schema>;

  export type Request<Schema extends HttpInterceptorRequestSchema> = Prettify<Schema>;
  export type Response<Schema extends HttpInterceptorResponseSchema> = Prettify<Schema>;
  export type ResponseByStatusCode<Schema extends HttpInterceptorResponseSchemaByStatusCode> = Prettify<Schema>;

  export type Headers<Schema extends HttpInterceptorHeadersSchema> = Prettify<Schema>;
  export type SearchParams<Schema extends HttpInterceptorSearchParamsSchema> = Prettify<Schema>;
  export type Body<Schema extends HttpInterceptorBodySchema> = Prettify<Schema>;
}

export type ExtractHttpInterceptorSchema<Interceptor> =
  Interceptor extends HttpInterceptor<infer Schema> ? Schema : never;

export type HttpInterceptorSchemaMethod<Schema extends HttpInterceptorSchema> = IfAny<
  Schema,
  any, // eslint-disable-line @typescript-eslint/no-explicit-any
  Extract<keyof UnionToIntersection<Schema[keyof Schema]>, HttpInterceptorMethod>
>;

export type LiteralHttpInterceptorSchemaPath<
  Schema extends HttpInterceptorSchema,
  Method extends HttpInterceptorSchemaMethod<Schema>,
> = LooseLiteralHttpInterceptorSchemaPath<Schema, Method>;

export type LooseLiteralHttpInterceptorSchemaPath<
  Schema extends HttpInterceptorSchema,
  Method extends HttpInterceptorMethod,
> = {
  [Path in Extract<keyof Schema, string>]: Method extends keyof Schema[Path] ? Path : never;
}[Extract<keyof Schema, string>];

export type AllowAnyStringInPathParameters<Path extends string> =
  Path extends `${infer Prefix}:${string}/${infer Suffix}`
    ? `${Prefix}${string}/${AllowAnyStringInPathParameters<Suffix>}`
    : Path extends `${infer Prefix}:${string}`
      ? `${Prefix}${string}`
      : Path;

export type NonLiteralHttpInterceptorSchemaPath<
  Schema extends HttpInterceptorSchema,
  Method extends HttpInterceptorSchemaMethod<Schema>,
> = AllowAnyStringInPathParameters<LiteralHttpInterceptorSchemaPath<Schema, Method>>;

export type HttpInterceptorSchemaPath<
  Schema extends HttpInterceptorSchema,
  Method extends HttpInterceptorSchemaMethod<Schema>,
> = LiteralHttpInterceptorSchemaPath<Schema, Method> | NonLiteralHttpInterceptorSchemaPath<Schema, Method>;

export type HttpInterceptorRequestContext<
  Schema extends HttpInterceptorSchema,
  Method extends HttpInterceptorSchemaMethod<Schema>,
  Path extends HttpInterceptorSchemaPath<Schema, Method>,
> = HttpRequestHandlerContext<Default<Default<Schema[Path][Method]>['request']>['body']>;
