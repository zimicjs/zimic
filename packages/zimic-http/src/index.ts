export type { JSONValue, JSONSerialized } from '@zimic/utils/types';

export { HttpFormData } from '@zimic/utils/http';
export type { HttpFormDataSchema, HttpFormDataSchemaName, HttpFormDataSerialized } from '@zimic/utils/http';

export type { HttpPathParamsSchema, HttpPathParamsSerialized } from '@zimic/utils/http';

export { HttpHeaders } from '@zimic/utils/http';
export type {
  HttpHeadersInit,
  HttpHeadersSchema,
  HttpHeadersSchemaTuple,
  HttpHeadersSchemaName,
  HttpHeadersSerialized,
} from '@zimic/utils/http';

export { HttpSearchParams } from '@zimic/utils/http';
export type {
  HttpSearchParamsInit,
  HttpSearchParamsSchema,
  HttpSearchParamsSchemaTuple,
  HttpSearchParamsSchemaName,
  HttpSearchParamsSerialized,
} from '@zimic/utils/http';

export type { HttpBody } from '@zimic/utils/http';

export type {
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
export { parseHttpBody, InvalidJSONError, InvalidFormDataError } from '@zimic/utils/http';
