import {
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpResponse,
  HttpResponseBodySchema,
  HttpResponseHeadersSchema,
  HttpStatusCode,
  HttpMethod,
  HttpHeadersSchema,
  HttpHeaders,
} from '@zimic/http';
import { Default, PossiblePromise } from '@zimic/utils/types';

import FetchResponseError from '../errors/FetchResponseError';
import { FetchRequest } from '../request/FetchRequest';
import { withIncludedBodyIfAvailable } from '../utils/objects';
import { FetchResponseObject, FetchResponseStatusCode } from './types';

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response `FetchResponse` API reference} */
export interface FetchResponsePerStatusCode<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
  StatusCode extends HttpStatusCode = HttpStatusCode,
> extends HttpResponse<
  HttpResponseBodySchema<Default<Schema[Path][Method]>, StatusCode>,
  Default<HttpResponseHeadersSchema<Default<Schema[Path][Method]>, StatusCode>>,
  StatusCode
> {
  raw: Response;
  request: FetchRequest<Schema, Method, Path>;
  error: FetchResponseError<Schema, Method, Path>;
  toObject: ((options: { includeBody: true }) => Promise<FetchResponseObject>) &
    ((options?: { includeBody?: false }) => FetchResponseObject) &
    ((options?: { includeBody?: boolean }) => PossiblePromise<FetchResponseObject>);
  clone: () => FetchResponsePerStatusCode<Schema, Method, Path, StatusCode>;
}

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response `FetchResponse` API reference} */
export type FetchResponse<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
  /** @deprecated The type parameter `ErrorOnly` will be removed in the next major version. */
  ErrorOnly extends boolean = false,
  Redirect extends RequestRedirect = 'follow',
  StatusCode extends FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect> =
    FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect>,
> = StatusCode extends StatusCode ? FetchResponsePerStatusCode<Schema, Method, Path, StatusCode> : never;

export namespace FetchResponse {
  /** A loosely typed version of a {@link FetchResponse}. */
  export interface Loose extends Response {
    raw: Response;
    request: FetchRequest.Loose;
    error: FetchResponseError<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    clone: () => Loose;
  }
}

const FETCH_RESPONSE_BRAND = Symbol.for('FetchResponse');

export const FetchResponse = {
  [Symbol.hasInstance](instance: unknown): instance is FetchResponse<HttpSchema, HttpMethod, string> {
    return instance instanceof Response && FETCH_RESPONSE_BRAND in instance;
  },
};

function createFetchResponseObject<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
>(response: FetchResponse<Schema, Method, Path>, options: { includeBody: true }): Promise<FetchResponseObject>;
function createFetchResponseObject<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
>(response: FetchResponse<Schema, Method, Path>, options: { includeBody?: false }): FetchResponseObject;
function createFetchResponseObject<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
>(
  response: FetchResponse<Schema, Method, Path>,
  options?: { includeBody?: boolean },
): PossiblePromise<FetchResponseObject>;
function createFetchResponseObject<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
>(
  response: FetchResponse<Schema, Method, Path>,
  options?: { includeBody?: boolean },
): PossiblePromise<FetchResponseObject> {
  const responseObject: FetchResponseObject = {
    url: response.url,
    type: response.type,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    headers: HttpHeaders.prototype.toObject.call(response.headers) as HttpHeadersSchema,
    redirected: response.redirected,
  };

  if (!options?.includeBody) {
    return responseObject;
  }

  return withIncludedBodyIfAvailable(response.raw, responseObject);
}

export function createFetchResponse<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
>(fetchRequest: FetchRequest<Schema, Method, Path>, response: Response): FetchResponse<Schema, Method, Path> {
  const fetchResponse = response as FetchResponse<Schema, Method, Path>;

  Object.defineProperty(fetchResponse, FETCH_RESPONSE_BRAND, {
    value: undefined,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  Object.defineProperty(fetchResponse, 'raw', {
    value: response,
    writable: false,
    enumerable: true,
    configurable: false,
  });

  Object.defineProperty(fetchResponse, 'request', {
    value: fetchRequest,
    writable: false,
    enumerable: true,
    configurable: false,
  });

  let error: FetchResponseError<Schema, Method, Path> | null = null;

  Object.defineProperty(fetchResponse, 'error', {
    get(this: FetchResponse<Schema, Method, Path>) {
      error ??= new FetchResponseError(this.request, this);
      return error;
    },
    writable: false,
    enumerable: true,
    configurable: false,
  });

  Object.defineProperty(fetchResponse, 'toObject', {
    value(
      this: FetchResponse<Schema, Method, Path>,
      options?: { includeBody?: boolean },
    ): PossiblePromise<FetchResponseObject> {
      return createFetchResponseObject(this, options);
    },
    writable: false,
    enumerable: true,
    configurable: false,
  });

  return fetchResponse;
}
