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
  HttpHeadersSerialized,
  HttpHeadersSchema,
  HttpBody,
  AllowAnyStringInPathParams,
  LiteralHttpSchemaPathFromNonLiteral,
} from '@zimic/http';
import { Default } from '@zimic/utils/types';
import { excludeNonPathParams, joinURL } from '@zimic/utils/url';

import { Fetch, FetchInput } from './types/public';
import { FetchRequestInit } from './types/requests';

export namespace FetchRequest {
  /** A loosely typed version of a {@link FetchRequest `FetchRequest`}. */
  export interface Loose extends Request {
    path: string;
    method: HttpMethod;
    clone: () => Loose;
  }
}

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `error.toObject()`} */
export type FetchRequestObject = Pick<
  FetchRequest.Loose,
  | 'url'
  | 'path'
  | 'method'
  | 'cache'
  | 'destination'
  | 'credentials'
  | 'integrity'
  | 'keepalive'
  | 'mode'
  | 'redirect'
  | 'referrer'
  | 'referrerPolicy'
> & {
  headers: HttpHeadersSerialized<HttpHeadersSchema>;
  body?: HttpBody | null;
};

/** @see {@link https://zimic.dev/docs/fetch/api/fetch#fetchrequest `fetch.Request` API reference} */
export type FetchRequestConstructor<Schema extends HttpSchema> = new <
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
>(
  input: FetchInput<Schema, Method, Path>,
  init?: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
) => FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>;

type BaseFetchRequest<
  Schema extends HttpSchema,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
> = HttpRequest<
  HttpRequestBodySchema<Default<Schema[Path][Method]>>,
  Default<HttpRequestHeadersSchema<Default<Schema[Path][Method]>>>
>;

const REQUEST = Symbol.for('request');

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-request `FetchRequest` API reference} */
export class FetchRequest<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
> implements BaseFetchRequest<Schema, Path, Method> {
  path: AllowAnyStringInPathParams<Path>;
  method: Method;

  private [REQUEST]: Request;

  private get request() {
    return this[REQUEST];
  }

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

    this[REQUEST] = new Request(actualInput, actualInit);

    const baseURLWithoutTrailingSlash = baseURL.toString().replace(/\/$/, '');

    this.path = excludeNonPathParams(url)
      .toString()
      .replace(baseURLWithoutTrailingSlash, '') as AllowAnyStringInPathParams<Path>;

    this.method = (actualInit.method ?? 'GET') as Method;
  }

  get headers() {
    return this.request.headers as BaseFetchRequest<Schema, Path, Method>['headers'];
  }

  get cache() {
    return this.request.cache;
  }

  get credentials() {
    return this.request.credentials;
  }

  get destination() {
    return this.request.destination;
  }

  get integrity() {
    return this.request.integrity;
  }

  get keepalive() {
    return this.request.keepalive;
  }

  get mode() {
    return this.request.mode;
  }

  get redirect() {
    return this.request.redirect;
  }

  get referrer() {
    return this.request.referrer;
  }

  get referrerPolicy() {
    return this.request.referrerPolicy;
  }

  get signal() {
    return this.request.signal;
  }

  get url() {
    return this.request.url;
  }

  get body() {
    return this.request.body;
  }

  get bodyUsed() {
    return this.request.bodyUsed;
  }

  text() {
    return this.request.text() as ReturnType<BaseFetchRequest<Schema, Path, Method>['text']>;
  }

  json() {
    return this.request.json() as ReturnType<BaseFetchRequest<Schema, Path, Method>['json']>;
  }

  formData() {
    return this.request.formData() as ReturnType<BaseFetchRequest<Schema, Path, Method>['formData']>;
  }

  arrayBuffer() {
    return this.request.arrayBuffer();
  }

  blob() {
    return this.request.blob();
  }

  bytes() {
    return this.request.bytes();
  }

  clone(): FetchRequest<Schema, Method, Path> {
    const requestClone = this.request.clone();
    return new FetchRequest<Schema, Method, Path>(requestClone as FetchInput<Schema, Method, Path>);
  }

  [Symbol.hasInstance](instance: unknown) {
    return instance instanceof globalThis.Request && 'path' in instance && 'method' in instance;
  }
}
