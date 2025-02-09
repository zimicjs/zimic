import { HttpMethod, HttpMethodSchema } from '@/http';

import { FetchRequest, FetchResponse } from '../types/requests';

class FetchResponseError<
  Path extends string,
  Method extends HttpMethod,
  MethodSchema extends HttpMethodSchema = HttpMethodSchema,
> extends Error {
  constructor(
    public request: FetchRequest<Path, Method, MethodSchema>,
    public response: FetchResponse<Path, Method, MethodSchema, true>,
  ) {
    super(`${request.method} ${request.url} failed with status ${response.status}: ${response.statusText}`);
    this.name = 'FetchResponseError';
  }
}

export default FetchResponseError;
