import {
  HttpHeaders,
  HttpHeadersSchema,
  HttpResponse,
  HttpResponseBodySchema,
  HttpResponseHeadersSchema,
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpStatusCode,
} from '@zimic/http';
import { Default, PossiblePromise } from '@zimic/utils/types';

import { FetchRequest } from '../request/FetchRequest';
import { withIncludedBodyIfAvailable } from '../utils/objects';
import FetchResponseError from './error/FetchResponseError';
import { FetchResponseBodySchema, FetchResponseInit, FetchResponseObject, FetchResponseStatusCode } from './types';

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
  clone: () => FetchResponsePerStatusCode<Schema, Method, Path, StatusCode>;
  toObject: ((options: { includeBody: true }) => Promise<FetchResponseObject>) &
    ((options?: { includeBody?: false }) => FetchResponseObject) &
    ((options?: { includeBody?: boolean }) => PossiblePromise<FetchResponseObject>);
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
    toObject: ((options: { includeBody: true }) => Promise<FetchResponseObject>) &
      ((options?: { includeBody?: false }) => FetchResponseObject);
  }
}

interface FetchResponseClass {
  new <
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
    response?: Response,
  ): FetchResponse<Schema, Method, Path, ErrorOnly, Redirect, StatusCode>;
  new <
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
    body?: FetchResponseBodySchema<Default<Default<Default<Schema[Path][Method]>['response']>[StatusCode]>>,
    init?: FetchResponseInit<Schema, Method, Path, ErrorOnly, Redirect, StatusCode>,
  ): FetchResponse<Schema, Method, Path, ErrorOnly, Redirect, StatusCode>;

  prototype: Response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [Symbol.hasInstance]: (instance: unknown) => instance is FetchResponse<any, any, any, any, any, any>;
}

const FETCH_RESPONSE_BRAND = Symbol.for('FetchResponse');

function createFetchResponseClass() {
  function FetchResponse<
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
  ): FetchResponse<Schema, Method, Path, ErrorOnly, Redirect, StatusCode> {
    const response =
      responseOrBody instanceof Response
        ? responseOrBody
        : new Response(responseOrBody as BodyInit | null, init as ResponseInit);

    const fetchResponse = Object.create(response) as FetchResponse<
      Schema,
      Method,
      Path,
      ErrorOnly,
      Redirect,
      StatusCode
    >;

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

    Object.defineProperty(fetchResponse, 'clone', {
      value(this: FetchResponse<Schema, Method, Path>) {
        return FetchResponse(this.request, this.raw.clone());
      },
      writable: false,
      enumerable: false,
      configurable: true,
    });

    Object.defineProperty(fetchResponse, 'clone', {
      value(this: FetchResponse<Schema, Method, Path>) {
        return FetchResponse(this.request, this.raw.clone());
      },
      writable: false,
      enumerable: false,
      configurable: true,
    });

    Object.defineProperty(fetchRequest, 'toObject', {
      get: (options?: { includeBody?: boolean }): PossiblePromise<FetchResponseObject> => {
        const responseObject: FetchResponseObject = {
          url: fetchResponse.url,
          type: fetchResponse.type,
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          ok: fetchResponse.ok,
          headers: HttpHeaders.prototype.toObject.call(fetchResponse.headers) as HttpHeadersSchema,
          redirected: fetchResponse.redirected,
        };

        if (!options?.includeBody) {
          return responseObject;
        }

        return withIncludedBodyIfAvailable(response, responseObject);
      },
      writable: false,
      enumerable: false,
      configurable: true,
    });

    return fetchResponse;
  }

  Object.defineProperty(FetchResponse, Symbol.hasInstance, {
    value(instance: unknown): boolean {
      return instance instanceof Response && FETCH_RESPONSE_BRAND in instance;
    },
    writable: false,
    enumerable: false,
    configurable: false,
  });

  Object.setPrototypeOf(FetchResponse.prototype, Response.prototype);

  return FetchResponse as unknown as FetchResponseClass;
}

export const FetchResponse = createFetchResponseClass();

Object.setPrototypeOf(FetchResponse.prototype, Response.prototype);
