import {
  HttpBody,
  HttpHeadersSchema,
  HttpHeadersSerialized,
  HttpMethodSchema,
  HttpResponseHeadersSchema,
  HttpResponseSchema,
  HttpResponseSchemaStatusCode,
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpStatusCode,
} from '@zimic/http';
import { Default } from '@zimic/utils/types';

import { FetchRequest } from '../request/FetchRequest';
import { FetchRequestBodySchema, FetchRequestInitWithHeaders } from '../request/types';
import { FetchResponse } from './FetchResponse';

export type AllFetchResponseStatusCode<MethodSchema extends HttpMethodSchema> = HttpResponseSchemaStatusCode<
  Default<MethodSchema['response']>
>;

type FilterFetchResponseStatusCodeByError<
  StatusCode extends HttpStatusCode,
  ErrorOnly extends boolean,
> = ErrorOnly extends true ? Extract<StatusCode, HttpStatusCode.ClientError | HttpStatusCode.ServerError> : StatusCode;

type FilterFetchResponseStatusCodeByRedirect<
  StatusCode extends HttpStatusCode,
  Redirect extends RequestRedirect,
> = Redirect extends 'error'
  ? FilterFetchResponseStatusCodeByRedirect<StatusCode, 'follow'>
  : Redirect extends 'follow'
    ? Exclude<StatusCode, Exclude<HttpStatusCode.Redirection, 304>>
    : StatusCode;

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response `FetchResponse` API reference} */
export type FetchResponseStatusCode<
  MethodSchema extends HttpMethodSchema,
  ErrorOnly extends boolean,
  Redirect extends RequestRedirect,
> = FilterFetchResponseStatusCodeByRedirect<
  FilterFetchResponseStatusCodeByError<AllFetchResponseStatusCode<MethodSchema>, ErrorOnly>,
  Redirect
>;

type FetchResponseInitWithHeaders<HeadersSchema extends HttpHeadersSchema | undefined> =
  FetchRequestInitWithHeaders<HeadersSchema>;

export type FetchResponseBodySchema<ResponseSchema extends HttpResponseSchema> = FetchRequestBodySchema<ResponseSchema>;

type FetchResponseInitPerStatusCode<
  MethodSchema extends HttpMethodSchema,
  StatusCode extends AllFetchResponseStatusCode<MethodSchema>,
> = { status: StatusCode } & FetchResponseInitWithHeaders<HttpResponseHeadersSchema<MethodSchema, StatusCode>>;

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response `FetchResponse` API reference} */
export type FetchResponseInit<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  /** @deprecated The type parameter `ErrorOnly` will be removed in the next major version. */
  ErrorOnly extends boolean = false,
  Redirect extends RequestRedirect = 'follow',
  StatusCode extends FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect> =
    FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect>,
> = Omit<ResponseInit, 'headers' | 'status'> &
  (StatusCode extends StatusCode ? FetchResponseInitPerStatusCode<Default<Schema[Path][Method]>, StatusCode> : never);

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response `FetchResponse` API reference} */
export interface FetchResponseConstructor {
  new <
    Schema extends HttpSchema,
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath.Literal<Schema, Method>,
    /** @deprecated The type parameter `ErrorOnly` will be removed in the next major version. */
    ErrorOnly extends boolean = false,
    Redirect extends RequestRedirect = 'follow',
    StatusCode extends FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect> =
      FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect>,
  >(
    fetchRequest: FetchRequest<Schema, Method, Path>,
    response?: Response,
  ): FetchResponse<Schema, Method, Path, ErrorOnly, Redirect, StatusCode>;
  new <
    Schema extends HttpSchema,
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath.Literal<Schema, Method>,
    /** @deprecated The type parameter `ErrorOnly` will be removed in the next major version. */
    ErrorOnly extends boolean = false,
    Redirect extends RequestRedirect = 'follow',
    StatusCode extends FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect> =
      FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect>,
  >(
    fetchRequest: FetchRequest<Schema, Method, Path>,
    body?: FetchResponseBodySchema<Default<Default<Default<Schema[Path][Method]>['response']>[StatusCode]>>,
    init?: FetchResponseInit<Schema, Method, Path, ErrorOnly, Redirect, StatusCode>,
  ): FetchResponse<Schema, Method, Path, ErrorOnly, Redirect, StatusCode>;

  [Symbol.hasInstance]: (instance: unknown) => boolean;
}

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response#errortoobject `response.toObject()` API reference} */
export interface FetchResponseObjectOptions {
  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-response#errortoobject `response.toObject()` API reference} */
  includeBody?: boolean;
}

export namespace FetchResponseObjectOptions {
  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-response#errortoobject `response.toObject()` API reference} */
  export interface WithBody {
    includeBody: true;
  }

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-response#errortoobject `response.toObject()` API reference} */
  export interface WithoutBody {
    includeBody?: false;
  }
}

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response#responsetoobject `response.toObject()`} */
export type FetchResponseObject = Pick<
  FetchResponse.Loose,
  'url' | 'type' | 'status' | 'statusText' | 'ok' | 'redirected'
> & {
  headers: HttpHeadersSerialized<HttpHeadersSchema>;
  body?: HttpBody | null;
};
