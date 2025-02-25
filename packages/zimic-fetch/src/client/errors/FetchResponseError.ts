import { HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@zimic/http';

import { FetchRequest, FetchResponse } from '../types/requests';

/**
 * An error that is thrown when a fetch request fails with a failure status code (4XX or 5XX).
 *
 * @example
 *   import { type HttpSchema } from '@zimic/http';
 *   import { createFetch } from '@zimic/fetch';
 *
 *   type MySchema = HttpSchema<{
 *     // ...
 *   }>;
 *
 *   const fetch = createFetch<MySchema>({
 *     baseURL: 'http://localhost:3000',
 *   });
 *
 *   await fetch('/users', {
 *     method: 'GET',
 *     searchParams: { username: 'my', limit: '10' },
 *   });
 *
 *   if (!response.ok) {
 *     console.log(response.error.request); // FetchRequest<MySchema, 'GET', '/users'>
 *     console.log(response.error.response); // FetchResponse<MySchema, 'GET', '/users'>
 *   }
 */
class FetchResponseError<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
> extends Error {
  constructor(
    public request: FetchRequest<Schema, Method, Path>,
    public response: FetchResponse<Schema, Method, Path, true, 'manual'>,
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
