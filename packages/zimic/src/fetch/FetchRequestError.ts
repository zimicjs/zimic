import { HttpMethodSchema } from '@/http';

import { FetchRequest, FetchResponse } from './FetchClient';

class FetchRequestError<MethodSchema extends HttpMethodSchema = HttpMethodSchema> extends Error {
  constructor(
    readonly request: FetchRequest<MethodSchema>,
    readonly response: FetchResponse<MethodSchema, boolean>,
  ) {
    super(`${request.method} ${request.url} failed with status ${response.status}: ${response.statusText}`);
    this.name = 'FetchRequestError';
    this.cause = response;
  }
}

export default FetchRequestError;
