import { HttpSchema, HttpSchemaPath, HttpSchemaMethod } from '@/http';
import { Default } from '@/types/utils';
import { urlJoin } from '@/utils/urls';

import FetchResponseError from './FetchResponseError';
import { FetchInput, FetchClientOptions, FetchRequestConstructor, FetchFunction } from './types/public';
import { FetchRequestInit, FetchRequest, FetchResponse } from './types/requests';

class FetchClient<Schema extends HttpSchema> {
  private _baseURL: string;

  fetch: FetchFunction<Schema> & this;
  Request: FetchRequestConstructor<Schema>;

  constructor({ baseURL }: FetchClientOptions) {
    this._baseURL = baseURL;

    this.fetch = this.createFetch();
    this.Request = this.createRequestClass(baseURL);
  }

  baseURL() {
    return this._baseURL;
  }

  setBaseURL(baseURL: string) {
    this._baseURL = baseURL;
  }

  isResponseError<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    error: unknown,
    path: Path,
    method: Method,
  ): error is FetchResponseError<Path, Method, Default<Schema[Path][Method]>> {
    return error instanceof FetchResponseError && error.request.method === method && error.request.url === path;
  }

  private createFetch() {
    const fetch = async <Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
      input: FetchInput<Schema, Path, Method>,
      init?: FetchRequestInit<Schema, Path, Method>,
    ) => {
      const request = input instanceof Request ? input : new this.Request(input, init);

      const rawResponse = await globalThis.fetch(request);
      const response = this.createFetchResponseProxy<Path, Method>(rawResponse, request);

      return response;
    };

    Object.setPrototypeOf(fetch, this);

    return fetch as FetchFunction<Schema> & this;
  }

  private createFetchResponseProxy<
    Path extends HttpSchemaPath<Schema, Method>,
    Method extends HttpSchemaMethod<Schema>,
  >(rawResponse: Response, request: FetchRequest<Path, Method, Default<Schema[Path][Method]>>) {
    let responseError: FetchResponseError<Path, Method, Default<Schema[Path][Method]>> | null = null;

    function getResponseError() {
      if (rawResponse.ok) {
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
        if (property === 'error') {
          return getResponseError;
        }
        return Reflect.get(target, property, target);
      },

      has(target, property) {
        return property === 'error' || Reflect.has(target, property);
      },
    });

    return response;
  }

  private createRequestClass(baseURL: string) {
    type BaseFetchRequest<
      Path extends HttpSchemaPath<Schema, Method>,
      Method extends HttpSchemaMethod<Schema>,
    > = FetchRequest<Path, Method, Default<Schema[Path][Method]>>;

    class Request<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>
      extends globalThis.Request
      implements BaseFetchRequest<Path, Method>
    {
      path: Path;
      method: Method;

      headers!: BaseFetchRequest<Path, Method>['headers'];
      json!: BaseFetchRequest<Path, Method>['json'];
      formData!: BaseFetchRequest<Path, Method>['formData'];

      constructor(input: FetchInput<Schema, Path, Method>, init?: FetchRequestInit<Schema, Path, Method>) {
        if (typeof input === 'string') {
          super(urlJoin(baseURL, input), init);
          this.path = input;
        } else if (input instanceof URL) {
          super(input, init);
          this.path = input.href.replace(baseURL, '') as Path;
        } else {
          super(input, init);
          this.path = input.url.replace(baseURL, '') as Path;
        }

        this.method = (init?.method ?? 'GET') as Method;
      }
    }

    return Request;
  }
}

export default FetchClient;
