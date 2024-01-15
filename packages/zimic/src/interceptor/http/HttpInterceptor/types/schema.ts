export type HttpInterceptorMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface HttpInterceptorRequestSchema {
  body?: unknown;
}

export interface HttpInterceptorResponseSchema {
  body?: unknown;
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

type HttpInterceptorPathSchema = {
  [Method in HttpInterceptorMethod]?: HttpInterceptorMethodSchema;
};

export interface HttpInterceptorSchema {
  [path: string]: HttpInterceptorPathSchema;
}

export type LiteralHttpInterceptorSchemaPath<Schema extends HttpInterceptorSchema> = Extract<keyof Schema, string>;

type AllowAnyStringInRouteParameters<Path extends string> = Path extends `${infer Prefix}:${string}/${infer Suffix}`
  ? `${Prefix}${string}/${AllowAnyStringInRouteParameters<Suffix>}`
  : Path extends `${infer Prefix}:${string}`
    ? `${Prefix}${string}`
    : Path;

export type NonLiteralHttpInterceptorSchemaPath<Schema extends HttpInterceptorSchema> = AllowAnyStringInRouteParameters<
  LiteralHttpInterceptorSchemaPath<Schema>
>;

export type HttpInterceptorSchemaPath<Schema extends HttpInterceptorSchema> =
  | LiteralHttpInterceptorSchemaPath<Schema>
  | NonLiteralHttpInterceptorSchemaPath<Schema>;
