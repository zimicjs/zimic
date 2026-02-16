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
  HttpHeadersSchema,
  LiteralHttpSchemaPathFromNonLiteral,
} from '@zimic/http';
import { Default, PossiblePromise } from '@zimic/utils/types';
import { excludeNonPathParams, joinURL } from '@zimic/utils/url';

import { Fetch, FetchInput } from '../types/public';
import { withIncludedBodyIfAvailable } from '../utils/objects';
import { FetchRequestConstructor, FetchRequestInit, FetchRequestObject } from './types';

export namespace FetchRequest {
  /** A loosely typed version of a {@link FetchRequest `FetchRequest`}. */
  export interface Loose extends Request {
    raw: Request;
    path: string;
    method: HttpMethod;
    clone: () => Loose;
  }
}

type BaseFetchRequest<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> = HttpRequest<
  HttpRequestBodySchema<Default<Schema[Path][Method]>>,
  Default<HttpRequestHeadersSchema<Default<Schema[Path][Method]>>>
>;

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-request `FetchRequest` API reference} */
export class FetchRequest<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> implements BaseFetchRequest<Schema, Method, Path> {
  #raw: Request;
  #fetch: Fetch<Schema>;
  #path: AllowAnyStringInPathParams<Path>;
  #method: Method;

  constructor(fetch: Fetch<Schema>, input: FetchInput<Schema, Method, Path>, init?: FetchRequestInit.Loose) {
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

    if (init?.headers) {
      actualInit.headers.assign(new HttpHeaders(init.headers));
    }

    let url: URL;
    const baseURL = new URL(actualInit.baseURL);

    if (input instanceof FetchRequest) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const request = input as FetchRequest<any, any, never>;

      actualInit.headers.assign(new HttpHeaders<FetchRequestInit.DefaultHeaders<Schema>>(request.headers));

      url = new URL(input.url);

      actualInput = request;
    } else {
      url = new URL(input instanceof URL ? input : joinURL(baseURL, input));

      actualInit.searchParams.assign(
        new HttpSearchParams<FetchRequestInit.DefaultSearchParams<Schema>>(url.searchParams),
      );

      if (init?.searchParams) {
        actualInit.searchParams.assign(new HttpSearchParams(init.searchParams));
      }

      url.search = actualInit.searchParams.toString();

      actualInput = url;
    }

    this.#raw = new Request(actualInput, actualInit);
    this.#fetch = fetch;

    const baseURLWithoutTrailingSlash = baseURL.toString().replace(/\/$/, '');

    this.#path = excludeNonPathParams(url)
      .toString()
      .replace(baseURLWithoutTrailingSlash, '') as AllowAnyStringInPathParams<Path>;

    this.#method = (actualInit.method ?? 'GET') as Method;
  }

  get raw() {
    return this.#raw;
  }

  get path() {
    return this.#path;
  }

  get method() {
    return this.#method;
  }

  get headers() {
    return this.raw.headers as BaseFetchRequest<Schema, Method, Path>['headers'];
  }

  get cache() {
    return this.raw.cache;
  }

  get credentials() {
    return this.raw.credentials;
  }

  get destination() {
    return this.raw.destination;
  }

  get integrity() {
    return this.raw.integrity;
  }

  get keepalive() {
    return this.raw.keepalive;
  }

  get mode() {
    return this.raw.mode;
  }

  get redirect() {
    return this.raw.redirect;
  }

  get referrer() {
    return this.raw.referrer;
  }

  get referrerPolicy() {
    return this.raw.referrerPolicy;
  }

  get signal() {
    return this.raw.signal;
  }

  get url() {
    return this.raw.url;
  }

  get body() {
    return this.raw.body;
  }

  get bodyUsed() {
    return this.raw.bodyUsed;
  }

  text() {
    return this.raw.text() as ReturnType<BaseFetchRequest<Schema, Method, Path>['text']>;
  }

  json() {
    return this.raw.json() as ReturnType<BaseFetchRequest<Schema, Method, Path>['json']>;
  }

  formData() {
    return this.raw.formData() as ReturnType<BaseFetchRequest<Schema, Method, Path>['formData']>;
  }

  arrayBuffer() {
    return this.raw.arrayBuffer();
  }

  blob() {
    return this.raw.blob();
  }

  bytes() {
    return this.raw.bytes();
  }

  clone() {
    return new FetchRequest(this.#fetch, this.raw.clone() as FetchInput<Schema, Method, Path>);
  }

  toObject(options: { includeBody: true }): Promise<FetchRequestObject>;
  toObject(options?: { includeBody?: false }): FetchRequestObject;
  toObject(options?: { includeBody?: boolean }): PossiblePromise<FetchRequestObject>;
  toObject(options?: { includeBody?: boolean }): PossiblePromise<FetchRequestObject> {
    const requestObject: FetchRequestObject = {
      url: this.url,
      path: this.path,
      method: this.method,
      headers: HttpHeaders.prototype.toObject.call(this.headers) as HttpHeadersSchema,
      cache: this.cache,
      destination: this.destination,
      credentials: this.credentials,
      integrity: this.integrity,
      keepalive: this.keepalive,
      mode: this.mode,
      redirect: this.redirect,
      referrer: this.referrer,
      referrerPolicy: this.referrerPolicy,
    };

    if (!options?.includeBody) {
      return requestObject;
    }

    return withIncludedBodyIfAvailable(this.raw, requestObject);
  }
}

Object.setPrototypeOf(FetchRequest.prototype, Request.prototype);

export function createFetchRequestClass<Schema extends HttpSchema>(fetch: Fetch<Schema>) {
  class Request<
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
  > extends FetchRequest<Schema, Method, Path> {
    constructor(
      input: FetchInput<Schema, Method, Path>,
      init?: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
    ) {
      super(fetch, input, init);
    }
  }

  return Request as FetchRequestConstructor<Schema>;
}
