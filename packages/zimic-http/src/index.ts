export type { JSONValue, JSONSerialized } from '@zimic/utils/types/json';

export { default as HttpFormData } from './formData/HttpFormData';
export type { HttpFormDataSchema, HttpFormDataSchemaName, HttpFormDataSerialized } from './formData/types';

export type { HttpPathParamsSchema, HttpPathParamsSerialized } from './pathParams/types';

export { default as HttpHeaders } from './headers/HttpHeaders';
export type {
  HttpHeadersInit,
  HttpHeadersSchema,
  HttpHeadersSchemaTuple,
  HttpHeadersSchemaName,
  HttpHeadersSerialized,
} from './headers/types';

export { default as HttpSearchParams } from './searchParams/HttpSearchParams';
export type {
  HttpSearchParamsInit,
  HttpSearchParamsSchema,
  HttpSearchParamsSchemaTuple,
  HttpSearchParamsSchemaName,
  HttpSearchParamsSerialized,
} from './searchParams/types';

export type {
  HttpBody,
  HttpRequest,
  HttpResponse,
  StrictHeaders,
  StrictURLSearchParams,
  StrictFormData,
  HttpRequestHeadersSchema,
  HttpRequestBodySchema,
  HttpRequestSearchParamsSchema,
  HttpResponseHeadersSchema,
  HttpResponseBodySchema,
} from './types/requests';

export type {
  HttpSchema,
  HttpMethod,
  HttpStatusCode,
  HttpRequestSchema,
  HttpResponseSchema,
  HttpResponseSchemaByStatusCode,
  HttpResponseSchemaStatusCode,
  HttpMethodSchema,
  HttpMethodsSchema,
  HttpSchemaMethod,
  AllowAnyStringInPathParams,
  LiteralHttpSchemaPathFromNonLiteral,
  HttpSchemaPath,
  InferPathParams,
  MergeHttpResponsesByStatusCode,
} from './types/schema';

export { HTTP_METHODS } from './types/schema';
