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

/**
 * A static headers restriction to match intercepted requests.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference}
 */
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

/**
 * A static search params restriction to match intercepted requests.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference}
 */
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
        : DeepPartial<Body>;

/**
 * A static body restriction to match intercepted requests.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference}
 */
export type HttpRequestHandlerBodyStaticRestriction<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> = PartialBodyOrSchema<HttpRequestBodySchema<Default<Schema[Path][Method]>>>;

/**
 * A static restriction to match intercepted requests.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference}
 */
export interface HttpRequestHandlerStaticRestriction<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> {
  /**
   * A set of headers that the intercepted request must contain to match the handler. If exact is `true`, the request
   * must contain exactly these headers and no others.
   */
  headers?: HttpRequestHandlerHeadersStaticRestriction<Schema, Method, Path>;

  /**
   * A set of search params that the intercepted request must contain to match the handler. If exact is `true`, the
   * request must contain exactly these search params and no others.
   */
  searchParams?: HttpRequestHandlerSearchParamsStaticRestriction<Schema, Method, Path>;

  /**
   * The body that the intercepted request must contain to match the handler. If exact is `true`, the request must
   * contain exactly this body and no other.
   */
  body?: HttpRequestHandlerBodyStaticRestriction<Schema, Method, Path>;

  /**
   * If `true`, the request must contain **exactly** the headers, search params, and body declared in this restriction.
   * Otherwise, the request must contain **at least** them.
   */
  exact?: boolean;
}

/**
 * A computed restriction to match intercepted requests.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference}
 */
export type HttpRequestHandlerComputedRestriction<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> = (request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>) => PossiblePromise<boolean>;

/**
 * A restriction to match intercepted requests.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference}
 */
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

export type RestrictionMatchResult<Value> = { value: true; diff?: undefined } | { value: false; diff: Value };

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
