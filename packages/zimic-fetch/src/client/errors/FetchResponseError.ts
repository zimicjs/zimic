import { HttpHeaders, HttpHeadersSchema, HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@zimic/http';

import { FetchRequest, FetchRequestObject, FetchResponse, FetchResponseObject } from '../types/requests';

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference} */
export interface FetchResponseErrorObjectOptions {
  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference} */
  includeRequestBody?: boolean;
  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference} */
  includeResponseBody?: boolean;
}

export namespace FetchResponseErrorObjectOptions {
  /**
   * Options for converting a {@link FetchResponseError `FetchResponseError`} into a plain object, including the body of
   * the request and/or response.
   */
  export type WithBody = FetchResponseErrorObjectOptions &
    ({ includeRequestBody: true } | { includeResponseBody: true });

  /**
   * Options for converting a {@link FetchResponseError `FetchResponseError`} into a plain object, excluding the body of
   * the request and/or response.
   */
  export type WithoutBody = FetchResponseErrorObjectOptions &
    ({ includeRequestBody?: false } | { includeResponseBody?: false });
}

/**
 * A plain object representation of a {@link FetchResponseError `FetchResponseError`}, compatible with JSON. It is useful
 * for serialization, debugging, and logging purposes.
 *
 * @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference}
 */
export interface FetchResponseErrorObject {
  name: string;
  message: string;
  request: FetchRequestObject;
  response: FetchResponseObject;
}

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error `FetchResponseError` API reference} */
class FetchResponseError<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
> extends Error {
  constructor(
    public request: FetchRequest<Schema, Method, Path>,
    public response: FetchResponse<Schema, Method, Path, true, 'manual'>,
  ) {
    super(`${request.method} ${request.url} failed with status ${response.status}: ${response.statusText}`);
    this.name = 'FetchResponseError';
  }

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `fetchResponseError.toObject()` API reference} */
  toObject(options: FetchResponseErrorObjectOptions.WithBody): Promise<FetchResponseErrorObject>;
  toObject(options: FetchResponseErrorObjectOptions.WithoutBody): FetchResponseErrorObject;
  toObject(options?: FetchResponseErrorObjectOptions): Promise<FetchResponseErrorObject> | FetchResponseErrorObject;
  toObject(options?: FetchResponseErrorObjectOptions): Promise<FetchResponseErrorObject> | FetchResponseErrorObject {
    const includeRequestBody = options?.includeRequestBody ?? false;
    const includeResponseBody = options?.includeResponseBody ?? false;

    const partialObject = {
      name: this.name,
      message: this.message,
    } satisfies Partial<FetchResponseErrorObject>;

    if (!includeRequestBody && !includeResponseBody) {
      const request = this.convertRequestToObject({ includeBody: false });
      const response = this.convertResponseToObject({ includeBody: false });
      return { ...partialObject, request, response };
    }

    return Promise.all([
      this.convertRequestToObject({ includeBody: includeRequestBody }),
      this.convertResponseToObject({ includeBody: includeResponseBody }),
    ]).then(([request, response]) => ({ ...partialObject, request, response }));
  }

  private convertRequestToObject(options: { includeBody: true }): Promise<FetchRequestObject>;
  private convertRequestToObject(options: { includeBody: false }): FetchRequestObject;
  private convertRequestToObject(options: { includeBody: boolean }): Promise<FetchRequestObject> | FetchRequestObject;
  private convertRequestToObject(options: { includeBody: boolean }): Promise<FetchRequestObject> | FetchRequestObject {
    const requestObject: FetchRequestObject = {
      url: this.request.url,
      path: this.request.path,
      method: this.request.method,
      headers: HttpHeaders.prototype.toObject.call(this.request.headers) as HttpHeadersSchema,
      cache: this.request.cache,
      destination: this.request.destination,
      credentials: this.request.credentials,
      integrity: this.request.integrity,
      keepalive: this.request.keepalive,
      mode: this.request.mode,
      redirect: this.request.redirect,
      referrer: this.request.referrer,
      referrerPolicy: this.request.referrerPolicy,
    };

    if (!options.includeBody) {
      return requestObject;
    }

    // Optimize type checking by narrowing the type of the body
    const bodyAsTextPromise = this.request.text() as Promise<string>;

    return bodyAsTextPromise.then((bodyAsText) => {
      requestObject.body = bodyAsText.length > 0 ? bodyAsText : null;
      return requestObject;
    });
  }

  private convertResponseToObject(options: { includeBody: true }): Promise<FetchResponseObject>;
  private convertResponseToObject(options: { includeBody: false }): FetchResponseObject;
  private convertResponseToObject(options: {
    includeBody: boolean;
  }): Promise<FetchResponseObject> | FetchResponseObject;
  private convertResponseToObject(options: {
    includeBody: boolean;
  }): Promise<FetchResponseObject> | FetchResponseObject {
    const responseObject: FetchResponseObject = {
      url: this.response.url,
      type: this.response.type,
      status: this.response.status,
      statusText: this.response.statusText,
      ok: this.response.ok,
      headers: HttpHeaders.prototype.toObject.call(this.response.headers) as HttpHeadersSchema,
      redirected: this.response.redirected,
    };

    if (!options.includeBody) {
      return responseObject;
    }

    // Optimize type checking by narrowing the type of the body
    const bodyAsTextPromise = this.response.text() as Promise<string>;

    return bodyAsTextPromise.then((bodyAsText) => {
      responseObject.body = bodyAsText.length > 0 ? bodyAsText : null;
      return responseObject;
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFetchRequestError = FetchResponseError<any, any, any>;

export default FetchResponseError;
