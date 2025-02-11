import { HttpSchema, HttpSchemaPath, HttpSchemaMethod, HttpSearchParams } from '@/http';
import { Default, PossiblePromise } from '@/types/utils';
import { excludeNonPathParams, joinURL } from '@/utils/urls';

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

  fetch: FetchFunction<Schema> & this;
  Request: FetchRequestConstructor<Schema>;

  constructor({ onRequest, onResponse, ...defaults }: FetchClientOptions<Schema>) {
    this._defaults = defaults;

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
    return request instanceof Request && request.method === method && 'path' in request && request.path === path;
  }

  isResponse<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    response: unknown,
    path: Path,
    method: Method,
  ): response is FetchResponse<Path, Method, Default<Schema[Path][Method]>> {
    return (
      response instanceof Response &&
      'request' in response &&
      this.isRequest(response.request, path, method) &&
      'error' in response
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
      const fetchRequest = await this.createFetchRequest<Path, Method>(input, init);

      const response = await globalThis.fetch(fetchRequest);
      const fetchResponse = await this.createFetchResponse<Path, Method>(fetchRequest, response);

      return fetchResponse;
    };

    Object.setPrototypeOf(fetch, this);

    return fetch as FetchFunction<Schema> & this;
  }

  private async createFetchRequest<
    Path extends HttpSchemaPath<Schema, Method>,
    Method extends HttpSchemaMethod<Schema>,
  >(input: FetchInput<Schema, Path, Method>, init: FetchRequestInit<Schema, Path, Method> | undefined) {
    const requestBeforeInterceptor = input instanceof Request ? input : new this.Request(input, init);
    const requestAfterInterceptor = (await this.onRequest(requestBeforeInterceptor)) as typeof requestBeforeInterceptor;
    return requestAfterInterceptor;
  }

  private async createFetchResponse<
    Path extends HttpSchemaPath<Schema, Method>,
    Method extends HttpSchemaMethod<Schema>,
  >(fetchRequest: FetchRequest<Path, Method, Default<Schema[Path][Method]>>, response: Response) {
    let responseError: FetchResponseError<Path, Method, Default<Schema[Path][Method]>> | null = null;

    const fetchResponseBeforeInterceptor = response as FetchResponse<Path, Method, Default<Schema[Path][Method]>>;

    Object.defineProperties(fetchResponseBeforeInterceptor, {
      request: {
        value: fetchRequest,
      },

      error: {
        value: () => {
          if (fetchResponseBeforeInterceptor.ok) {
            return null;
          }

          if (!responseError) {
            responseError = new FetchResponseError(
              fetchRequest,
              fetchResponseBeforeInterceptor as FetchResponse<Path, Method, Default<Schema[Path][Method]>, true>,
            );
          }

          return responseError;
        },
      },
    });

    const fetchResponseAfterInterceptor = (await this.onResponse(
      fetchResponseBeforeInterceptor as FetchResponse.Loose,
    )) as typeof fetchResponseBeforeInterceptor;

    return fetchResponseAfterInterceptor;
  }

  private createRequestClass(defaults: FetchRequestInit.Defaults) {
    class Request<
      Path extends HttpSchemaPath<Schema, Method>,
      Method extends HttpSchemaMethod<Schema>,
    > extends globalThis.Request {
      path: Path;
      method: Method;

      constructor(input: FetchInput<Schema, Path, Method>, init?: FetchRequestInit<Schema, Path, Method>) {
        const initWithDefaults = { ...defaults, ...init };

        if (input instanceof globalThis.Request) {
          super(input, initWithDefaults);

          const url = new URL(input.url);
          excludeNonPathParams(url);

          this.path = url.href.replace(initWithDefaults.baseURL, '') as Path;
        } else {
          const url = input instanceof URL ? new URL(input) : new URL(joinURL(initWithDefaults.baseURL, input));

          if (initWithDefaults.searchParams) {
            url.search = new HttpSearchParams(initWithDefaults.searchParams).toString();
          }

          super(url, initWithDefaults);

          const urlWithoutNonPathParams = excludeNonPathParams(url);
          this.path = urlWithoutNonPathParams.href.replace(initWithDefaults.baseURL, '') as Path;
        }

        this.method = (initWithDefaults.method ?? 'GET') as Method;
      }
    }

    return Request as FetchRequestConstructor<Schema>;
  }
}

export default FetchClient;
