import {
  HttpSchemaPath,
  HttpSchemaMethod,
  HttpSearchParams,
  LiteralHttpSchemaPathFromNonLiteral,
  HttpSchema,
  HttpHeaders,
} from '@zimic/http';
import createRegexFromURL from '@zimic/utils/url/createRegExpFromURL';
import excludeURLParams from '@zimic/utils/url/excludeURLParams';
import joinURL from '@zimic/utils/url/joinURL';

import FetchResponseError from './errors/FetchResponseError';
import { FetchInput, FetchOptions, Fetch, FetchDefaults } from './types/public';
import { FetchRequestConstructor, FetchRequestInit, FetchRequest, FetchResponse } from './types/requests';

class FetchClient<Schema extends HttpSchema> implements Omit<Fetch<Schema>, 'defaults' | 'loose' | 'Request'> {
  fetch: Fetch<Schema>;

  constructor({ onRequest, onResponse, ...defaults }: FetchOptions<Schema>) {
    this.fetch = this.createFetchFunction();

    this.fetch.defaults = {
      ...defaults,
      headers: defaults.headers ?? {},
      searchParams: defaults.searchParams ?? {},
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.fetch.loose = this.fetch as Fetch<any> as Fetch.Loose;

    this.fetch.Request = this.createRequestClass(this.fetch.defaults);
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
          responseError = fetchResponse.ok
            ? null
            : new FetchResponseError(
                fetchRequest,
                fetchResponse as FetchResponse<Schema, Method, Path, true, 'manual'>,
              );
        }
        return responseError;
      },
      enumerable: true,
      configurable: false,
    });

    return fetchResponse;
  }

  private createRequestClass(defaults: FetchDefaults) {
    class Request<
      Method extends HttpSchemaMethod<Schema>,
      Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
    > extends globalThis.Request {
      path: LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>;

      constructor(
        input: FetchInput<Schema, Method, Path>,
        init: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
      ) {
        const initWithDefaults = { ...defaults, ...init };

        const headersFromDefaults = new HttpHeaders(defaults.headers);
        const headersFromInit = new HttpHeaders((init satisfies RequestInit as RequestInit).headers);

        let url: URL;
        const baseURL = new URL(initWithDefaults.baseURL);

        if (input instanceof globalThis.Request) {
          // Optimize type checking by narrowing the type of input
          const request = input as globalThis.Request;

          // Optimize type checking by narrowing the type of headers
          const headersFromRequest = new HttpHeaders(input.headers as Headers);

          initWithDefaults.headers = {
            ...headersFromDefaults.toObject(),
            ...headersFromRequest.toObject(),
            ...headersFromInit.toObject(),
          };

          super(request, initWithDefaults);

          url = new URL(input.url);
        } else {
          initWithDefaults.headers = {
            ...headersFromDefaults.toObject(),
            ...headersFromInit.toObject(),
          };

          url = input instanceof URL ? new URL(input) : new URL(joinURL(baseURL, input));

          const searchParamsFromDefaults = new HttpSearchParams(defaults.searchParams);
          const searchParamsFromInit = new HttpSearchParams(initWithDefaults.searchParams);

          initWithDefaults.searchParams = {
            ...searchParamsFromDefaults.toObject(),
            ...searchParamsFromInit.toObject(),
          };

          url.search = new HttpSearchParams(initWithDefaults.searchParams).toString();

          super(url, initWithDefaults);
        }

        const baseURLWithoutTrailingSlash = baseURL.toString().replace(/\/$/, '');

        this.path = excludeURLParams(url)
          .toString()
          .replace(baseURLWithoutTrailingSlash, '') as LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>;
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
