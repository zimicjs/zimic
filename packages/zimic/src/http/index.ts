import {
  HttpMethodSchema,
  HttpMethodsSchema,
  HttpRequestSchema,
  HttpResponseSchema,
  HttpResponseSchemaByStatusCode,
  HttpResponseSchemaStatusCode,
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  InferPathParams,
  LiteralHttpSchemaPath,
  NonLiteralHttpSchemaPath,
} from './types/schema';

export { default as InvalidFormDataError } from './errors/InvalidFormDataError';
export { default as HttpFormData } from './formData/HttpFormData';
export { default as HttpHeaders } from './headers/HttpHeaders';
export { default as HttpSearchParams } from './searchParams/HttpSearchParams';

export type { HttpSearchParamsSerialized } from './searchParams/types';
export type { HttpHeadersSerialized } from './headers/types';

export type {
  HttpHeadersInit,
  HttpHeadersSchema,
  HttpHeadersSchemaTuple,
  HttpHeadersSchemaName,
} from './headers/types';

export type {
  HttpSearchParamsInit,
  HttpSearchParamsSchema,
  HttpSearchParamsSchemaTuple,
  HttpSearchParamsSchemaName,
} from './searchParams/types';

export type { HttpFormDataSchema } from './formData/types';

export type {
  HttpBody,
  HttpRequest,
  HttpResponse,
  StrictHeaders,
  StrictURLSearchParams,
  StrictFormData,
} from './types/requests';

/** @deprecated Use `HttpSchema` instead, which works as a drop-in replacement. */
export type HttpServiceSchema = HttpSchema;

/** @deprecated Use `HttpRequestSchema` instead, which works as a drop-in replacement. */
export type HttpServiceRequestSchema = HttpRequestSchema;

/** @deprecated Use `HttpResponseSchema` instead, which works as a drop-in replacement. */
export type HttpServiceResponseSchema = HttpResponseSchema;

/** @deprecated Use `HttpResponseSchemaByStatusCode` instead, which works as a drop-in replacement. */
export type HttpServiceResponseSchemaByStatusCode = HttpResponseSchemaByStatusCode;

/** @deprecated Use `HttpResponseSchemaStatusCode` instead, which works as a drop-in replacement. */
export type HttpServiceResponseSchemaStatusCode<ResponseSchemaByStatusCode extends HttpResponseSchemaByStatusCode> =
  HttpResponseSchemaStatusCode<ResponseSchemaByStatusCode>;

/** @deprecated Use `HttpMethodSchema` instead, which works as a drop-in replacement. */
export type HttpServiceMethodSchema = HttpMethodSchema;

/** @deprecated Use `HttpMethodsSchema` instead, which works as a drop-in replacement. */
export type HttpServiceMethodsSchema = HttpMethodsSchema;

/** @deprecated Use `HttpSchemaMethod` instead, which works as a drop-in replacement. */
export type HttpServiceSchemaMethod<Schema extends HttpSchema> = HttpSchemaMethod<Schema>;

/** @deprecated Use `LiteralHttpSchemaPath` instead, which works as a drop-in replacement. */
export type LiteralHttpServiceSchemaPath<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema> = HttpSchemaMethod<Schema>,
> = LiteralHttpSchemaPath<Schema, Method>;

/** @deprecated Use `NonLiteralHttpSchemaPath` instead, which works as a drop-in replacement. */
export type NonLiteralHttpServiceSchemaPath<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema> = HttpSchemaMethod<Schema>,
> = NonLiteralHttpSchemaPath<Schema, Method>;

/** @deprecated Use `HttpSchemaPath` instead, which works as a drop-in replacement. */
export type HttpServiceSchemaPath<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema> = HttpSchemaMethod<Schema>,
> = HttpSchemaPath<Schema, Method>;

/**
 * @deprecated Use {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#inferpathparams `InferPathParams` }
 *   instead, which works as a drop-in replacement with additional validation.
 */
export type PathParamsSchemaFromPath<Path extends string> = InferPathParams<Path>;

export type {
  HttpSchema,
  HttpMethod,
  HttpStatusCode,
  HttpPathParamsSchema,
  HttpRequestSchema,
  HttpResponseSchema,
  HttpResponseSchemaByStatusCode,
  HttpResponseSchemaStatusCode,
  HttpMethodSchema,
  HttpMethodsSchema,
  HttpSchemaMethod,
  LiteralHttpSchemaPath,
  NonLiteralHttpSchemaPath,
  HttpSchemaPath,
  InferPathParams,
  MergeHttpResponsesByStatusCode,
} from './types/schema';
