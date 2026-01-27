import {
  HttpSchemaPath,
  HttpSchemaMethod,
  HttpSearchParams,
  LiteralHttpSchemaPathFromNonLiteral,
  HttpSchema,
  HttpHeaders,
} from '@zimic/http';
import { createRegexFromPath, excludeNonPathParams, joinURL } from '@zimic/utils/url';

import FetchResponseError from './errors/FetchResponseError';
import { FetchInput, FetchOptions, Fetch, FetchDefaults } from './types/public';
import { FetchRequestConstructor, FetchRequestInit, FetchRequest, FetchResponse } from './types/requests';

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
    class Request<Method extends HttpSchemaMethod<Schema>, Path extends HttpSchemaPath.NonLiteral<Schema, Method>>
      extends globalThis.Request
    {
      path: LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>;

      constructor(input: FetchInput<Schema, Method, Path>, init?: FetchRequestInit.Loose) {
        let actualInput: URL | globalThis.Request;

        const actualInit = {
          baseURL: init?.baseURL ?? fetch.baseURL,
          method: init?.method ?? fetch.method,
          headers: new HttpHeaders(fetch.headers),
          searchParams: new HttpSearchParams(fetch.searchParams),
          body: (init?.body ?? fetch.body) as BodyInit | null,
          mode: init?.mode ?? fetch.mode,
          cache: init?.cache ?? fetch.cache,
          credentials: init?.credentials ?? fetch.credentials,
          integrity: init?.integrity ?? fetch.integrity,
          keepalive: init?.keepalive ?? fetch.keepalive,
          priority: init?.priority ?? fetch.priority,
          redirect: init?.redirect ?? fetch.redirect,
          referrer: init?.referrer ?? fetch.referrer,
          referrerPolicy: init?.referrerPolicy ?? fetch.referrerPolicy,
          signal: init?.signal ?? fetch.signal,
          window: init?.window === undefined ? fetch.window : init.window,
          duplex: init?.duplex ?? fetch.duplex,
        };

        if (init?.headers) {
          actualInit.headers.assign(new HttpHeaders(init.headers));
        }

        let url: URL;
        const baseURL = new URL(actualInit.baseURL);

        if (input instanceof globalThis.Request) {
          const request = input as globalThis.Request;

          actualInit.headers.assign(new HttpHeaders<FetchRequestInit.DefaultHeaders<Schema>>(request.headers));

          url = new URL(input.url);

          actualInput = request;
        } else {
          url = new URL(input instanceof URL ? input : joinURL(baseURL, input));

          actualInit.searchParams.assign(
            new HttpSearchParams<FetchRequestInit.DefaultSearchParams<Schema>>(url.searchParams),
          );

          if (init?.searchParams) {
            actualInit.searchParams.assign(new HttpSearchParams(init.searchParams));
          }

          url.search = actualInit.searchParams.toString();

          actualInput = url;
        }

        super(actualInput, actualInit);

        const baseURLWithoutTrailingSlash = baseURL.toString().replace(/\/$/, '');

        this.path = excludeNonPathParams(url)
          .toString()
          .replace(baseURLWithoutTrailingSlash, '') as LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>;
      }

      clone(): this {
        const rawClone = super.clone();
        return new Request(rawClone as FetchInput<Schema, Method, Path>) as this;
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
