import { Default, DefaultNoExclude, IfNever, Replace, JSONValue } from '@zimic/utils/types';

import { HttpMethodSchema, HttpRequestSchema, HttpResponseSchema, HttpStatusCode } from '@/types/schema';

import HttpFormData from '../formData/HttpFormData';
import { HttpFormDataSchema } from '../formData/types';
import HttpHeaders from '../headers/HttpHeaders';
import { HttpHeadersSchema } from '../headers/types';
import HttpSearchParams from '../searchParams/HttpSearchParams';
import { HttpSearchParamsSchema } from '../searchParams/types';

/** The body type for HTTP requests and responses. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HttpBody = JSONValue | HttpFormData<any> | HttpSearchParams<any> | Blob | ArrayBuffer | ReadableStream;

export namespace HttpBody {
  /** A loose version of the HTTP body type. JSON values are not strictly typed. */
  export type Loose = Replace<HttpBody, JSONValue, JSONValue.Loose>;
}

/**
 * An HTTP headers object with a strictly-typed schema. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/Headers `Headers`} class.
 */
export type StrictHeaders<Schema extends HttpHeadersSchema.Loose = HttpHeadersSchema.Loose> = Pick<
  HttpHeaders<Schema>,
  keyof Headers
>;

/**
 * An HTTP search params object with a strictly-typed schema. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams `URLSearchParams`} class.
 */
export type StrictURLSearchParams<Schema extends HttpSearchParamsSchema.Loose = HttpSearchParamsSchema.Loose> = Pick<
  HttpSearchParams<Schema>,
  keyof URLSearchParams
>;

/**
 * An HTTP form data object with a strictly-typed schema. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/FormData `FormData`} class.
 */
export type StrictFormData<Schema extends HttpFormDataSchema.Loose = HttpFormDataSchema.Loose> = Pick<
  HttpFormData<Schema>,
  keyof FormData
>;

/**
 * An HTTP request with a strictly-typed JSON body. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/Request `Request`} class.
 */
export interface HttpRequest<
  StrictBody extends HttpBody.Loose = HttpBody.Loose,
  StrictHeadersSchema extends HttpHeadersSchema.Loose = HttpHeadersSchema.Loose,
> extends Request {
  headers: StrictHeaders<StrictHeadersSchema>;
  text: () => Promise<StrictBody extends string ? StrictBody : string>;
  json: () => Promise<
    StrictBody extends string | Exclude<HttpBody, JSONValue> ? never : Replace<StrictBody, null | undefined, never>
  >;
  formData: () => Promise<
    StrictBody extends HttpFormData<infer HttpFormDataSchema>
      ? StrictFormData<HttpFormDataSchema>
      : StrictBody extends HttpSearchParams<infer HttpSearchParamsSchema>
        ? StrictFormData<HttpSearchParamsSchema>
        : StrictBody extends null | undefined
          ? never
          : FormData
  >;
  clone: () => this;
}

/**
 * An HTTP response with a strictly-typed JSON body and status code. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/Response `Response`} class.
 */
export interface HttpResponse<
  StrictBody extends HttpBody.Loose = HttpBody.Loose,
  StrictHeadersSchema extends HttpHeadersSchema.Loose = HttpHeadersSchema.Loose,
  StatusCode extends number = number,
> extends Response {
  ok: StatusCode extends HttpStatusCode.Information | HttpStatusCode.Success | HttpStatusCode.Redirection
    ? true
    : false;
  status: StatusCode;
  headers: StrictHeaders<StrictHeadersSchema>;
  text: () => Promise<StrictBody extends string ? StrictBody : string>;
  json: () => Promise<
    StrictBody extends string | Exclude<HttpBody, JSONValue> ? never : Replace<StrictBody, null | undefined, never>
  >;
  formData: () => Promise<
    StrictBody extends HttpFormData<infer HttpFormDataSchema>
      ? StrictFormData<HttpFormDataSchema>
      : StrictBody extends HttpSearchParams<infer HttpSearchParamsSchema>
        ? StrictFormData<HttpSearchParamsSchema>
        : StrictBody extends null | undefined
          ? never
          : FormData
  >;
  clone: () => this;
}

