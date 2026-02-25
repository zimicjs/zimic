import {
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpRequest,
  HttpRequestBodySchema,
  HttpRequestHeadersSchema,
  HttpHeaders,
  HttpSearchParams,
  HttpMethod,
  AllowAnyStringInPathParams,
  LiteralHttpSchemaPathFromNonLiteral,
  HttpHeadersInit,
  HttpSearchParamsInit,
  HttpHeadersSchema,
} from '@zimic/http';
import { Default, PossiblePromise } from '@zimic/utils/types';
import { excludeNonPathParams, joinURL } from '@zimic/utils/url';

import { Fetch, FetchInput } from '../types/public';
import { getOrSetBoundBodyMethod, isBodyMethod, withIncludedBodyIfAvailable } from '../utils/objects';
import { FetchRequestBodySchema, FetchRequestInit, FetchRequestObject } from './types';

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-request `FetchRequest` API reference} */
export interface FetchRequest<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
> extends HttpRequest<
  HttpRequestBodySchema<Default<Schema[Path][Method]>>,
  Default<HttpRequestHeadersSchema<Default<Schema[Path][Method]>>>
> {
  raw: Request;
  path: AllowAnyStringInPathParams<Path>;
  method: Method;
  clone: () => FetchRequest<Schema, Method, Path>;
  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-request#toObject `request.toObject()` API reference} */
  toObject: ((options: { includeBody: true }) => Promise<FetchRequestObject>) &
    ((options?: { includeBody?: false }) => FetchRequestObject) &
    ((options?: { includeBody?: boolean }) => PossiblePromise<FetchRequestObject>);
}

export namespace FetchRequest {
  /** A loosely typed version of a {@link FetchRequest `FetchRequest`}. */
  export interface Loose extends Request {
    raw: Request;
    path: string;
    method: HttpMethod;
    clone: () => Loose;
    /** @see {@link https://zimic.dev/docs/fetch/api/fetch-request#toObject `request.toObject()` API reference} */
    toObject: ((options: { includeBody: true }) => Promise<FetchRequestObject>) &
      ((options?: { includeBody?: false }) => FetchRequestObject);
  }
}

interface FetchRequestClass {
  new <
    Schema extends HttpSchema,
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
  >(
    fetch: Fetch<Schema>,
    input: FetchInput<Schema, Method, Path>,
    init?: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
  ): FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>;

  prototype: Request;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [Symbol.hasInstance]: (instance: unknown) => instance is FetchRequest<any, any, any>;
}

const FETCH_REQUEST_BRAND = Symbol.for('FetchRequest');

const FETCH_REQUEST_EXTRA_PROPERTIES = [FETCH_REQUEST_BRAND, 'raw', 'path', 'toObject'] as const;
type FetchRequestExtraProperty = (typeof FETCH_REQUEST_EXTRA_PROPERTIES)[number];

