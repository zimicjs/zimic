import { JSONValue } from '@/types/json';

import HttpHeaders from '../headers/HttpHeaders';
import { HttpHeadersSchema } from '../headers/types';
import HttpSearchParams from '../searchParams/HttpSearchParams';
import { HttpSearchParamsSchema } from '../searchParams/types';

/** The default body type for HTTP requests and responses. */
export type HttpBody = JSONValue;

/**
 * An HTTP headers object with a strictly-typed schema. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/Headers `Headers`} class.
 */
export type StrictHeaders<Schema extends HttpHeadersSchema> = Pick<HttpHeaders<Schema>, keyof Headers>;

/**
 * An HTTP search params object with a strictly-typed schema. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams `URLSearchParams`} class.
 */
export type StrictURLSearchParams<Schema extends HttpSearchParamsSchema> = Pick<
  HttpSearchParams<Schema>,
  keyof URLSearchParams
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
  json: () => Promise<StrictBody>;
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
  json: () => Promise<StrictBody>;
}
