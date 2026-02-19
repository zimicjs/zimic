import { FetchRequestObject } from '@/client/request/types';

import { FetchResponseObject } from '../types';

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference} */
export interface FetchResponseErrorObjectOptions {
  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference} */
  includeRequestBody?: boolean;
  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference} */
  includeResponseBody?: boolean;
}

export namespace FetchResponseErrorObjectOptions {
  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference} */
  export type WithBody = FetchResponseErrorObjectOptions &
    ({ includeRequestBody: true } | { includeResponseBody: true });

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference} */
  export type WithoutBody = FetchResponseErrorObjectOptions &
    ({ includeRequestBody?: false } | { includeResponseBody?: false });
}

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference} */
export interface FetchResponseErrorObject {
  name: string;
  message: string;
  request: FetchRequestObject;
  response: FetchResponseObject;
}
