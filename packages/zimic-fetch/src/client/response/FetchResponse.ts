import { HttpSchema, HttpSchemaMethod, HttpSchemaPath, HttpHeadersSchema, HttpHeaders } from '@zimic/http';
import { Default, PossiblePromise } from '@zimic/utils/types';

import { FetchRequest } from '../request/FetchRequest';
import { withIncludedBodyIfAvailable } from '../utils/objects';
import FetchResponseError from './error/FetchResponseError';
import {
  FetchResponseBodySchema,
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

// FetchResponse is declared as a constant to keep backward compatibility. FetchResponse is only a type up to
// @zimic/fetch@^1.4 and is not possible to replicate the same typing behavior in a class without breaking changes.
// Starting from @zimic/fetch@^2, the constant declaration can be removed and FetchResponse can be declared directly as
// a class.
export const FetchResponse = class FetchResponse<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
  /** @deprecated The type parameter `ErrorOnly` will be removed in the next major version. */
  ErrorOnly extends boolean = false,
  Redirect extends RequestRedirect = 'follow',
  StatusCode extends FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect> =
    FetchResponseStatusCode<Default<Schema[Path][Method]>, ErrorOnly, Redirect>,
> {
  #raw: Response;
  #request: FetchRequest<Schema, Method, Path>;
  #error: FetchResponseError<Schema, Method, Path> | null = null;

  constructor(
    request: FetchRequest<Schema, Method, Path>,
    responseOrBody?:
      | Response
      | FetchResponseBodySchema<Default<Default<Default<Schema[Path][Method]>['response']>[StatusCode]>>,
    init?: FetchResponseInit<Schema, Method, Path, ErrorOnly, Redirect, StatusCode>,
  ) {
    this.#raw =
      responseOrBody instanceof Response
        ? responseOrBody
        : new Response(responseOrBody as BodyInit | null, init as ResponseInit);

    this.#request = request;
  }

  get raw() {
    return this.#raw;
  }

  get request() {
    return this.#request;
  }

  get error() {
    // We create the error lazily to preserve the stack trace of the error where it was first accessed.
    this.#error ??= new FetchResponseError(
      this.#request,
      // @ts-expect-error Since FetchResponse as is both a mapped type and a class, they are not comparable. For now,
      // we need to ignore the error. This will be fixed when FetchResponse (type) and FetchResponse (class) are merged
      // are merged in @zimic/fetch@^2.
      this,
    );
    return this.#error;
  }

  get headers() {
    return this.#raw.headers;
  }

  get ok() {
    return this.#raw.ok;
  }

  get redirected() {
    return this.#raw.redirected;
  }

  get status() {
    return this.#raw.status as StatusCode;
  }

  get statusText() {
    return this.#raw.statusText;
  }

  get type() {
    return this.#raw.type;
  }

  get url() {
    return this.#raw.url;
  }

  get body() {
    return this.#raw.body;
  }

  get bodyUsed() {
    return this.#raw.bodyUsed;
  }

  text() {
    return this.#raw.text();
  }

  json() {
    return this.#raw.json();
  }

  formData() {
    return this.#raw.formData();
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
    return new FetchResponse(this.#request, this.#raw.clone());
  }

  toObject(options: { includeBody: true }): Promise<FetchResponseObject>;
  toObject(options?: { includeBody?: false }): FetchResponseObject;
  toObject(options?: { includeBody?: boolean }): PossiblePromise<FetchResponseObject>;
  toObject(options?: { includeBody?: boolean }): PossiblePromise<FetchResponseObject> {
    const responseObject: FetchResponseObject = {
      url: this.url,
      type: this.type,
      status: this.status,
      statusText: this.statusText,
      ok: this.ok,
      headers: HttpHeaders.prototype.toObject.call(this.headers) as HttpHeadersSchema,
      redirected: this.redirected,
    };

    if (!options?.includeBody) {
      return responseObject;
    }

    return withIncludedBodyIfAvailable(this.#raw, responseObject);
  }
};

Object.setPrototypeOf(FetchResponse.prototype, Response.prototype);
