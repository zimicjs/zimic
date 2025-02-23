import { HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@zimic/http';

import { FetchRequest, FetchResponse } from '../types/requests';

class FetchResponseError<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
> extends Error {
  constructor(
    public request: FetchRequest<Schema, Method, Path>,
    public response: FetchResponse<Schema, Method, Path, true>,
  ) {
    super(`${request.method} ${request.url} failed with status ${response.status}: ${response.statusText}`);
    this.name = 'FetchResponseError';
  }

  get cause() {
    return this.response;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFetchRequestError = FetchResponseError<any, any, any>;

export default FetchResponseError;