type HttpRequestHeadersSchemaFromBody<
  RequestSchema extends HttpRequestSchema,
  DefaultHeadersSchema,
> = 'body' extends keyof RequestSchema
  ? [RequestSchema['body']] extends [never]
    ? DefaultHeadersSchema
    : [Extract<RequestSchema['body'], BodyInit | HttpFormData | HttpSearchParams>] extends [never]
      ? 'headers' extends keyof RequestSchema
        ? [RequestSchema['headers']] extends [never]
          ? DefaultHeadersSchema
          : 'content-type' extends keyof Default<RequestSchema['headers']>
            ? DefaultHeadersSchema
            : { 'content-type': 'application/json' }
        : { 'content-type': 'application/json' }
      : DefaultHeadersSchema
  : DefaultHeadersSchema;

export type HttpRequestHeadersSchema<MethodSchema extends HttpMethodSchema> =
  'headers' extends keyof MethodSchema['request']
    ? [MethodSchema['request']['headers']] extends [never]
      ? HttpRequestHeadersSchemaFromBody<Default<MethodSchema['request']>, never>
      :
          | (MethodSchema['request']['headers'] &
              HttpRequestHeadersSchemaFromBody<Default<MethodSchema['request']>, {}>)
          | Extract<MethodSchema['request']['headers'], undefined>
    : HttpRequestHeadersSchemaFromBody<Default<MethodSchema['request']>, never>;

export type HttpRequestSearchParamsSchema<MethodSchema extends HttpMethodSchema> =
  'searchParams' extends keyof MethodSchema['request'] ? Default<MethodSchema['request']>['searchParams'] : never;

export type HttpRequestBodySchema<MethodSchema extends HttpMethodSchema> = Replace<
  IfNever<DefaultNoExclude<Default<MethodSchema['request']>['body']>, null>,
  undefined,
  null
>;

type HttpResponseHeadersSchemaFromBody<
  ResponseSchema extends HttpResponseSchema,
  DefaultHeadersSchema,
> = 'body' extends keyof ResponseSchema
  ? [ResponseSchema['body']] extends [never]
    ? DefaultHeadersSchema
    : [Extract<ResponseSchema['body'], BodyInit | HttpSearchParams | HttpFormData>] extends [never]
      ? 'headers' extends keyof ResponseSchema
        ? [ResponseSchema['headers']] extends [never]
          ? DefaultHeadersSchema
          : 'content-type' extends keyof Default<ResponseSchema['headers']>
            ? DefaultHeadersSchema
            : { 'content-type': 'application/json' }
        : { 'content-type': 'application/json' }
      : DefaultHeadersSchema
  : DefaultHeadersSchema;

export type HttpResponseHeadersSchema<
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpStatusCode,
> = 'headers' extends keyof Default<MethodSchema['response']>[StatusCode]
  ? [Default<MethodSchema['response']>[StatusCode]] extends [never]
    ? HttpResponseHeadersSchemaFromBody<Default<Default<MethodSchema['response']>[StatusCode]>, never>
    :
        | (Default<Default<MethodSchema['response']>[StatusCode]>['headers'] &
            HttpResponseHeadersSchemaFromBody<Default<Default<MethodSchema['response']>[StatusCode]>, {}>)
        | Extract<Default<Default<MethodSchema['response']>[StatusCode]>['headers'], undefined>
  : HttpResponseHeadersSchemaFromBody<Default<Default<MethodSchema['response']>[StatusCode]>, never>;

export type HttpResponseBodySchema<MethodSchema extends HttpMethodSchema, StatusCode extends HttpStatusCode> = Replace<
  IfNever<DefaultNoExclude<Default<Default<MethodSchema['response']>[StatusCode]>['body']>, null>,
  undefined,
  null
>;
