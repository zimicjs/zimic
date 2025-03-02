import { HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@zimic/http';

import { FetchRequest, FetchResponse } from '../types/requests';

/**
 * An error representing a response with a failure status code (4XX or 5XX).
 *
 * @example
 *   import { type HttpSchema } from '@zimic/http';
 *   import { createFetch } from '@zimic/fetch';
 *
 *   interface User {
 *     id: string;
 *     username: string;
 *   }
 *
 *   type Schema = HttpSchema<{
 *     '/users/:userId': {
 *       GET: {
 *         response: {
 *           200: { body: User };
 *           404: { body: { message: string } };
 *         };
 *       };
 *     };
 *   }>;
 *
 *   const fetch = createFetch<Schema>({
 *     baseURL: 'http://localhost:3000',
 *   });
 *
 *   const response = await fetch(`/users/${userId}`, {
 *     method: 'GET',
 *   });
 *
 *   if (!response.ok) {
 *     console.log(response.status); // 404
 *
 *     console.log(response.error); // FetchResponseError<Schema, 'GET', '/users'>
 *     console.log(response.error.request); // FetchRequest<Schema, 'GET', '/users'>
 *     console.log(response.error.response); // FetchResponse<Schema, 'GET', '/users'>
 *   }
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchresponseerror `FetchResponseError` API reference}
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
