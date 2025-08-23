import {
  HttpBody,
  HttpFormData,
  HttpHeaders,
  HttpHeadersSchema,
  HttpRequestBodySchema,
  HttpRequestHeadersSchema,
  HttpRequestSearchParamsSchema,
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpSearchParams,
  HttpSearchParamsSchema,
} from '@zimic/http';
import { IfNever, Default, DeepPartial, PossiblePromise } from '@zimic/utils/types';

import { HttpInterceptorRequest } from './requests';

type PartialHttpHeadersOrSchema<Schema extends HttpHeadersSchema.Loose> = IfNever<
  Schema,
  never,
  Partial<Schema> | HttpHeaders<Partial<Schema>> | HttpHeaders<Schema>
>;

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference} */
export type HttpRequestHandlerHeadersStaticRestriction<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> = PartialHttpHeadersOrSchema<Default<HttpRequestHeadersSchema<Default<Schema[Path][Method]>>>>;

type PartialHttpSearchParamsOrSchema<Schema extends HttpSearchParamsSchema.Loose> = IfNever<
  Schema,
  never,
  Partial<Schema> | HttpSearchParams<Partial<Schema>> | HttpSearchParams<Schema>
>;

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference} */
export type HttpRequestHandlerSearchParamsStaticRestriction<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> = PartialHttpSearchParamsOrSchema<Default<HttpRequestSearchParamsSchema<Default<Schema[Path][Method]>>>>;

type PartialBodyOrSchema<Body extends HttpBody> =
  Body extends HttpFormData<infer Schema>
    ? HttpFormData<Partial<Schema>> | HttpFormData<Schema>
    : Body extends HttpSearchParams<infer Schema>
      ? HttpSearchParams<Partial<Schema>> | HttpSearchParams<Schema>
      : Body extends Blob
        ? Body
        : Body extends ArrayBuffer
          ? Body
          : Body extends ReadableStream
            ? Body
            : DeepPartial<Body>;

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference} */
export type HttpRequestHandlerBodyStaticRestriction<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> = PartialBodyOrSchema<HttpRequestBodySchema<Default<Schema[Path][Method]>>>;

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference} */
export interface HttpRequestHandlerStaticRestriction<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> {
  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference} */
  headers?: HttpRequestHandlerHeadersStaticRestriction<Schema, Method, Path>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference} */
  searchParams?: HttpRequestHandlerSearchParamsStaticRestriction<Schema, Method, Path>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference} */
  body?: HttpRequestHandlerBodyStaticRestriction<Schema, Method, Path>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference} */
  exact?: boolean;
}

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference} */
export type HttpRequestHandlerComputedRestriction<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> = (request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>) => PossiblePromise<boolean>;

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference} */
export type HttpRequestHandlerRestriction<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> =
  | HttpRequestHandlerStaticRestriction<Schema, Method, Path>
  | HttpRequestHandlerComputedRestriction<Schema, Method, Path>;

export interface RestrictionDiff<Value> {
  expected: Value;
  received: Value;
}

export type RestrictionMatchResult<Value> = { success: true; diff?: undefined } | { success: false; diff: Value };

export interface RestrictionDiffs {
  computed?: RestrictionDiff<boolean>;
  headers?: RestrictionDiff<HttpHeaders<any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
  searchParams?: RestrictionDiff<HttpSearchParams<any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
  body?: RestrictionDiff<unknown>;
}

export interface UnmatchedHttpInterceptorRequestGroup {
  request: HttpInterceptorRequest<string, never>;
  diff: RestrictionDiffs;
}
