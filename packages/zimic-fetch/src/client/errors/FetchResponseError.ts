import { HttpHeaders, HttpHeadersSchema, HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';

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

export class BodyUsedWarning extends TypeError {
  constructor(type: 'request' | 'response') {
    super(
      `Could not include the ${type} body because it is already used. ` +
        `If you access the body before calling \`error.toObject()\`, consider reading it from a cloned ${type}.\n\n` +
        'Learn more: https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject',
    );
    this.name = 'BodyUsedWarning';
  }
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
  private requestToObject(options: { includeBody: boolean }): PossiblePromise<FetchRequestObject>;
  private requestToObject(options: { includeBody: boolean }): PossiblePromise<FetchRequestObject> {
    const request = this.request;

    const requestObject: FetchRequestObject = {
      url: request.url,
      path: request.path,
      method: request.method,
      headers: this.convertHeadersToObject(request),
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

    return this.withIncludeBodyIfAvailable(request, requestObject);
  }

  private responseToObject(options: { includeBody: true }): Promise<FetchResponseObject>;
  private responseToObject(options: { includeBody: false }): FetchResponseObject;
  private responseToObject(options: { includeBody: boolean }): PossiblePromise<FetchResponseObject>;
  private responseToObject(options: { includeBody: boolean }): PossiblePromise<FetchResponseObject> {
    const response = this.response;

    const responseObject: FetchResponseObject = {
      url: response.url,
      type: response.type,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: this.convertHeadersToObject(response),
      redirected: response.redirected,
    };

    if (!options.includeBody) {
      return responseObject;
    }

    return this.withIncludeBodyIfAvailable(response, responseObject);
  }

  private convertHeadersToObject(
    resource: FetchRequest<Schema, Method, Path> | FetchResponse<Schema, Method, Path, true, 'manual'>,
  ): HttpHeadersSchema {
    return HttpHeaders.prototype.toObject.call(resource.headers) as HttpHeadersSchema;
  }

  private withIncludeBodyIfAvailable(
    resource: FetchRequest<Schema, Method, Path>,
    resourceObject: FetchRequestObject,
  ): PossiblePromise<FetchRequestObject>;
  private withIncludeBodyIfAvailable(
    resource: FetchResponse<Schema, Method, Path, true, 'manual'>,
    resourceObject: FetchResponseObject,
  ): PossiblePromise<FetchResponseObject>;
  private withIncludeBodyIfAvailable(
    resource: FetchRequest<Schema, Method, Path> | FetchResponse<Schema, Method, Path, true, 'manual'>,
    resourceObject: FetchRequestObject | FetchResponseObject,
  ): PossiblePromise<FetchRequestObject | FetchResponseObject> {
    if (resource.bodyUsed) {
      const error = new BodyUsedWarning(resource instanceof Request ? 'request' : 'response');
      console.warn(error);

      return resourceObject;
    }

    return resource.text().then((body: string) => {
      resourceObject.body = body.length > 0 ? body : null;
      return resourceObject;
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFetchRequestError = FetchResponseError<any, any, any>;

export default FetchResponseError;
