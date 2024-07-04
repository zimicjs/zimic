import { JSONValue } from '@/types/json';

import HttpFormData from '../formData/HttpFormData';
import { HttpFormDataSchema } from '../formData/types';
import HttpHeaders from '../headers/HttpHeaders';
import { HttpHeadersSchema } from '../headers/types';
import HttpSearchParams from '../searchParams/HttpSearchParams';
import { HttpSearchParamsSchema } from '../searchParams/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HttpBodyValue = JSONValue | HttpFormData<any> | HttpSearchParams<any> | Blob | ArrayBuffer;

/** The body type for HTTP requests and responses. */
export type HttpBody<Type extends HttpBodyValue = HttpBodyValue> = Type;

/**
 * An HTTP headers object with a strictly-typed schema. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/Headers `Headers`} class.
 */
export type StrictHeaders<Schema extends HttpHeadersSchema = HttpHeadersSchema> = Pick<
  HttpHeaders<Schema>,
  keyof Headers
>;

/**
 * An HTTP search params object with a strictly-typed schema. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams `URLSearchParams`} class.
 */
export type StrictURLSearchParams<Schema extends HttpSearchParamsSchema = HttpSearchParamsSchema> = Pick<
  HttpSearchParams<Schema>,
  keyof URLSearchParams
>;

/**
 * An HTTP form data object with a strictly-typed schema. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/FormData `FormData`} class.
 */
export type StrictFormData<Schema extends HttpFormDataSchema = HttpFormDataSchema> = Pick<
  HttpFormData<Schema>,
  keyof FormData
>;

/**
 * An HTTP request with a strictly-typed JSON body. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/Request `Request`} class.
 */
export interface HttpRequest<
  StrictBody extends HttpBody = HttpBody,
  StrictHeadersSchema extends HttpHeadersSchema = HttpHeadersSchema,
> extends Request {
  headers: StrictHeaders<StrictHeadersSchema>;
  json: () => Promise<StrictBody extends Exclude<JSONValue, string> ? StrictBody : never>;
  formData: () => Promise<StrictBody extends HttpFormData<infer _HttpFormDataSchema> ? StrictBody : FormData>;
}

/**
 * An HTTP response with a strictly-typed JSON body and status code. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/Response `Response`} class.
 */
export interface HttpResponse<
  StrictBody extends HttpBody = HttpBody,
  StatusCode extends number = number,
  StrictHeadersSchema extends HttpHeadersSchema = HttpHeadersSchema,
> extends Response {
  status: StatusCode;
  headers: StrictHeaders<StrictHeadersSchema>;
  json: () => Promise<StrictBody extends Exclude<JSONValue, string> ? StrictBody : never>;
  formData: () => Promise<StrictBody extends HttpFormData<infer _HttpFormDataSchema> ? StrictBody : FormData>;
}
