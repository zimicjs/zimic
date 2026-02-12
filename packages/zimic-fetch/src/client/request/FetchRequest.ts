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
} from '@zimic/http';
import { Default, PossiblePromise } from '@zimic/utils/types';
import { excludeNonPathParams, joinURL } from '@zimic/utils/url';

import { Fetch, FetchInput } from '../types/public';
import { withIncludedBodyIfAvailable } from '../utils/objects';
import { FetchRequestInit, FetchRequestObject } from './types';

export namespace FetchRequest {
  /** A loosely typed version of a {@link FetchRequest `FetchRequest`}. */
  export interface Loose extends Request {
    raw: Request;
    path: string;
    method: HttpMethod;
    clone: () => Loose;
  }
}

type FetchHttpRequest<
  Schema extends HttpSchema,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
> = HttpRequest<
  HttpRequestBodySchema<Default<Schema[Path][Method]>>,
  Default<HttpRequestHeadersSchema<Default<Schema[Path][Method]>>>
>;

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-request `FetchRequest` API reference} */
export class FetchRequest<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
> implements FetchHttpRequest<Schema, Path, Method> {
  #raw: Request;

  #path: AllowAnyStringInPathParams<Path>;
  #method: Method;

  constructor(input: FetchInput<Schema, Method, Path>, init?: FetchRequestInit.Loose, fetch?: Fetch<Schema>) {
    let actualInput: URL | globalThis.Request;

    const actualInit = {
      baseURL: init?.baseURL ?? fetch?.baseURL,
      method: init?.method ?? fetch?.method,
      headers: new HttpHeaders(fetch?.headers),
      searchParams: new HttpSearchParams(fetch?.searchParams),
      body: (init?.body ?? fetch?.body) as BodyInit | null,
      mode: init?.mode ?? fetch?.mode,
      cache: init?.cache ?? fetch?.cache,
      credentials: init?.credentials ?? fetch?.credentials,
      integrity: init?.integrity ?? fetch?.integrity,
      keepalive: init?.keepalive ?? fetch?.keepalive,
      priority: init?.priority ?? fetch?.priority,
      redirect: init?.redirect ?? fetch?.redirect,
      referrer: init?.referrer ?? fetch?.referrer,
      referrerPolicy: init?.referrerPolicy ?? fetch?.referrerPolicy,
      signal: init?.signal ?? fetch?.signal,
      window: init?.window === undefined ? fetch?.window : init.window,
      duplex: init?.duplex ?? fetch?.duplex,
    };

    if (init?.headers) {
      actualInit.headers.assign(new HttpHeaders(init.headers));
    }

    let url: URL;
    const baseURL = new URL(actualInit.baseURL ?? '');

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
    return this.raw.headers as FetchHttpRequest<Schema, Path, Method>['headers'];
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
    return this.raw.text() as ReturnType<FetchHttpRequest<Schema, Path, Method>['text']>;
  }

  json() {
    return this.raw.json() as ReturnType<FetchHttpRequest<Schema, Path, Method>['json']>;
  }

  formData() {
    return this.raw.formData() as ReturnType<FetchHttpRequest<Schema, Path, Method>['formData']>;
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
    const requestClone = this.raw.clone();
    return new FetchRequest<Schema, Method, Path>(requestClone as FetchInput<Schema, Method, Path>);
  }

  toObject(options: { includeBody: true }): Promise<FetchRequestObject>;
  toObject(options: { includeBody: false }): FetchRequestObject;
  toObject(options: { includeBody: boolean }): PossiblePromise<FetchRequestObject>;
  toObject(options: { includeBody: boolean }): PossiblePromise<FetchRequestObject> {
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

    if (!options.includeBody) {
      return requestObject;
    }

    return withIncludedBodyIfAvailable(this.raw, requestObject);
  }
}

Object.setPrototypeOf(FetchRequest.prototype, Request.prototype);
