import { HttpSchema, HttpSchemaPath, HttpSchemaMethod } from '@/http';
import { Default } from '@/types/utils';
import { joinURL } from '@/utils/urls';

import FetchRequestError from './FetchRequestError';
import { FetchClient as PublicFetchClient, FetchInput, FetchClientOptions } from './types/public';
import { FetchRequestInit, FetchRequest, FetchResponse } from './types/requests';

class FetchClient<Schema extends HttpSchema> implements PublicFetchClient<Schema> {
  private _baseURL: string;

  Request: new <Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    input: FetchInput<Schema, Path, Method>,
    init?: FetchRequestInit<Schema, Path, Method>,
  ) => FetchRequest<Default<Schema[Path][Method]>>;

  constructor({ baseURL }: FetchClientOptions) {
    this._baseURL = baseURL;

    this.Request = this.createRequestClass(baseURL);
  }

  baseURL() {
    return this._baseURL;
  }

  setBaseURL(baseURL: string) {
    this._baseURL = baseURL;
  }

  fetch = async <Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    input: FetchInput<Schema, Path, Method>,
    init?: FetchRequestInit<Schema, Path, Method>,
  ) => {
    const request = input instanceof Request ? input : new this.Request(input, init);

    const rawResponse = await globalThis.fetch(request);

    const response = new Proxy(rawResponse as FetchResponse<Default<Schema[Path][Method]>>, {
      get(target, property) {
        if (property === 'error') {
          return requestError; // eslint-disable-line @typescript-eslint/no-use-before-define
        }
        return Reflect.get(target, property, target);
      },

      has(target, property) {
        return property === 'error' || Reflect.has(target, property);
      },
    });

    const errorResponse = response as FetchResponse<Default<Schema[Path][Method]>, true>;
    const requestError = rawResponse.ok ? null : new FetchRequestError(request, errorResponse);

    return response;
  };

  isRequestError<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    error: unknown,
    path: Path,
    method: Method,
  ): error is FetchRequestError<Default<Schema[Path][Method]>> {
    return error instanceof FetchRequestError && error.request.method === method && error.request.url === path;
  }

  private createRequestClass(baseURL: string) {
    type BaseFetchRequest<
      Path extends HttpSchemaPath<Schema, Method>,
      Method extends HttpSchemaMethod<Schema>,
    > = FetchRequest<Default<Schema[Path][Method]>>;

    class Request<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>
      extends globalThis.Request
      implements BaseFetchRequest<Path, Method>
    {
      headers!: BaseFetchRequest<Path, Method>['headers'];
      json!: BaseFetchRequest<Path, Method>['json'];
      formData!: BaseFetchRequest<Path, Method>['formData'];

      constructor(input: FetchInput<Schema, Path, Method>, init?: FetchRequestInit<Schema, Path, Method>) {
        if (typeof input === 'string' || input instanceof URL) {
          const inputWithBaseURL = joinURL(baseURL, input);
          super(inputWithBaseURL, init);
        } else if (input.url.startsWith(baseURL)) {
          super(input, init);
        } else {
          const urlWitBase = joinURL(baseURL, input.url);
          const inputWithBaseURL = new globalThis.Request(urlWitBase, input);
          super(inputWithBaseURL, init);
        }
      }
    }

    return Request;
  }
}

export default FetchClient;