function createFetchRequestClass() {
  const FetchRequestClass = function FetchRequest<
    Schema extends HttpSchema,
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
  >(
    fetch: Fetch<Schema>,
    input: FetchInput<Schema, Method, Path>,
    init?: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>> & {
      headers?: HttpHeadersInit<Default<Schema[Path][Method]>>;
      searchParams?: HttpSearchParamsInit<Default<Schema[Path][Method]>>;
      body?: FetchRequestBodySchema<Default<Default<Schema[Path][Method]>['request']>>;
    },
  ) {
    let actualInput: URL | Request;

    const actualInit = {
      baseURL: init?.baseURL ?? fetch.baseURL,
      method: init?.method ?? fetch.method,
      headers: new HttpHeaders(fetch.headers),
      searchParams: new HttpSearchParams(fetch.searchParams),
      body: (init?.body ?? fetch.body) as BodyInit | null,
      mode: init?.mode ?? fetch.mode,
      cache: init?.cache ?? fetch.cache,
      credentials: init?.credentials ?? fetch.credentials,
      integrity: init?.integrity ?? fetch.integrity,
      keepalive: init?.keepalive ?? fetch.keepalive,
      priority: init?.priority ?? fetch.priority,
      redirect: init?.redirect ?? fetch.redirect,
      referrer: init?.referrer ?? fetch.referrer,
      referrerPolicy: init?.referrerPolicy ?? fetch.referrerPolicy,
      signal: init?.signal ?? fetch.signal,
      window: init?.window === undefined ? fetch.window : init.window,
      duplex: init?.duplex ?? fetch.duplex,
    };

    if (init?.headers !== undefined) {
      actualInit.headers.assign(new HttpHeaders(init.headers));
    }

    let url: URL;
    const baseURL = new URL(actualInit.baseURL);

    if (input instanceof Request) {
      const request = input as Request;

      actualInit.headers.assign(new HttpHeaders<FetchRequestInit.DefaultHeaders<Schema>>(request.headers));

      url = new URL(input.url);

      actualInput = request instanceof FetchRequestClass ? request.raw : request;
    } else {
      url = new URL(input instanceof URL ? input : joinURL(baseURL, input));

      actualInit.searchParams.assign(
        new HttpSearchParams<FetchRequestInit.DefaultSearchParams<Schema>>(url.searchParams),
      );

      if (init?.searchParams !== undefined) {
        actualInit.searchParams.assign(new HttpSearchParams(init.searchParams));
      }

      url.search = actualInit.searchParams.toString();

      actualInput = url;
    }

    const request = new Request(actualInput, actualInit);

    const baseURLWithoutTrailingSlash = baseURL.toString().replace(/\/$/, '');
    const path = excludeNonPathParams(url).toString().replace(baseURLWithoutTrailingSlash, '');

    function clone() {
      return new FetchRequestClass(fetch, request.clone() as FetchInput<Schema, Method, Path>);
    }

    function toObject(options: { includeBody: true }): Promise<FetchRequestObject>;
    function toObject(options?: { includeBody?: false }): FetchRequestObject;
    function toObject(options?: { includeBody?: boolean }): PossiblePromise<FetchRequestObject>;
    function toObject(options?: { includeBody?: boolean }): PossiblePromise<FetchRequestObject> {
      const requestObject: FetchRequestObject = {
        url: request.url,
        path,
        method: request.method as HttpMethod,
        headers: HttpHeaders.prototype.toObject.call(request.headers) as HttpHeadersSchema,
        cache: request.cache,
        destination: request.destination,
        credentials: request.credentials,
        integrity: request.integrity,
        keepalive: request.keepalive,
        mode: request.mode,
        redirect: request.redirect,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
      };

      if (!options?.includeBody) {
        return requestObject;
      }

      return withIncludedBodyIfAvailable(request, requestObject);
    }

    type FetchRequestInstance = FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>;

    const fetchRequest = new Proxy(request, {
      get(target, property) {
        if (property === FETCH_REQUEST_BRAND) {
          return true;
        }

        if (property === ('raw' satisfies keyof FetchRequestInstance)) {
          return request satisfies FetchRequestInstance['raw'];
        }

        if (property === ('path' satisfies keyof FetchRequestInstance)) {
          return path as AllowAnyStringInPathParams<
            LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>
          > satisfies FetchRequestInstance['path'];
        }

        if (property === ('clone' satisfies keyof FetchRequestInstance)) {
          return clone satisfies FetchRequestInstance['clone'];
        }

        if (property === ('toObject' satisfies keyof FetchRequestInstance)) {
          return toObject satisfies FetchRequestInstance['toObject'];
        }

        // Fallback other properties to the original `Request` instance.
        const value = Reflect.get(target, property, target) as unknown;

        if (isBodyMethod(property, value)) {
          return getOrSetBoundBodyMethod(request, property, value);
        }

        return value;
      },

      has(target, property) {
        return (
          FETCH_REQUEST_EXTRA_PROPERTIES.includes(property as FetchRequestExtraProperty) ||
          Reflect.has(target, property)
        );
      },
    }) as unknown as FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>;

    return fetchRequest;
  } as unknown as FetchRequestClass;

  Object.defineProperty(FetchRequestClass, Symbol.hasInstance, {
    value(instance: unknown): boolean {
      return instance instanceof Request && FETCH_REQUEST_BRAND in instance;
    },
    writable: false,
    enumerable: false,
    configurable: false,
  });

  Object.setPrototypeOf(FetchRequestClass.prototype, Request.prototype);

  return FetchRequestClass;
}

export const FetchRequest = createFetchRequestClass();
