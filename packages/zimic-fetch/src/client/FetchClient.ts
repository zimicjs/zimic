import {
  HttpSchemaPath,
  HttpSchemaMethod,
  HttpSearchParams,
  LiteralHttpSchemaPathFromNonLiteral,
  HttpSchema,
} from '@zimic/http';
import { Default } from '@zimic/utils/types';
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
      Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
      Method extends HttpSchemaMethod<Schema>,
    >(
      input: FetchInput<Schema, Path, Method>,
      init: FetchRequestInit<Schema, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Method>,
    ) => {
      const request = await this.createFetchRequest<Path, Method>(input, init);
      const requestClone = request.clone();

      const rawResponse = await globalThis.fetch(
        // Optimize type checking by narrowing the type of request
        requestClone as Request,
      );
      const response = await this.createFetchResponse<
        LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>,
        Method
      >(request, rawResponse);

      return response;
    };

    Object.setPrototypeOf(fetch, this);

    return fetch as Fetch<Schema>;
  }

  private async createFetchRequest<
    Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
    Method extends HttpSchemaMethod<Schema>,
  >(
    input: FetchInput<Schema, Path, Method>,
    init: FetchRequestInit<Schema, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Method>,
  ) {
    let request = input instanceof Request ? input : new this.fetch.Request(input, init);

    if (this.fetch.onRequest) {
      const requestAfterInterceptor = await this.fetch.onRequest(
        // Optimize type checking by narrowing the type of request
        request as FetchRequest.Loose,
        this.fetch,
      );

      if (requestAfterInterceptor !== request) {
        const isFetchRequest = requestAfterInterceptor instanceof this.fetch.Request;

        request = isFetchRequest
          ? (requestAfterInterceptor as Request as typeof request)
          : new this.fetch.Request(requestAfterInterceptor as FetchInput<Schema, Path, Method>, init);
      }
    }

    return request;
  }

  private async createFetchResponse<
    Path extends HttpSchemaPath<Schema, Method>,
    Method extends HttpSchemaMethod<Schema>,
  >(fetchRequest: FetchRequest<Path, Method, Default<Schema[Path][Method]>>, rawResponse: Response) {
    let response = this.defineFetchResponseProperties<Path, Method>(fetchRequest, rawResponse);

    if (this.fetch.onResponse) {
      const responseAfterInterceptor = await this.fetch.onResponse(
        // Optimize type checking by narrowing the type of response
        response as FetchResponse.Loose,
        this.fetch,
      );

      const isFetchResponse =
        responseAfterInterceptor instanceof Response &&
        'request' in responseAfterInterceptor &&
        responseAfterInterceptor.request instanceof this.fetch.Request;

      response = isFetchResponse
        ? (responseAfterInterceptor as typeof response)
        : this.defineFetchResponseProperties<Path, Method>(fetchRequest, responseAfterInterceptor);
    }

    return response;
  }

  private defineFetchResponseProperties<
    Path extends HttpSchemaPath<Schema, Method>,
    Method extends HttpSchemaMethod<Schema>,
  >(fetchRequest: FetchRequest<Path, Method, Default<Schema[Path][Method]>>, response: Response) {
    const fetchResponse = response as FetchResponse<Path, Method, Default<Schema[Path][Method]>>;

    Object.defineProperty(fetchResponse, 'request', {
      value: fetchRequest satisfies FetchResponse.Loose['request'],
      writable: false,
      enumerable: true,
      configurable: false,
    });

    const responseError = (
      fetchResponse.ok ? null : new FetchResponseError(fetchRequest, fetchResponse)
    ) satisfies FetchResponse.Loose['error'];

    Object.defineProperty(fetchResponse, 'error', {
      value: responseError,
      writable: false,
      enumerable: true,
      configurable: false,
    });

    return fetchResponse;
  }

  private createRequestClass(defaults: FetchRequestInit.Defaults) {
    class Request<
      Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
      Method extends HttpSchemaMethod<Schema>,
    > extends globalThis.Request {
      path: LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>;

      constructor(
        input: FetchInput<Schema, Path, Method>,
        rawInit: FetchRequestInit<Schema, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Method>,
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

      clone(): Request<Path, Method> {
        const rawClone = super.clone();

        return new Request<Path, Method>(
          rawClone as unknown as FetchInput<Schema, Path, Method>,
          rawClone as unknown as FetchRequestInit<
            Schema,
            LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>,
            Method
          >,
        );
      }
    }

    return Request as FetchRequestConstructor<Schema>;
  }

  isRequest<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    request: unknown,
    path: Path,
    method: Method,
  ): request is FetchRequest<Path, Method, Default<Schema[Path][Method]>> {
    return (
      request instanceof Request &&
      request.method === method &&
      'path' in request &&
      typeof request.path === 'string' &&
      createRegexFromURL(path).test(request.path)
    );
  }

  isResponse<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    response: unknown,
    path: Path,
    method: Method,
  ): response is FetchResponse<Path, Method, Default<Schema[Path][Method]>> {
    return (
      response instanceof Response &&
      'request' in response &&
      'error' in response &&
      this.isRequest(response.request, path, method)
    );
  }

  isResponseError<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    error: unknown,
    path: Path,
    method: Method,
  ): error is FetchResponseError<Path, Method, Default<Schema[Path][Method]>> {
    return (
      error instanceof FetchResponseError &&
      error.request.method === method &&
      typeof error.request.path === 'string' &&
      createRegexFromURL(path).test(error.request.path)
    );
  }
}

export default FetchClient;
