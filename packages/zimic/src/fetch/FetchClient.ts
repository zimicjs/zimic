import { HttpSchema, HttpSchemaPath, HttpSchemaMethod, HttpSearchParams } from '@/http';
import { LiteralHttpSchemaPathFromNonLiteral } from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';
import { excludeNonPathParams, joinURL } from '@/utils/urls';

import FetchResponseError from './errors/FetchResponseError';
import { FetchClient as PublicFetchClient, FetchInput, FetchOptions, FetchFunction } from './types/public';
import { FetchRequestConstructor, FetchRequestInit, FetchRequest, FetchResponse } from './types/requests';

class FetchClient<Schema extends HttpSchema> implements PublicFetchClient<Schema> {
  private _defaults: FetchRequestInit.Defaults;

  fetch: FetchFunction<Schema> & this;

  Request: FetchRequestConstructor<Schema>;

  private onRequest?: (this: FetchClient<Schema>, request: FetchRequest.Loose) => PossiblePromise<FetchRequest.Loose>;

  private onResponse?: (
    this: FetchClient<Schema>,
    response: FetchResponse.Loose,
  ) => PossiblePromise<FetchResponse.Loose>;

  constructor({ onRequest, onResponse, ...defaults }: FetchOptions<Schema>) {
    this._defaults = defaults;

    this.fetch = this.createFetchFunction();
    this.Request = this.createRequestClass(defaults);

    this.onRequest = onRequest;
    this.onResponse = onResponse;
  }

  get defaults() {
    return this._defaults;
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

      const rawResponse = await globalThis.fetch(
        // Optimize type checking by narrowing the type of request
        request as Request,
      );
      const response = await this.createFetchResponse<
        LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>,
        Method
      >(request, rawResponse);

      return response;
    };

    Object.setPrototypeOf(fetch, this);

    return fetch as FetchFunction<Schema> & this;
  }

  private async createFetchRequest<
    Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
    Method extends HttpSchemaMethod<Schema>,
  >(
    input: FetchInput<Schema, Path, Method>,
    init: FetchRequestInit<Schema, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Method>,
  ) {
    let request = input instanceof Request ? input : new this.Request(input, init);

    if (this.onRequest) {
      request = (await this.onRequest(
        // Optimize type checking by narrowing the type of request
        request as FetchRequest.Loose,
      )) as typeof request;
    }

    return request;
  }

  private async createFetchResponse<
    Path extends HttpSchemaPath<Schema, Method>,
    Method extends HttpSchemaMethod<Schema>,
  >(fetchRequest: FetchRequest<Path, Method, Default<Schema[Path][Method]>>, rawResponse: Response) {
    let response = rawResponse as FetchResponse<Path, Method, Default<Schema[Path][Method]>>;

    Object.defineProperty(response, 'request', {
      value: fetchRequest satisfies FetchResponse.Loose['request'],
      writable: false,
      enumerable: true,
      configurable: false,
    });

    const responseError = (
      response.ok ? null : new FetchResponseError(fetchRequest, response)
    ) satisfies FetchResponse.Loose['error'];

    Object.defineProperty(response, 'error', {
      value: responseError,
      writable: false,
      enumerable: true,
      configurable: false,
    });

    if (this.onResponse) {
      response = (await this.onResponse(
        // Optimize type checking by narrowing the type of response
        response as FetchResponse.Loose,
      )) as typeof response;
    }

    return response;
  }

  private createRequestClass(defaults: FetchRequestInit.Defaults) {
    class Request<
      Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
      Method extends HttpSchemaMethod<Schema>,
    > extends globalThis.Request {
      path: LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>;
      method: Method;

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

        this.path = excludeNonPathParams(url)
          .toString()
          .replace(init.baseURL, '') as LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>;

        this.method = (init.method ?? 'GET') as Method;
      }
    }

    return Request as FetchRequestConstructor<Schema>;
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
}

export default FetchClient;
