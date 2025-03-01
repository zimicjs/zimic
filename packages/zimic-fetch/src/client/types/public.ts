import { HttpSchemaPath, HttpSchemaMethod, LiteralHttpSchemaPathFromNonLiteral, HttpSchema } from '@zimic/http';
import { PossiblePromise, RequiredByKey } from '@zimic/utils/types';

import FetchResponseError from '../errors/FetchResponseError';
import { FetchRequest, FetchRequestConstructor, FetchRequestInit, FetchResponse } from './requests';

export type FetchInput<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
> = Path | URL | FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>;

interface FetchFunction<Schema extends HttpSchema> {
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
    init?: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Redirect>,
  ): Promise<FetchResponse<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, false, Redirect>>;
}

export interface FetchOptions<Schema extends HttpSchema> extends Omit<FetchRequestInit.Defaults, 'method'> {
  onRequest?: (this: Fetch<Schema>, request: FetchRequest.Loose) => PossiblePromise<Request>;
  onResponse?: (this: Fetch<Schema>, response: FetchResponse.Loose) => PossiblePromise<Response>;
}

export type FetchDefaults = RequiredByKey<FetchRequestInit.Defaults, 'headers' | 'searchParams'>;

export interface FetchClient<Schema extends HttpSchema> extends Pick<FetchOptions<Schema>, 'onRequest' | 'onResponse'> {
  defaults: FetchDefaults;

  Request: FetchRequestConstructor<Schema>;

  isRequest: <Method extends HttpSchemaMethod<Schema>, Path extends HttpSchemaPath.Literal<Schema, Method>>(
    request: unknown,
    method: Method,
    path: Path,
  ) => request is FetchRequest<Schema, Method, Path>;

  isResponse: <Method extends HttpSchemaMethod<Schema>, Path extends HttpSchemaPath.Literal<Schema, Method>>(
    response: unknown,
    method: Method,
    path: Path,
  ) => response is FetchResponse<Schema, Method, Path>;

  isResponseError: <Method extends HttpSchemaMethod<Schema>, Path extends HttpSchemaPath.Literal<Schema, Method>>(
    error: unknown,
    method: Method,
    path: Path,
  ) => error is FetchResponseError<Schema, Method, Path>;
}

export type Fetch<Schema extends HttpSchema> = FetchFunction<Schema> & FetchClient<Schema>;

export type InferFetchSchema<FetchInstance> = FetchInstance extends Fetch<infer Schema> ? Schema : never;
