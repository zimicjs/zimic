import { HttpHeaders, HttpHeadersSchema, HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@zimic/http';

import { FetchRequest, FetchRequestObject, FetchResponse, FetchResponseObject } from '../types/requests';

/**
 * Options for converting a {@link FetchResponseError `FetchResponseError`} into a plain object.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchresponseerrortoobject `FetchResponseError#toObject` API reference}
 */
export interface FetchResponseErrorObjectOptions {
  includeBody?: boolean;
}

/**
 * A plain object representation of a {@link FetchResponseError `FetchResponseError`}, compatible with JSON. It is useful
 * for serialization, debugging, and logging purposes.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchresponseerrortoobject `FetchResponseError#toObject` API reference}
 */
export interface FetchResponseErrorObject {
  name: string;
  message: string;
  request: FetchRequestObject;
  response: FetchResponseObject;
}

/**
 * An error representing a response with a failure status code (4XX or 5XX).
 *
 * @example
 *   import { type HttpSchema } from '@zimic/http';
 *   import { createFetch } from '@zimic/fetch';
 *
 *   interface User {
 *     id: string;
 *     username: string;
 *   }
 *
 *   type Schema = HttpSchema<{
 *     '/users/:userId': {
 *       GET: {
 *         response: {
 *           200: { body: User };
 *           404: { body: { message: string } };
 *         };
 *       };
 *     };
 *   }>;
 *
 *   const fetch = createFetch<Schema>({
 *     baseURL: 'http://localhost:3000',
 *   });
 *
 *   const response = await fetch(`/users/${userId}`, {
 *     method: 'GET',
 *   });
 *
 *   if (!response.ok) {
 *     console.log(response.status); // 404
 *
 *     console.log(response.error); // FetchResponseError<Schema, 'GET', '/users'>
 *     console.log(response.error.request); // FetchRequest<Schema, 'GET', '/users'>
 *     console.log(response.error.response); // FetchResponse<Schema, 'GET', '/users'>
 *
 *     const plainError = response.error.toObject();
 *     console.log(JSON.stringify(plainError));
 *     // {"name":"FetchResponseError","message":"...","request":{...},"response":{...}}
 *   }
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchresponseerror `FetchResponseError` API reference}
 */
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

  get cause() {
    return this.response;
  }

  /**
   * Converts this error into a plain object. This method is useful for serialization, debugging, and logging purposes.
   *
   * @example
   *   const fetch = createFetch<Schema>({
   *     baseURL: 'http://localhost:3000',
   *   });
   *
   *   const response = await fetch(`/users/${userId}`, {
   *     method: 'GET',
   *   });
   *
   *   if (!response.ok) {
   *     const plainError = response.error.toObject();
   *     console.log(JSON.stringify(plainError));
   *     // {"name":"FetchResponseError","message":"...","request":{...},"response":{...}}
   *   }
   *
   * @param options.includeBody Whether to include the body of the request and response in the output. Defaults to
   *   `false`.
   * @returns A plain object representing this error. If `options.includeBody` is `true`, the body of the request and
   *   response will be included and the return of this method will be a `Promise`. Otherwise, the return will be the
   *   plain object itself without the body.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchresponseerrortoobject `FetchResponseError#toObject` API reference}
   */
  toObject(options: { includeBody: true }): Promise<FetchResponseErrorObject>;
  toObject(options?: { includeBody?: false }): FetchResponseErrorObject;
  toObject(options?: FetchResponseErrorObjectOptions): Promise<FetchResponseErrorObject> | FetchResponseErrorObject;
  toObject(
    options: FetchResponseErrorObjectOptions = {},
  ): Promise<FetchResponseErrorObject> | FetchResponseErrorObject {
    const { includeBody = false } = options;

    const partialObject = {
      name: this.name,
      message: this.message,
    } satisfies Partial<FetchResponseErrorObject>;

    if (!includeBody) {
      const request = this.convertRequestToObject({ includeBody: false });
      const response = this.convertResponseToObject({ includeBody: false });
      return { ...partialObject, request, response };
    }

    return Promise.all([
      this.convertRequestToObject({ includeBody: true }),
      this.convertResponseToObject({ includeBody: true }),
    ]).then(([request, response]) => ({ ...partialObject, request, response }));
  }

  private convertRequestToObject(options: { includeBody: true }): Promise<FetchRequestObject>;
  private convertRequestToObject(options: { includeBody: false }): FetchRequestObject;
  private convertRequestToObject(options: { includeBody: boolean }): Promise<FetchRequestObject> | FetchRequestObject {
    const partialObject = {
      url: this.request.url,
      path: this.request.path,
      method: this.request.method,
      headers: this.convertHeadersToObject(this.request.headers),
      cache: this.request.cache,
      destination: this.request.destination,
      credentials: this.request.credentials,
      integrity: this.request.integrity,
      keepalive: this.request.keepalive,
      mode: this.request.mode,
      redirect: this.request.redirect,
      referrer: this.request.referrer,
      referrerPolicy: this.request.referrerPolicy,
    } satisfies Partial<FetchRequestObject>;

    if (!options.includeBody) {
      return partialObject;
    }

    return this.request.text().then((bodyAsText: string) => ({
      ...partialObject,
      body: bodyAsText.length > 0 ? bodyAsText : null,
    }));
  }

  private convertResponseToObject(options: { includeBody: true }): Promise<FetchResponseObject>;
  private convertResponseToObject(options: { includeBody: false }): FetchResponseObject;
  private convertResponseToObject(options: {
    includeBody: boolean;
  }): Promise<FetchResponseObject> | FetchResponseObject {
    const partialObject = {
      url: this.response.url,
      type: this.response.type,
      status: this.response.status,
      statusText: this.response.statusText,
      ok: this.response.ok,
      headers: this.convertHeadersToObject(this.response.headers),
      redirected: this.response.redirected,
    } satisfies Partial<FetchResponseObject>;

    if (!options.includeBody) {
      return partialObject;
    }

    return this.response.text().then((bodyAsText: string) => ({
      ...partialObject,
      body: bodyAsText.length > 0 ? bodyAsText : null,
    }));
  }

  private convertHeadersToObject(headers: Headers) {
    return HttpHeaders.prototype.toObject.call(headers) as HttpHeadersSchema;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFetchRequestError = FetchResponseError<any, any, any>;

export default FetchResponseError;
