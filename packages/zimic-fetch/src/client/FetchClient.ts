import { HttpSchemaPath, HttpSchemaMethod, LiteralHttpSchemaPathFromNonLiteral, HttpSchema } from '@zimic/http';
import { createRegexFromPath } from '@zimic/utils/url';

import FetchResponseError from './errors/FetchResponseError';
import { FetchRequest, FetchRequestConstructor } from './FetchRequest';
import { FetchInput, FetchOptions, Fetch, FetchDefaults } from './types/public';
import { FetchRequestInit, FetchResponse } from './types/requests';

class FetchClient<Schema extends HttpSchema> implements Omit<Fetch<Schema>, 'loose' | 'Request' | keyof FetchDefaults> {
  fetch: Fetch<Schema>;

  constructor({ headers = {}, searchParams = {}, ...otherOptions }: FetchOptions<Schema>) {
    this.fetch = this.createFetchFunction();
    this.fetch.headers = headers;
    this.fetch.searchParams = searchParams;
    Object.assign(this.fetch, otherOptions);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.fetch.loose = this.fetch as Fetch<any> as Fetch.Loose;
    this.fetch.Request = this.createRequestClass(this.fetch);
  }

  get defaults(): FetchDefaults<Schema> {
    return this.fetch;
  }

  private createFetchFunction() {
    const fetch = async <
      Method extends HttpSchemaMethod<Schema>,
      Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
    >(
      input: FetchInput<Schema, Method, Path>,
      init: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
    ) => {
      const request = await this.createFetchRequest<Method, Path>(input, init);
      const requestClone = request.clone();

      const rawResponse = await globalThis.fetch(
        // Optimize type checking by narrowing the type of request
        requestClone as Request,
      );
      const response = await this.createFetchResponse<
        Method,
        LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>
      >(request, rawResponse);

      return response;
    };

    Object.setPrototypeOf(fetch, this);

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
  >(fetchRequest: FetchRequest<Schema, Method, Path>, rawResponse: Response) {
    let response = this.defineFetchResponseProperties<Method, Path>(fetchRequest, rawResponse);

    if (this.fetch.onResponse) {
      const responseAfterInterceptor = await this.fetch.onResponse(
        // Optimize type checking by narrowing the type of response
        response as FetchResponse.Loose,
      );

      const isFetchResponse =
        responseAfterInterceptor instanceof Response &&
        'request' in responseAfterInterceptor &&
        responseAfterInterceptor.request instanceof this.fetch.Request;

      response = isFetchResponse
        ? (responseAfterInterceptor as typeof response)
        : this.defineFetchResponseProperties<Method, Path>(fetchRequest, responseAfterInterceptor);
    }

    return response;
  }

  private defineFetchResponseProperties<
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath.Literal<Schema, Method>,
  >(fetchRequest: FetchRequest<Schema, Method, Path>, response: Response) {
    const fetchResponse = response as FetchResponse<Schema, Method, Path>;

    Object.defineProperty(fetchResponse, 'request', {
      value: fetchRequest,
      writable: false,
      enumerable: true,
      configurable: false,
    });

    let responseError: FetchResponse.Loose['error'] | undefined;

    Object.defineProperty(fetchResponse, 'error', {
      get() {
        responseError ??= new FetchResponseError(fetchRequest, fetchResponse);
        return responseError;
      },
      enumerable: true,
      configurable: false,
    });

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
      request instanceof Request &&
      request.method === method &&
      'path' in request &&
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
      response instanceof Response &&
      'request' in response &&
      this.isRequest(response.request, method, path) &&
      'error' in response &&
      (response.error === null || response.error instanceof FetchResponseError)
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
