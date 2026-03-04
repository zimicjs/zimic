import { HttpSchemaPath, HttpSchemaMethod, LiteralHttpSchemaPathFromNonLiteral, HttpSchema } from '@zimic/http';
import { createRegexFromPath } from '@zimic/utils/url';

import { FetchRequest } from './request/FetchRequest';
import { FetchRequestInit } from './request/types';
import FetchResponseError from './response/error/FetchResponseError';
import { FetchResponse } from './response/FetchResponse';
import { FetchInput, FetchOptions, Fetch, FetchDefaults, FetchRequestConstructor } from './types/public';

const FETCH_OPTIONS_DEFAULT_PROPERTIES = [
  'baseURL',
  'onRequest',
  'onResponse',
  'body',
  'cache',
  'credentials',
  'integrity',
  'keepalive',
  'mode',
  'priority',
  'redirect',
  'referrer',
  'referrerPolicy',
  'signal',
  'window',
  'duplex',
] satisfies (keyof FetchOptions<never>)[];

class FetchClient<Schema extends HttpSchema> implements Omit<Fetch<Schema>, 'loose' | 'Request' | keyof FetchDefaults> {
  fetch: Fetch<Schema>;

  constructor(options: FetchOptions<Schema>) {
    this.fetch = this.createFetchFunction();
    this.assignDefaults(this.fetch, options);
    this.fetch.loose = this.fetch as unknown as Fetch.Loose;
    this.fetch.Request = this.createFetchRequestConstructor(this.fetch);
  }

  private assignDefaults(
    fetch: Fetch<Schema>,
    { headers = {}, searchParams = {}, ...otherOptions }: FetchOptions<Schema>,
  ) {
    fetch.headers = headers;
    fetch.searchParams = searchParams;

    for (const property of FETCH_OPTIONS_DEFAULT_PROPERTIES) {
      const propertyValue = otherOptions[property];

      if (propertyValue !== undefined) {
        fetch[property] = propertyValue as never;
      }
    }
  }

  get defaults(): FetchDefaults<Schema> {
    return this.fetch;
  }

  private createFetchFunction() {
    const fetch = async <
      Method extends HttpSchemaMethod<Schema>,
      Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
      Redirect extends RequestRedirect = 'follow',
    >(
      input: FetchInput<Schema, Method, Path>,
      init: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Redirect>,
    ) => {
      const fetchRequest = await this.createFetchRequest<Method, Path>(input, init);

      const response = await globalThis.fetch(fetchRequest.raw.clone());
      const fetchResponse = await this.createFetchResponse<
        Method,
        LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>
      >(fetchRequest, response);

      return fetchResponse;
    };

    return Object.setPrototypeOf(fetch, this) as Fetch<Schema>;
  }

  private createFetchRequestConstructor<Schema extends HttpSchema>(fetch: Fetch<Schema>) {
    function Request<
      Method extends HttpSchemaMethod<Schema>,
      Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
      Redirect extends RequestRedirect = 'follow',
    >(
      input: FetchInput<Schema, Method, Path>,
      init?: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Redirect>,
    ) {
      return new FetchRequest(fetch, input, init);
    }

    Object.setPrototypeOf(Request.prototype, FetchRequest.prototype);

    return Request as unknown as FetchRequestConstructor<Schema>;
  }

  private async createFetchRequest<
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
  >(
    input: FetchInput<Schema, Method, Path>,
    init?: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
  ) {
    let fetchRequest = new this.fetch.Request(input, init);

    if (this.fetch.onRequest) {
      const newRequest = await this.fetch.onRequest(fetchRequest as FetchRequest.Loose);

      if (newRequest !== fetchRequest) {
        if (newRequest instanceof FetchRequest) {
          fetchRequest = newRequest as typeof fetchRequest;
        } else {
          fetchRequest = new this.fetch.Request(newRequest as FetchInput<Schema, Method, Path>, init);
        }
      }
    }

    return fetchRequest;
  }

  private async createFetchResponse<
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath.Literal<Schema, Method>,
  >(fetchRequest: FetchRequest<Schema, Method, Path>, response: Response) {
    let fetchResponse = new FetchResponse<Schema, Method, Path>(fetchRequest, response);

    if (this.fetch.onResponse) {
      const newResponse = await this.fetch.onResponse(fetchResponse as FetchResponse.Loose);

      fetchResponse =
        newResponse instanceof FetchResponse
          ? (newResponse as typeof fetchResponse)
          : new FetchResponse<Schema, Method, Path>(fetchRequest, newResponse);
    }

    return fetchResponse;
  }

  isRequest<Path extends HttpSchemaPath.Literal<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    request: unknown,
    method: Method,
    path: Path,
  ): request is FetchRequest<Schema, Method, Path> {
    return (
      request instanceof FetchRequest &&
      request.method === method &&
      typeof request.path === 'string' &&
      createRegexFromPath(path).test(request.path)
    );
  }

  isResponse<Path extends HttpSchemaPath.Literal<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    response: unknown,
    method: Method,
    path: Path,
  ): response is FetchResponse<Schema, Method, Path> {
    return response instanceof FetchResponse && this.isRequest(response.request, method, path);
  }

  isResponseError<Path extends HttpSchemaPath.Literal<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    error: unknown,
    method: Method,
    path: Path,
  ): error is FetchResponseError<Schema, Method, Path> {
    return (
      error instanceof FetchResponseError &&
      this.isRequest(error.request, method, path) &&
      this.isResponse(error.response, method, path)
    );
  }
}

export default FetchClient;
