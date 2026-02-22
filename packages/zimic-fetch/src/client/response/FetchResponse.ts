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

const FETCH_RESPONSE_EXTRA_PROPERTIES = ['raw', 'request', 'error', 'toObject'] as const;
type FetchResponseExtraProperty = (typeof FETCH_RESPONSE_EXTRA_PROPERTIES)[number];

function createFetchResponseClass() {
  const FetchResponseClass = function FetchResponse<
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

    let error: FetchResponseError<Schema, Method, Path> | null = null;

    function clone() {
      return new FetchResponseClass(fetchRequest, response.clone());
    }

    function toObject(options: { includeBody: true }): Promise<FetchResponseObject>;
    function toObject(options?: { includeBody?: false }): FetchResponseObject;
    function toObject(options?: { includeBody?: boolean }): PossiblePromise<FetchResponseObject>;
    function toObject(options?: { includeBody?: boolean }): PossiblePromise<FetchResponseObject> {
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
    }

    type FetchResponseInstance = FetchResponse<Schema, Method, Path, ErrorOnly, Redirect, StatusCode>;

    const fetchResponse = new Proxy(response, {
      get(target, property, receiver) {
        if (property === FETCH_RESPONSE_BRAND) {
          return true;
        }

        if (property === ('raw' satisfies keyof FetchResponseInstance)) {
          return response satisfies FetchResponseInstance['raw'];
        }

        if (property === ('request' satisfies keyof FetchResponseInstance)) {
          return fetchRequest satisfies FetchResponseInstance['request'];
        }

        if (property === ('error' satisfies keyof FetchResponseInstance)) {
          error ??= new FetchResponseError(fetchRequest, receiver as FetchResponse<Schema, Method, Path>);
          return error satisfies FetchResponseInstance['error'];
        }

        if (property === ('clone' satisfies keyof FetchResponseInstance)) {
          // The `clone` method is not compatible with the mapping we do in `FetchResponse`(i.e.
          // `StatusCode extends StatusCode ? ... : ...`), so we need a type assertion here.
          return clone as FetchResponseInstance['clone'];
        }

        if (property === ('toObject' satisfies keyof FetchResponseInstance)) {
          return toObject satisfies FetchResponseInstance['toObject'];
        }

        // Fallback other properties to the original `Response` instance.
        const value = Reflect.get(target, property, target) as unknown;

        if (typeof value === 'function') {
          return value.bind(target) as unknown;
        }

        return value;
      },

      has(target, property) {
        return (
          property === FETCH_RESPONSE_BRAND ||
          FETCH_RESPONSE_EXTRA_PROPERTIES.includes(property as FetchResponseExtraProperty) ||
          Reflect.has(target, property)
        );
      },
    }) as unknown as FetchResponse<Schema, Method, Path, ErrorOnly, Redirect, StatusCode>;

    return fetchResponse;
  } as unknown as FetchResponseClass;

  Object.defineProperty(FetchResponseClass, Symbol.hasInstance, {
    value(instance: unknown): boolean {
      return (
        instance instanceof Response && FETCH_RESPONSE_BRAND in instance && instance[FETCH_RESPONSE_BRAND] === true
      );
    },
    writable: false,
    enumerable: false,
    configurable: false,
  });

  Object.setPrototypeOf(FetchResponseClass.prototype, Response.prototype);

  return FetchResponseClass;
}

export const FetchResponse = createFetchResponseClass();

Object.setPrototypeOf(FetchResponse.prototype, Response.prototype);
