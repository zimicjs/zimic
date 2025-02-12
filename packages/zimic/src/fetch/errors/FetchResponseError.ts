import { HttpMethod, HttpMethodSchema } from '@/http';

import { FetchRequest, FetchResponse } from '../types/requests';

class FetchResponseError<
  Path extends string = string,
  Method extends HttpMethod = HttpMethod,
  MethodSchema extends HttpMethodSchema = HttpMethodSchema,
> extends Error {
  constructor(
    public request: FetchRequest<Path, Method, MethodSchema>,
    public response: FetchResponse<Path, Method, MethodSchema, true>,
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
