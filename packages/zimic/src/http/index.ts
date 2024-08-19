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

export type {
  /** @deprecated Use `HttpSchema` instead, which works as a drop-in replacement. */
  HttpSchema as HttpServiceSchema,
  HttpSchema,
  HttpMethod,
  HttpStatusCode,
  HttpPathParamsSchema,

  /** @deprecated Use `HttpRequestSchema` instead, which works as a drop-in replacement. */
  HttpRequestSchema as HttpServiceRequestSchema,
  HttpRequestSchema,

  /** @deprecated Use `HttpResponseSchema` instead, which works as a drop-in replacement. */
  HttpResponseSchema as HttpServiceResponseSchema,
  HttpResponseSchema,

  /** @deprecated Use `HttpResponseSchemaByStatusCode` instead, which works as a drop-in replacement. */
  HttpResponseSchemaByStatusCode as HttpServiceResponseSchemaByStatusCode,
  HttpResponseSchemaByStatusCode,

  /** @deprecated Use `HttpResponseSchemaStatusCode` instead, which works as a drop-in replacement. */
  HttpResponseSchemaStatusCode as HttpServiceResponseSchemaStatusCode,
  HttpResponseSchemaStatusCode,

  /** @deprecated Use `HttpMethodSchema` instead, which works as a drop-in replacement. */
  HttpMethodSchema as HttpServiceMethodSchema,
  HttpMethodSchema,

  /** @deprecated Use `HttpMethodsSchema` instead, which works as a drop-in replacement. */
  HttpMethodsSchema as HttpServiceMethodsSchema,
  HttpMethodsSchema,

  /** @deprecated Use `HttpSchemaMethod` instead, which works as a drop-in replacement. */
  HttpSchemaMethod as HttpServiceSchemaMethod,
  HttpSchemaMethod,

  /** @deprecated Use `LiteralHttpSchemaPath` instead, which works as a drop-in replacement. */
  LiteralHttpSchemaPath as LiteralHttpServiceSchemaPath,
  LiteralHttpSchemaPath,

  /** @deprecated Use `NonLiteralHttpSchemaPath` instead, which works as a drop-in replacement. */
  NonLiteralHttpSchemaPath as NonLiteralHttpServiceSchemaPath,
  NonLiteralHttpSchemaPath,

  /** @deprecated Use `HttpSchemaPath` instead, which works as a drop-in replacement. */
  HttpSchemaPath as HttpServiceSchemaPath,
  HttpSchemaPath,

  /**
   * @deprecated Use {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#inferpathparams `InferPathParams` }
   *   instead, which works as a drop-in replacement with additional validation.
   */
  InferPathParams as PathParamsSchemaFromPath,
  InferPathParams,
  MergeHttpResponsesByStatusCode,
} from './types/schema';
