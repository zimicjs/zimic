import { Default, DefaultNoExclude, IfNever, ReplaceBy } from '@zimic/utils/types';

import { JSONSerialized, JSONValue } from '@/types/json';
import { HttpMethodSchema, HttpStatusCode } from '@/types/schema';

import HttpFormData from '../formData/HttpFormData';
import { HttpFormDataSchema } from '../formData/types';
import HttpHeaders from '../headers/HttpHeaders';
import { HttpHeadersSchema } from '../headers/types';
import HttpSearchParams from '../searchParams/HttpSearchParams';
import { HttpSearchParamsSchema } from '../searchParams/types';

/** The body type for HTTP requests and responses. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HttpBody = JSONValue | HttpFormData<any> | HttpSearchParams<any> | Blob | ArrayBuffer;

export namespace HttpBody {
  /** A loose version of the HTTP body type. JSON values are not strictly typed. */
  export type Loose = ReplaceBy<HttpBody, JSONValue, JSONValue.Loose>;

  /** Convert a possibly loose HTTP body to be strictly typed. JSON values are serialized to their strict form. */
  export type ConvertToStrict<Type> = Type extends Exclude<HttpBody, JSONValue> ? Type : JSONSerialized<Type>;
}

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
  StrictBody extends HttpBody.Loose = HttpBody,
  StrictHeadersSchema extends HttpHeadersSchema = HttpHeadersSchema,
> extends Request {
  headers: StrictHeaders<StrictHeadersSchema>;
  text: () => Promise<StrictBody extends string ? StrictBody : string>;
  json: () => Promise<StrictBody extends string | Exclude<HttpBody, JSONValue> ? never : StrictBody>;
  formData: () => Promise<
    StrictBody extends HttpFormData<infer HttpFormDataSchema>
      ? StrictFormData<HttpFormDataSchema>
      : StrictBody extends HttpSearchParams<infer HttpSearchParamsSchema>
        ? StrictFormData<HttpSearchParamsSchema>
        : FormData
  >;
  clone: () => this;
}

/**
 * An HTTP response with a strictly-typed JSON body and status code. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/Response `Response`} class.
 */
export interface HttpResponse<
  StrictBody extends HttpBody.Loose = HttpBody,
  StatusCode extends number = number,
  StrictHeadersSchema extends HttpHeadersSchema = HttpHeadersSchema,
> extends Response {
  ok: StatusCode extends HttpStatusCode.Information | HttpStatusCode.Success | HttpStatusCode.Redirection
    ? true
    : false;
  status: StatusCode;
  headers: StrictHeaders<StrictHeadersSchema>;
  text: () => Promise<StrictBody extends string ? StrictBody : string>;
  json: () => Promise<StrictBody extends string | Exclude<HttpBody, JSONValue> ? never : StrictBody>;
  formData: () => Promise<
    StrictBody extends HttpFormData<infer HttpFormDataSchema>
      ? StrictFormData<HttpFormDataSchema>
      : StrictBody extends HttpSearchParams<infer HttpSearchParamsSchema>
        ? StrictFormData<HttpSearchParamsSchema>
        : FormData
  >;
  clone: () => this;
}

export type HttpRequestHeadersSchema<MethodSchema extends HttpMethodSchema> = Default<
  Default<MethodSchema['request']>['headers']
>;

export type HttpRequestSearchParamsSchema<MethodSchema extends HttpMethodSchema> = Default<
  Default<MethodSchema['request']>['searchParams']
>;

export type HttpRequestBodySchema<MethodSchema extends HttpMethodSchema> = ReplaceBy<
  ReplaceBy<IfNever<DefaultNoExclude<Default<MethodSchema['request']>['body']>, null>, undefined, null>,
  ArrayBuffer,
  Blob
>;

export type HttpResponseHeadersSchema<
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpStatusCode,
> = Default<DefaultNoExclude<Default<Default<MethodSchema['response']>[StatusCode]>['headers']>>;

export type HttpResponseBodySchema<
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpStatusCode,
> = ReplaceBy<
  ReplaceBy<
    IfNever<DefaultNoExclude<Default<Default<MethodSchema['response']>[StatusCode]>['body']>, null>,
    undefined,
    null
  >,
  ArrayBuffer,
  Blob
>;
