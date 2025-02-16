import { HttpSchema, HttpSchemaPath, HttpSchemaMethod } from '@/http';
import { LiteralHttpSchemaPathFromNonLiteral } from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';

import FetchResponseError from '../errors/FetchResponseError';
import { FetchRequest, FetchRequestConstructor, FetchRequestInit, FetchResponse } from './requests';

export type FetchInput<
  Schema extends HttpSchema,
  Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
> =
  | Path
  | URL
  | FetchRequest<
      LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>,
      Method,
      Default<Schema[LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>][Method]>
    >;

export interface FetchFunction<Schema extends HttpSchema> {
  <Path extends HttpSchemaPath.NonLiteral<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    input: Path | URL,
    init: FetchRequestInit<Schema, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Method>,
  ): Promise<
    FetchResponse<
      LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>,
      Method,
      Default<Schema[LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>][Method]>
    >
  >;

  <Path extends HttpSchemaPath.NonLiteral<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    input: FetchRequest<
      LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>,
      Method,
      Default<Schema[LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>][Method]>
    >,
    init?: FetchRequestInit<Schema, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Method>,
  ): Promise<
    FetchResponse<
      LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>,
      Method,
      Default<Schema[LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>][Method]>
    >
  >;
}

export interface FetchOptions<Schema extends HttpSchema> extends Omit<FetchRequestInit.Defaults, 'method'> {
  onRequest?: (request: FetchRequest.Loose, fetch: Fetch<Schema>) => PossiblePromise<Request>;
  onResponse?: (response: FetchResponse.Loose, fetch: Fetch<Schema>) => PossiblePromise<Response>;
}

export interface FetchClient<Schema extends HttpSchema> {
  defaults: FetchRequestInit.Defaults;

  Request: FetchRequestConstructor<Schema>;

  onRequest?: FetchOptions<Schema>['onRequest'];
  onResponse?: FetchOptions<Schema>['onResponse'];

  isRequest: <Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    request: unknown,
    path: Path,
    method: Method,
  ) => request is FetchRequest<Path, Method, Default<Schema[Path][Method]>>;

  isResponse: <Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    response: unknown,
    path: Path,
    method: Method,
  ) => response is FetchResponse<Path, Method, Default<Schema[Path][Method]>>;

  isResponseError: <Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    error: unknown,
    path: Path,
    method: Method,
  ) => error is FetchResponseError<Path, Method, Default<Schema[Path][Method]>>;
}

export type Fetch<Schema extends HttpSchema> = FetchFunction<Schema> & FetchClient<Schema>;

export type InferFetchSchema<FetchInstance> = FetchInstance extends Fetch<infer Schema> ? Schema : never;
