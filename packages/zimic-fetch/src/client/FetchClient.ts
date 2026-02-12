import { HttpSchemaPath, HttpSchemaMethod, LiteralHttpSchemaPathFromNonLiteral, HttpSchema } from '@zimic/http';
import { createRegexFromPath } from '@zimic/utils/url';

import FetchResponseError from './errors/FetchResponseError';
import { FetchRequest } from './request/FetchRequest';
import { FetchRequestConstructor, FetchRequestInit } from './request/types';
import { FetchResponse } from './response/FetchResponse';
import { FetchResponseForStatusCode } from './response/types';
import { FetchInput, FetchOptions, Fetch, FetchDefaults } from './types/public';

class FetchClient<Schema extends HttpSchema> implements Omit<Fetch<Schema>, 'loose' | 'Request' | keyof FetchDefaults> {
  fetch: Fetch<Schema>;

  constructor({ headers = {}, searchParams = {}, ...otherOptions }: FetchOptions<Schema>) {
    this.fetch = this.createFetchFunction();
    this.fetch.headers = headers;
    this.fetch.searchParams = searchParams;
    Object.assign(this.fetch, otherOptions);

    this.fetch.loose = this.fetch as unknown as Fetch.Loose;
    this.fetch.Request = this.createRequestClass(this.fetch);
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
      const request = await this.createFetchRequest<Method, Path>(input, init);

      const rawResponse = await globalThis.fetch(request.raw);
      const response = await this.createFetchResponse<
        Method,
        LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>
      >(request, rawResponse);

      return response as unknown as FetchResponseForStatusCode<
        Schema,
        Method,
        LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>,
        false,
        Redirect
      >;
    };

    return fetch as Fetch<Schema>;
  }

  private async createFetchRequest<
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
  >(
    input: FetchInput<Schema, Method, Path>,
    init?: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
  ) {
    let request: FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>;

    if (input instanceof FetchRequest) {
      request = input;
    } else {
      request = new this.fetch.Request(input, init);
    }

    if (this.fetch.onRequest) {
      const requestAfterInterceptor = await this.fetch.onRequest(
        // Optimize type checking by narrowing the type of request
        request as FetchRequest.Loose,
      );

      if (requestAfterInterceptor !== request) {
        const isFetchRequest = requestAfterInterceptor instanceof this.fetch.Request;

        if (isFetchRequest) {
          if (requestAfterInterceptor instanceof FetchRequest) {
            request = requestAfterInterceptor as FetchRequest.Loose as typeof request;
          } else {
            request = new this.fetch.Request(requestAfterInterceptor, init);
          }
        } else {
          request = new this.fetch.Request(requestAfterInterceptor as FetchInput<Schema, Method, Path>, init);
        }
      }
    }

    return request;
  }

  private async createFetchResponse<
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath.Literal<Schema, Method>,
  >(fetchRequest: FetchRequest<Schema, Method, Path>, response: Response) {
    let fetchResponse = new FetchResponse<Schema, Method, Path>(fetchRequest, response);

    if (this.fetch.onResponse) {
      const responseAfterInterceptor = await this.fetch.onResponse(fetchResponse as unknown as FetchResponse.Loose);

      fetchResponse =
        responseAfterInterceptor instanceof FetchResponse
          ? responseAfterInterceptor
          : new FetchResponse<Schema, Method, Path>(fetchRequest, responseAfterInterceptor);
    }

    return fetchResponse;
  }

  private createRequestClass(fetch: Fetch<Schema>) {
    return class Request<
      Method extends HttpSchemaMethod<Schema>,
      Path extends HttpSchemaPath.Literal<Schema, Method>,
    > extends FetchRequest<Schema, Method, Path> {
      constructor(input: FetchInput<Schema, Method, Path>, init?: FetchRequestInit.Loose) {
        super(input, init, fetch);
      }
    } as FetchRequestConstructor<Schema>;
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
    return (
      response instanceof FetchResponse &&
      this.isRequest(response.request, method, path) &&
      response.error instanceof FetchResponseError
    );
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
