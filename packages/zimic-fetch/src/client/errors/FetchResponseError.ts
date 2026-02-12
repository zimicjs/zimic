import { HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';

import { FetchRequestObject } from '@/index';

import { FetchRequest } from '../request/FetchRequest';
import { FetchResponse } from '../response/FetchResponse';
import { FetchResponseObject } from '../response/types';

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference} */
export interface FetchResponseErrorObjectOptions {
  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference} */
  includeRequestBody?: boolean;
  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference} */
  includeResponseBody?: boolean;
}

export namespace FetchResponseErrorObjectOptions {
  /**
   * Options for converting a {@link FetchResponseError `FetchResponseError`} into a plain object, including the body of
   * the request and/or response.
   */
  export type WithBody = FetchResponseErrorObjectOptions &
    ({ includeRequestBody: true } | { includeResponseBody: true });

  /**
   * Options for converting a {@link FetchResponseError `FetchResponseError`} into a plain object, excluding the body of
   * the request and/or response.
   */
  export type WithoutBody = FetchResponseErrorObjectOptions &
    ({ includeRequestBody?: false } | { includeResponseBody?: false });
}

/**
 * A plain object representation of a {@link FetchResponseError `FetchResponseError`}, compatible with JSON. It is useful
 * for serialization, debugging, and logging purposes.
 *
 * @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference}
 */
export interface FetchResponseErrorObject {
  name: string;
  message: string;
  request: FetchRequestObject;
  response: FetchResponseObject;
}

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error `FetchResponseError` API reference} */
class FetchResponseError<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
> extends Error {
  constructor(
    public request: FetchRequest<Schema, Method, Path>,
    public response: FetchResponse<Schema, Method, Path, false, RequestRedirect, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    super(`${request.method} ${request.url} failed with status ${response.status}: ${response.statusText}`);
    this.name = 'FetchResponseError';
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
