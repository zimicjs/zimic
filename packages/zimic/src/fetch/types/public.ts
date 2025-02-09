import { HttpSchema, HttpSchemaPath, HttpSchemaMethod } from '@/http';
import { Default } from '@/types/utils';

import FetchRequestError from '../FetchRequestError';
import { FetchRequest, FetchRequestInit, FetchResponse } from './requests';

export type FetchInput<
  Schema extends HttpSchema,
  Path extends HttpSchemaPath<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
> = Path | FetchRequest<Default<Schema[Path][Method]>>;

type Fetch<Schema extends HttpSchema> = <
  Path extends HttpSchemaPath<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
>(
  input: FetchInput<Schema, Path, Method>,
  init?: FetchRequestInit<Schema, Path, Method>,
) => Promise<FetchResponse<Default<Schema[Path][Method]>>>;

export interface FetchClientOptions {
  baseURL: string;
}

export interface FetchClient<Schema extends HttpSchema> {
  baseURL: () => string;

  setBaseURL: (baseURL: string) => void;

  fetch: Fetch<Schema>;

  Request: new <Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    input: FetchInput<Schema, Path, Method>,
    init?: FetchRequestInit<Schema, Path, Method>,
  ) => FetchRequest<Default<Schema[Path][Method]>>;

  isRequestError: <Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    error: unknown,
    path: Path,
    method: Method,
  ) => error is FetchRequestError<Default<Schema[Path][Method]>>;
}
