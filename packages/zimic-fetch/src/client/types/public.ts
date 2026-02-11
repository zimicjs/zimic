import { HttpSchemaPath, HttpSchemaMethod, LiteralHttpSchemaPathFromNonLiteral, HttpSchema } from '@zimic/http';
import { PossiblePromise, RequiredByKey } from '@zimic/utils/types';

import FetchResponseError from '../errors/FetchResponseError';
import { FetchRequest, FetchRequestConstructor } from '../FetchRequest';
import { FetchRequestInit, FetchResponse } from './requests';

/** @see {@link  https://zimic.dev/docs/fetch/api/fetch `fetch` API reference} */
export type FetchInput<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method> | HttpSchemaPath.NonLiteral<Schema, Method>,
> = Path | URL | FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>;

/** @see {@link https://zimic.dev/docs/fetch/api/fetch `fetch` API reference} */
export interface Fetch<Schema extends HttpSchema>
  extends Pick<FetchOptions<Schema>, 'onRequest' | 'onResponse'>, FetchDefaults<Schema> {
  <
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
    Redirect extends RequestRedirect = 'follow',
  >(
    input: Path | URL,
    init: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Redirect>,
  ): Promise<FetchResponse<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, false, Redirect>>;

  <
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
    Redirect extends RequestRedirect = 'follow',
  >(
    input: FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
    init?: Omit<
      FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Redirect>,
      'baseURL' | 'searchParams'
    >,
  ): Promise<FetchResponse<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, false, Redirect>>;

  /**
   * @deprecated Consider accessing the default options directly from the fetch instance.
   * @see {@link https://zimic.dev/docs/fetch/api/fetch#fetch-defaults `fetch` defaults}
   */
  defaults: FetchDefaults<Schema>;

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch#fetchloose `fetch.loose`} */
  loose: Fetch.Loose;

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch#fetchrequest `fetch.Request`} */
  Request: FetchRequestConstructor<Schema>;

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch#fetchisrequest `fetch.isRequest`} */
  isRequest: <Method extends HttpSchemaMethod<Schema>, Path extends HttpSchemaPath.Literal<Schema, Method>>(
    request: unknown,
    method: Method,
    path: Path,
  ) => request is FetchRequest<Schema, Method, Path>;

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch#fetchisresponse `fetch.isResponse`} */
  isResponse: <Method extends HttpSchemaMethod<Schema>, Path extends HttpSchemaPath.Literal<Schema, Method>>(
    response: unknown,
    method: Method,
    path: Path,
  ) => response is FetchResponse<Schema, Method, Path>;

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch#fetchisresponseerror `fetch.isResponseError`} */
  isResponseError: <Method extends HttpSchemaMethod<Schema>, Path extends HttpSchemaPath.Literal<Schema, Method>>(
    error: unknown,
    method: Method,
    path: Path,
  ) => error is FetchResponseError<Schema, Method, Path>;
}

export namespace Fetch {
  /** A loosely-typed version of {@link Fetch `fetch`}. This can be useful to make requests with fewer type constraints, */
  export type Loose = (
    input: string | URL | FetchRequest.Loose,
    init?: FetchRequestInit.Loose,
  ) => Promise<FetchResponse.Loose>;
}

/** @see {@link https://zimic.dev/docs/fetch/api/create-fetch `createFetch` API reference} */
export interface FetchOptions<Schema extends HttpSchema> extends Omit<FetchRequestInit.Defaults<Schema>, 'method'> {
  /** @see {@link https://zimic.dev/docs/fetch/api/create-fetch#onrequest `createFetch.onRequest`} API reference */
  onRequest?: (this: Fetch<Schema>, request: FetchRequest.Loose) => PossiblePromise<Request>;

  /** @see {@link https://zimic.dev/docs/fetch/api/create-fetch#onresponse `createFetch.onResponse`} API reference */
  onResponse?: (this: Fetch<Schema>, response: FetchResponse.Loose) => PossiblePromise<Response>;
}

/**
 * The default options to send with each request.
 *
 * @see {@link https://zimic.dev/docs/fetch/api/fetch `fetch` API reference}
 */
export type FetchDefaults<Schema extends HttpSchema = HttpSchema> = RequiredByKey<
  FetchRequestInit.Defaults<Schema>,
  'headers' | 'searchParams'
>;

/**
 * Infers the schema of a {@link https://zimic.dev/docs/fetch/api/fetch fetch instance}.
 *
 * @example
 *   import { type HttpSchema } from '@zimic/http';
 *   import { createFetch, InferFetchSchema } from '@zimic/fetch';
 *
 *   const fetch = createFetch<{
 *     '/users': {
 *       GET: {
 *         response: { 200: { body: User[] } };
 *       };
 *     };
 *   }>({
 *     baseURL: 'http://localhost:3000',
 *   });
 *
 *   type Schema = InferFetchSchema<typeof fetch>;
 *   // {
 *   //   '/users': {
 *   //     GET: {
 *   //      response: { 200: { body: User[] } };
 *   //    };
 *   // };
 *
 * @see {@link https://zimic.dev/docs/fetch/api/fetch `fetch` API reference}
 */
export type InferFetchSchema<FetchInstance> = FetchInstance extends Fetch<infer Schema> ? Schema : never;
