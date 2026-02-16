import { HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';

import { FetchRequest } from '../../request/FetchRequest';
import { FetchResponse } from '../FetchResponse';
import { FetchResponseErrorObjectOptions, FetchResponseErrorObject } from './types';

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error `FetchResponseError` API reference} */
class FetchResponseError<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
> extends Error {
  #request: FetchRequest<Schema, Method, Path>;
  #response: FetchResponse<Schema, Method, Path>;

  constructor(request: FetchRequest<Schema, Method, Path>, response: FetchResponse<Schema, Method, Path>) {
    super(`${request.method} ${request.url} failed with status ${response.status}: ${response.statusText}`);
    this.#request = request;
    this.#response = response;
    this.name = 'FetchResponseError';
  }

  get request() {
    return this.#request;
  }

  get response() {
    return this.#response;
  }

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference} */
  toObject(options: FetchResponseErrorObjectOptions.WithBody): Promise<FetchResponseErrorObject>;
  toObject(options?: FetchResponseErrorObjectOptions.WithoutBody): FetchResponseErrorObject;
  toObject(options?: FetchResponseErrorObjectOptions): PossiblePromise<FetchResponseErrorObject>;
  toObject({
    includeRequestBody = false,
    includeResponseBody = false,
  }: FetchResponseErrorObjectOptions = {}): PossiblePromise<FetchResponseErrorObject> {
    const partialObject = {
      name: this.name,
      message: this.message,
    } satisfies Partial<FetchResponseErrorObject>;

    if (!includeRequestBody && !includeResponseBody) {
      return {
        ...partialObject,
        request: this.request.toObject({ includeBody: false }),
        response: this.response.toObject({ includeBody: false }),
      };
    }

    return Promise.all([
      Promise.resolve(this.request.toObject({ includeBody: includeRequestBody })),
      Promise.resolve(this.response.toObject({ includeBody: includeResponseBody })),
    ]).then(([request, response]) => ({ ...partialObject, request, response }));
  }
}

export default FetchResponseError;
