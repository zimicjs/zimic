import { HttpSchema, HttpSchemaMethod, HttpSchemaPath, HttpHeadersSchema, HttpHeaders } from '@zimic/http';
import { Default, PossiblePromise } from '@zimic/utils/types';

import { FetchRequest } from '../request/FetchRequest';
import { withIncludedBodyIfAvailable } from '../utils/objects';
import FetchResponseError from './error/FetchResponseError';
import {
  FetchResponseBodySchema,
  FetchResponseConstructor,
  FetchResponseInit,
  FetchResponseObject,
  FetchResponsePerStatusCode,
  FetchResponseStatusCode,
} from './types';

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

// FetchResponse is not a proper class to keep backward compatibility. FetchResponse used to be only a type and it is
// not possible to replicate the same behavior with a class without breaking changes. After the next major version,
// FetchResponse will be refactored into a proper class to make the implementation more straightforward.
// @deprecated
export const FetchResponse = (<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
  /** @deprecated The type parameter `ErrorOnly` will be removed in the next major version. */
  ErrorOnly extends boolean = false,
  Redirect extends RequestRedirect = 'follow',
  StatusCode extends FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect> =
    FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect>,
>(
  fetchRequest: FetchRequest<Schema, Method, Path>,
  responseOrBody?:
    | Response
    | FetchResponseBodySchema<Default<Default<Default<Schema[Path][Method]>['response']>[StatusCode]>>,
  init?: FetchResponseInit<Schema, Method, Path, ErrorOnly, Redirect, StatusCode>,
): FetchResponse<Schema, Method, Path, ErrorOnly, Redirect, StatusCode> => {
  const response =
    responseOrBody instanceof Response
      ? responseOrBody
      : new Response(responseOrBody as BodyInit | null, init as ResponseInit);

  const fetchResponse = Object.create(response) as FetchResponse<Schema, Method, Path, ErrorOnly, Redirect, StatusCode>;

  Object.defineProperty(fetchResponse, FETCH_RESPONSE_BRAND, {
    value: true,
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

      return withIncludedBodyIfAvailable(response, responseObject);
    },
    writable: false,
    enumerable: true,
    configurable: false,
  });

  return fetchResponse;
}) as unknown as FetchResponseConstructor;

Object.defineProperty(FetchResponse, Symbol.hasInstance, {
  value(instance: unknown): boolean {
    return instance instanceof Response && FETCH_RESPONSE_BRAND in instance;
  },
  writable: false,
  enumerable: false,
  configurable: false,
});

Object.setPrototypeOf(FetchResponse.prototype, Response.prototype);
