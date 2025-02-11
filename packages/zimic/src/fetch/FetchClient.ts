import { HttpSchema, HttpSchemaPath, HttpSchemaMethod } from '@/http';
import { Default, PossiblePromise } from '@/types/utils';
import { excludeNonPathParams, urlJoin } from '@/utils/urls';

import FetchResponseError from './errors/FetchResponseError';
import {
  FetchClient as PublicFetchClient,
  FetchInput,
  FetchClientOptions,
  FetchRequestConstructor,
  FetchFunction,
} from './types/public';
import { FetchRequestInit, FetchRequest, FetchResponse } from './types/requests';

class FetchClient<Schema extends HttpSchema> implements PublicFetchClient<Schema> {
  private _defaults: FetchRequestInit.Defaults;

  private onRequest: (this: FetchClient<Schema>, request: FetchRequest.Loose) => PossiblePromise<FetchRequest.Loose>;

  private onResponse: (
    this: FetchClient<Schema>,
    response: FetchResponse.Loose,
  ) => PossiblePromise<FetchResponse.Loose>;

  private originalFetch: typeof fetch;
  private OriginalRequest: typeof Request;
  private OriginalResponse: typeof Response;

  fetch: FetchFunction<Schema> & this;
  Request: FetchRequestConstructor<Schema>;

  constructor({
    fetch: originalFetch = globalThis.fetch,
    Request: OriginalRequest = globalThis.Request,
    Response: OriginalResponse = globalThis.Response,
    onRequest,
    onResponse,
    ...defaults
  }: FetchClientOptions<Schema>) {
    this._defaults = defaults;

    this.originalFetch = originalFetch;
    this.OriginalRequest = OriginalRequest;
    this.OriginalResponse = OriginalResponse;

    this.fetch = this.createFetchFunction();
    this.Request = this.createRequestClass(defaults);

    this.onRequest = onRequest ?? ((request) => request);
    this.onResponse = onResponse ?? ((response) => response);
  }

  get defaults() {
    return this._defaults;
  }

  isRequest<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    request: unknown,
    path: Path,
    method: Method,
  ): request is FetchRequest<Path, Method, Default<Schema[Path][Method]>> {
    return (
      request instanceof this.OriginalRequest && request.method === method && 'path' in request && request.path === path
    );
  }

  isResponse<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    response: unknown,
    path: Path,
    method: Method,
  ): response is FetchResponse<Path, Method, Default<Schema[Path][Method]>> {
    return (
      response instanceof this.OriginalResponse &&
      'request' in response &&
      response.request instanceof this.OriginalRequest &&
      response.request.method === method &&
      'path' in response.request &&
      response.request.path === path
    );
  }

  isResponseError<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    error: unknown,
    path: Path,
    method: Method,
  ): error is FetchResponseError<Path, Method, Default<Schema[Path][Method]>> {
    return error instanceof FetchResponseError && error.request.method === method && error.request.path === path;
  }

  private createFetchFunction() {
    const fetch: FetchFunction<Schema> = async <
      Path extends HttpSchemaPath<Schema, Method>,
      Method extends HttpSchemaMethod<Schema>,
    >(
      input: FetchInput<Schema, Path, Method>,
      init?: FetchRequestInit<Schema, Path, Method>,
    ) => {
      const fetchRequestBeforeInterceptor = input instanceof Request ? input : new this.Request(input, init);
      const fetchRequestAfterInterceptor = await this.onRequest(fetchRequestBeforeInterceptor);

      const originalResponse = await this.originalFetch(fetchRequestAfterInterceptor);

      const fetchResponseBeforeInterceptor = this.createFetchResponse<Path, Method>(
        fetchRequestBeforeInterceptor,
        originalResponse,
      ) as FetchResponse.Loose;

      const fetchResponseAfterInterceptor = (await this.onResponse(fetchResponseBeforeInterceptor)) as FetchResponse<
        Path,
        Method,
        Default<Schema[Path][Method]>
      >;

      return fetchResponseAfterInterceptor;
    };

    Object.setPrototypeOf(fetch, this);

    return fetch as FetchFunction<Schema> & this;
  }

  private createFetchResponse<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    request: FetchRequest<Path, Method, Default<Schema[Path][Method]>>,
    rawResponse: Response,
  ) {
    let responseError: FetchResponseError<Path, Method, Default<Schema[Path][Method]>> | null = null;

    function getResponseError() {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      if (response.ok) {
        return null;
      }

      if (!responseError) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const errorResponse = response as FetchResponse<Path, Method, Default<Schema[Path][Method]>, true>;
        responseError = new FetchResponseError(request, errorResponse);
      }

      return responseError;
    }

    const response = new Proxy(rawResponse as FetchResponse<Path, Method, Default<Schema[Path][Method]>>, {
      get(target, property) {
        if (property === 'request') {
          return request;
        }
        if (property === 'error') {
          return getResponseError;
        }
        return Reflect.get(target, property, target);
      },

      has(target, property) {
        return property === 'request' || property === 'error' || Reflect.has(target, property);
      },
    });

    return response;
  }

  private createRequestClass(defaults: FetchRequestInit.Defaults) {
    type BaseFetchRequest<
      Path extends HttpSchemaPath<Schema, Method>,
      Method extends HttpSchemaMethod<Schema>,
    > = FetchRequest<Path, Method, Default<Schema[Path][Method]>>;

    class Request<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>
      extends this.OriginalRequest
      implements BaseFetchRequest<Path, Method>
    {
      path: Path;
      method: Method;

      headers!: BaseFetchRequest<Path, Method>['headers'];
      json!: BaseFetchRequest<Path, Method>['json'];
      formData!: BaseFetchRequest<Path, Method>['formData'];

      constructor(input: FetchInput<Schema, Path, Method>, init?: FetchRequestInit<Schema, Path, Method>) {
        const initWithDefaults = { ...defaults, ...init };

        if (typeof input === 'string') {
          let urlAsString: string = input;

          if (initWithDefaults.searchParams) {
            const url = new URL(urlJoin(initWithDefaults.baseURL, input));
            url.search = new URLSearchParams(initWithDefaults.searchParams).toString();
            urlAsString = url.toString();
          }

          super(urlAsString, initWithDefaults);

          this.path = input;
        } else if (input instanceof URL) {
          let url: URL = input;

          if (initWithDefaults.searchParams) {
            url = new URL(input);
            url.search = new URLSearchParams(initWithDefaults.searchParams).toString();
          }

          super(url, initWithDefaults);

          this.path = excludeNonPathParams(url).href.replace(initWithDefaults.baseURL, '') as Path;
        } else {
          super(input, initWithDefaults);

          this.path = input.url.replace(initWithDefaults.baseURL, '') as Path;
        }

        this.method = (initWithDefaults.method ?? 'GET') as Method;
      }
    }

    return Request;
  }
}

export default FetchClient;
