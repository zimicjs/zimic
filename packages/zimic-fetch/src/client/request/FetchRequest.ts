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
import { withIncludedBodyIfAvailable } from '../utils/objects';
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

function createFetchRequestClass() {
  function FetchRequest<
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

      actualInput = request;
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

    const fetchRequest = Object.create(request) as FetchRequest<
      Schema,
      Method,
      LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>
    >;

    Object.defineProperty(fetchRequest, FETCH_REQUEST_BRAND, {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    Object.defineProperty(fetchRequest, 'raw', {
      value: request,
      writable: false,
      enumerable: false,
      configurable: true,
    });

    const baseURLWithoutTrailingSlash = baseURL.toString().replace(/\/$/, '');
    const path = excludeNonPathParams(url).toString().replace(baseURLWithoutTrailingSlash, '');

    Object.defineProperty(fetchRequest, 'path', {
      value: path,
      writable: false,
      enumerable: false,
      configurable: true,
    });

    Object.defineProperty(fetchRequest, 'method', {
      value: fetchRequest.method,
      writable: false,
      enumerable: false,
      configurable: true,
    });

    Object.defineProperty(fetchRequest, 'clone', {
      value(this: FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>) {
        return FetchRequest(fetch, this);
      },
      writable: false,
      enumerable: false,
      configurable: true,
    });

    Object.defineProperty(fetchRequest, 'toObject', {
      get: (options?: { includeBody?: boolean }): PossiblePromise<FetchRequestObject> => {
        const requestObject: FetchRequestObject = {
          url: fetchRequest.url,
          path: fetchRequest.path,
          method: fetchRequest.method,
          headers: HttpHeaders.prototype.toObject.call(fetchRequest.headers) as HttpHeadersSchema,
          cache: fetchRequest.cache,
          destination: fetchRequest.destination,
          credentials: fetchRequest.credentials,
          integrity: fetchRequest.integrity,
          keepalive: fetchRequest.keepalive,
          mode: fetchRequest.mode,
          redirect: fetchRequest.redirect,
          referrer: fetchRequest.referrer,
          referrerPolicy: fetchRequest.referrerPolicy,
        };

        if (!options?.includeBody) {
          return requestObject;
        }

        return withIncludedBodyIfAvailable(request, requestObject);
      },
      writable: false,
      enumerable: false,
      configurable: true,
    });

    return fetchRequest;
  }

  Object.defineProperty(FetchRequest, Symbol.hasInstance, {
    value(instance: unknown): boolean {
      return instance instanceof Request && FETCH_REQUEST_BRAND in instance;
    },
    writable: false,
    enumerable: false,
    configurable: false,
  });

  Object.setPrototypeOf(FetchRequest.prototype, Request.prototype);

  return FetchRequest as unknown as FetchRequestClass;
}

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-request `FetchRequest` API reference} */
export const FetchRequest = createFetchRequestClass();
