import {
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpResponse,
  HttpResponseBodySchema,
  HttpResponseHeadersSchema,
  HttpStatusCode,
  HttpHeaders,
  HttpHeadersSchema,
} from '@zimic/http';
import { Default, PossiblePromise } from '@zimic/utils/types';

import FetchResponseError from '../errors/FetchResponseError';
import { FetchRequest } from '../request/FetchRequest';
import { withIncludedBodyIfAvailable } from '../utils/objects';
import { FetchResponseObject, FetchResponseStatusCode } from './types';

export namespace FetchResponse {
  /** A loosely typed version of a {@link FetchResponse}. */
  export interface Loose extends Response {
    raw: Response;
    request: FetchRequest.Loose;
    error: FetchResponseError<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    clone: () => Loose;
  }
}

type FetchHttpResponse<
  Schema extends HttpSchema,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
  StatusCode extends HttpStatusCode = HttpStatusCode,
> = HttpResponse<
  HttpResponseBodySchema<Default<Schema[Path][Method]>, StatusCode>,
  Default<HttpResponseHeadersSchema<Default<Schema[Path][Method]>, StatusCode>>,
  StatusCode
>;

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response `FetchResponse` API reference} */
export class FetchResponse<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
  /** @deprecated The type parameter `ErrorOnly` will be removed in the next major version. */
  ErrorOnly extends boolean = false,
  Redirect extends RequestRedirect = 'follow',
  StatusCode extends FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect> =
    FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect>,
> implements FetchHttpResponse<Schema, Path, Method, StatusCode> {
  #raw: Response;

  #request: FetchRequest<Schema, Method, Path>;
  #error?: FetchResponseError<Schema, Method, Path>;

  constructor(request: FetchRequest<Schema, Method, Path>, body?: BodyInit | null, init?: ResponseInit);
  constructor(request: FetchRequest<Schema, Method, Path>, response: Response);
  constructor(
    request: FetchRequest<Schema, Method, Path>,
    bodyOrResponse?: BodyInit | null | Response,
    init?: ResponseInit,
  ) {
    this.#request = request;

    if (bodyOrResponse instanceof Response) {
      this.#raw = bodyOrResponse;
    } else {
      this.#raw = new Response(bodyOrResponse, init);
    }
  }

  get raw() {
    return this.#raw;
  }

  get request() {
    return this.#request;
  }

  get error() {
    this.#error ??= new FetchResponseError(this.request, this);
    return this.#error;
  }

  get headers() {
    return this.#raw.headers as unknown as FetchHttpResponse<Schema, Path, Method, StatusCode>['headers'];
  }

  get ok() {
    return this.#raw.ok as FetchHttpResponse<Schema, Path, Method, StatusCode>['ok'];
  }

  get redirected() {
    return this.#raw.redirected;
  }

  get status() {
    return this.#raw.status as FetchHttpResponse<Schema, Path, Method, StatusCode>['status'];
  }

  get statusText() {
    return this.#raw.statusText;
  }

  get url() {
    return this.#raw.url;
  }

  get type() {
    return this.#raw.type;
  }

  get body() {
    return this.#raw.body;
  }

  get bodyUsed() {
    return this.#raw.bodyUsed;
  }

  text() {
    return this.#raw.text() as ReturnType<FetchHttpResponse<Schema, Path, Method, StatusCode>['text']>;
  }

  json() {
    return this.#raw.json() as ReturnType<FetchHttpResponse<Schema, Path, Method, StatusCode>['json']>;
  }

  formData() {
    return this.#raw.formData() as ReturnType<FetchHttpResponse<Schema, Path, Method, StatusCode>['formData']>;
  }

  arrayBuffer() {
    return this.#raw.arrayBuffer();
  }

  blob() {
    return this.#raw.blob();
  }

  bytes() {
    return this.#raw.bytes();
  }

  clone() {
    return new FetchResponse<Schema, Method, Path, ErrorOnly, Redirect, StatusCode>(this.request, this.#raw.clone());
  }

  toObject(options: { includeBody: true }): Promise<FetchResponseObject>;
  toObject(options: { includeBody: false }): FetchResponseObject;
  toObject(options: { includeBody: boolean }): PossiblePromise<FetchResponseObject>;
  toObject(options: { includeBody: boolean }): PossiblePromise<FetchResponseObject> {
    const responseObject: FetchResponseObject = {
      url: this.url,
      type: this.type,
      status: this.status,
      statusText: this.statusText,
      ok: this.ok,
      headers: HttpHeaders.prototype.toObject.call(this.headers) as HttpHeadersSchema,
      redirected: this.redirected,
    };

    if (!options.includeBody) {
      return responseObject;
    }

    return withIncludedBodyIfAvailable(this.#raw, responseObject);
  }
}

Object.setPrototypeOf(FetchResponse.prototype, Response.prototype);
