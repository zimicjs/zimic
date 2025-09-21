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
  toObject(options?: FetchResponseErrorObjectOptions.WithoutBody): FetchResponseErrorObject;
  toObject(options?: FetchResponseErrorObjectOptions): PossiblePromise<FetchResponseErrorObject>;
  toObject({
    includeRequestBody = false,
    includeResponseBody = false,
  }: FetchResponseErrorObjectOptions = {}): PossiblePromise<FetchResponseErrorObject> {
    const partialObject = {
      name: this.name,
      message: this.message,
    } satisfies Partial<FetchResponseErrorObject>;

    if (!includeRequestBody && !includeResponseBody) {
      return {
        ...partialObject,
        request: this.requestToObject({ includeBody: false }),
        response: this.responseToObject({ includeBody: false }),
      };
    }

    return Promise.all([
      Promise.resolve(this.requestToObject({ includeBody: includeRequestBody })),
      Promise.resolve(this.responseToObject({ includeBody: includeResponseBody })),
    ]).then(([request, response]) => ({ ...partialObject, request, response }));
  }

  private requestToObject(options: { includeBody: true }): Promise<FetchRequestObject>;
  private requestToObject(options: { includeBody: false }): FetchRequestObject;
  private requestToObject(options: { includeBody: boolean }): Promise<FetchRequestObject> | FetchRequestObject;
  private requestToObject(options: { includeBody: boolean }): Promise<FetchRequestObject> | FetchRequestObject {
    const request = this.request;

    const requestObject: FetchRequestObject = {
      url: request.url,
      path: request.path,
      method: request.method,
      headers: this.headersToObject(request.headers),
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

    if (!options.includeBody) {
      return requestObject;
    }

    // Optimize type checking by narrowing the type of the body
    const bodyAsTextPromise = request.text() as Promise<string>;

    return bodyAsTextPromise.then((bodyAsText) => {
      requestObject.body = bodyAsText.length > 0 ? bodyAsText : null;
      return requestObject;
    });
  }

  private responseToObject(options: { includeBody: true }): Promise<FetchResponseObject>;
  private responseToObject(options: { includeBody: false }): FetchResponseObject;
  private responseToObject(options: { includeBody: boolean }): Promise<FetchResponseObject> | FetchResponseObject;
  private responseToObject(options: { includeBody: boolean }): Promise<FetchResponseObject> | FetchResponseObject {
    const response = this.response;

    const responseObject: FetchResponseObject = {
      url: response.url,
      type: response.type,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: this.headersToObject(response.headers),
      redirected: response.redirected,
    };

    if (!options.includeBody) {
      return responseObject;
    }

    // Optimize type checking by narrowing the type of the body
    const bodyAsTextPromise = response.text() as Promise<string>;

    return bodyAsTextPromise.then((bodyAsText) => {
      responseObject.body = bodyAsText.length > 0 ? bodyAsText : null;
      return responseObject;
    });
  }

  private headersToObject(headers: typeof this.request.headers | typeof this.response.headers): HttpHeadersSchema {
    return HttpHeaders.prototype.toObject.call(headers) as HttpHeadersSchema;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFetchRequestError = FetchResponseError<any, any, any>;

export default FetchResponseError;
