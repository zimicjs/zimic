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
  constructor(
    public request: FetchRequest<Schema, Method, Path>,
    public response: FetchResponse<Schema, Method, Path>,
  ) {
    super(`${request.method} ${request.url} failed with status ${response.status}: ${response.statusText}`);
    this.name = 'FetchResponseError';
  }

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `response.error.toObject()` API reference} */
  toObject(options: FetchResponseErrorObjectOptions.WithBody): Promise<FetchResponseErrorObject>;
  toObject(options?: FetchResponseErrorObjectOptions.WithoutBody): FetchResponseErrorObject;
  toObject(options?: FetchResponseErrorObjectOptions): PossiblePromise<FetchResponseErrorObject>;
  toObject(options?: FetchResponseErrorObjectOptions): PossiblePromise<FetchResponseErrorObject> {
    const partialObject = {
      name: this.name,
      message: this.message,
    } satisfies Partial<FetchResponseErrorObject>;

    if (!options?.includeRequestBody && !options?.includeResponseBody) {
      return {
        ...partialObject,
        request: this.request.toObject({ includeBody: false }),
        response: this.response.toObject({ includeBody: false }),
      };
    }

    return Promise.all([
      Promise.resolve(this.request.toObject({ includeBody: options.includeRequestBody })),
      Promise.resolve(this.response.toObject({ includeBody: options.includeResponseBody })),
    ]).then(([request, response]) => ({ ...partialObject, request, response }));
  }
}

export default FetchResponseError;
