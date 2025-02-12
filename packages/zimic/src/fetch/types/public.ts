import { HttpSchema, HttpSchemaPath, HttpSchemaMethod } from '@/http';
import { LiteralHttpSchemaPathFromNonLiteral } from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';

import FetchResponseError from '../errors/FetchResponseError';
import { FetchRequest, FetchRequestInit, FetchResponse } from './requests';

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

export type FetchFunction<Schema extends HttpSchema> = <
  Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
>(
  input: FetchInput<Schema, Path, Method>,
  init?: FetchRequestInit<Schema, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Method>,
) => Promise<
  FetchResponse<
    LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>,
    Method,
    Default<Schema[LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>][Method]>
  >
>;

export interface FetchClientOptions<Schema extends HttpSchema> extends FetchRequestInit.Defaults {
  onRequest?: (this: FetchClient<Schema>, request: FetchRequest.Loose) => PossiblePromise<FetchRequest.Loose>;

  onResponse?: (this: FetchClient<Schema>, response: FetchResponse.Loose) => PossiblePromise<FetchResponse.Loose>;
}

export type FetchRequestConstructor<Schema extends HttpSchema> = new <
  Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
>(
  input: FetchInput<Schema, Path, Method>,
  init?: FetchRequestInit<Schema, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Method>,
) => FetchRequest<
  LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>,
  Method,
  Default<Schema[LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>][Method]>
>;

export interface FetchClient<Schema extends HttpSchema> {
  defaults: FetchRequestInit.Defaults;

  Request: FetchRequestConstructor<Schema>;

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
