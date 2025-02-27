import {
  HttpSchemaPath,
  HttpSchemaMethod,
  HttpSearchParams,
  LiteralHttpSchemaPathFromNonLiteral,
  HttpSchema,
} from '@zimic/http';
import createRegexFromURL from '@zimic/utils/url/createRegExpFromURL';
import excludeURLParams from '@zimic/utils/url/excludeURLParams';
import joinURL from '@zimic/utils/url/joinURL';

import FetchResponseError from './errors/FetchResponseError';
import { FetchInput, FetchOptions, Fetch } from './types/public';
import { FetchRequestConstructor, FetchRequestInit, FetchRequest, FetchResponse } from './types/requests';

class FetchClient<Schema extends HttpSchema> {
  fetch: Fetch<Schema>;

  constructor({ onRequest, onResponse, ...defaults }: FetchOptions<Schema>) {
    this.fetch = this.createFetchFunction();
    this.fetch.defaults = defaults;
    this.fetch.Request = this.createRequestClass(defaults);
    this.fetch.onRequest = onRequest;
    this.fetch.onResponse = onResponse;
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
    init: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
  ) {
    let request = input instanceof Request ? input : new this.fetch.Request(input, init);

    if (this.fetch.onRequest) {
      const requestAfterInterceptor = await this.fetch.onRequest(
        // Optimize type checking by narrowing the type of request
        request as FetchRequest.Loose,
      );

      if (requestAfterInterceptor !== request) {
        const isFetchRequest = requestAfterInterceptor instanceof this.fetch.Request;

        request = isFetchRequest
          ? (requestAfterInterceptor as Request as typeof request)
          : new this.fetch.Request(requestAfterInterceptor as FetchInput<Schema, Method, Path>, init);
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
      value: fetchRequest satisfies FetchResponse.Loose['request'],
      writable: false,
      enumerable: true,
      configurable: false,
    });

    let responseError: FetchResponse.Loose['error'] | undefined;

    Object.defineProperty(fetchResponse, 'error', {
      get() {
        if (responseError === undefined) {
          responseError = fetchResponse.ok ? null : new FetchResponseError(fetchRequest, fetchResponse);
        }
        return responseError;
      },
      enumerable: true,
      configurable: false,
    });

    return fetchResponse;
  }

  private createRequestClass(defaults: FetchRequestInit.Defaults) {
    class Request<
      Method extends HttpSchemaMethod<Schema>,
      Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
    > extends globalThis.Request {
      path: LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>;

      constructor(
        input: FetchInput<Schema, Method, Path>,
        rawInit: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
      ) {
        const init = { ...defaults, ...rawInit };

        let url: URL;

        if (input instanceof globalThis.Request) {
          super(
            // Optimize type checking by narrowing the type of input
            input as globalThis.Request,
            init,
          );

          url = new URL(input.url);
        } else {
          url = input instanceof URL ? new URL(input) : new URL(joinURL(init.baseURL, input));

          if (init.searchParams) {
            url.search = new HttpSearchParams(init.searchParams).toString();
          }

          super(url, init);
        }

        this.path = excludeURLParams(url).toString().replace(init.baseURL, '') as LiteralHttpSchemaPathFromNonLiteral<
          Schema,
          Method,
          Path
        >;
      }

      clone(): Request<Method, Path> {
        const rawClone = super.clone();

        return new Request<Method, Path>(
          rawClone as unknown as FetchInput<Schema, Method, Path>,
          rawClone as unknown as FetchRequestInit<
            Schema,
            Method,
            LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>
          >,
        );
      }
    }

    return Request as FetchRequestConstructor<Schema>;
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
      createRegexFromURL(path).test(request.path)
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
      'error' in response &&
      this.isRequest(response.request, method, path)
    );
  }

  isResponseError<Path extends HttpSchemaPath.Literal<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    error: unknown,
    method: Method,
    path: Path,
  ): error is FetchResponseError<Schema, Method, Path> {
    return (
      error instanceof FetchResponseError &&
      error.request.method === method &&
      typeof error.request.path === 'string' &&
      createRegexFromURL(path).test(error.request.path)
    );
  }
}

export default FetchClient;
