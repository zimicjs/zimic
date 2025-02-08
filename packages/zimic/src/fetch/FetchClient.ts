import {
  HttpSchema,
  HttpSchemaPath,
  HttpSchemaMethod,
  HttpRequestSchema,
  HttpMethod,
  HttpMethodSchema,
  HttpResponseSchemaStatusCode,
  HttpStatusCode,
  HttpResponse,
  HttpRequest,
} from '@/http';
import {
  HttpRequestBodySchema,
  HttpRequestHeadersSchema,
  HttpResponseBodySchema,
  HttpResponseHeadersSchema,
} from '@/interceptor/http/requestHandler/types/requests';
import { Default } from '@/types/utils';
import { joinURL } from '@/utils/urls';

import FetchRequestError from './FetchRequestError';

type FetchRequestInitWithHeaders<RequestSchema extends HttpRequestSchema> = undefined extends RequestSchema['headers']
  ? { headers?: undefined }
  : { headers: RequestSchema['headers'] };

type FetchRequestInitWithSearchParams<RequestSchema extends HttpRequestSchema> =
  undefined extends RequestSchema['searchParams']
    ? { searchParams?: undefined }
    : { searchParams: RequestSchema['searchParams'] };

type FetchRequestInitWithBody<RequestSchema extends HttpRequestSchema> = undefined extends RequestSchema['body']
  ? { body?: null }
  : { body: RequestSchema['body'] };

type FetchRequestInitPerPath<Method extends HttpMethod, RequestSchema extends HttpRequestSchema> = RequestInit & {
  method: Method;
} & FetchRequestInitWithHeaders<RequestSchema> &
  FetchRequestInitWithSearchParams<RequestSchema> &
  FetchRequestInitWithBody<RequestSchema>;

type FetchRequestInit<
  Schema extends HttpSchema,
  Path extends HttpSchemaPath<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
> = Path extends Path ? FetchRequestInitPerPath<Method, Default<Default<Schema[Path][Method]>['request']>> : never;

type AllFetchResponseStatusCode<MethodSchema extends HttpMethodSchema> = HttpResponseSchemaStatusCode<
  Default<MethodSchema['response']>
>;

type FetchResponseStatusCode<MethodSchema extends HttpMethodSchema, IsError extends boolean> = IsError extends true
  ? AllFetchResponseStatusCode<MethodSchema> & (HttpStatusCode.ClientError | HttpStatusCode.ServerError)
  : AllFetchResponseStatusCode<MethodSchema>;

type FetchResponsePerStatusCode<
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpStatusCode,
> = HttpResponse<
  HttpResponseBodySchema<MethodSchema, StatusCode>,
  StatusCode,
  HttpResponseHeadersSchema<MethodSchema, StatusCode>
> &
  (StatusCode extends HttpStatusCode.ClientError | HttpStatusCode.ServerError
    ? { error: () => FetchRequestError<MethodSchema> }
    : { error: unknown });

type FetchResponseForEachStatusCode<
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpStatusCode,
> = StatusCode extends StatusCode ? FetchResponsePerStatusCode<MethodSchema, StatusCode> : never;

export type FetchRequest<MethodSchema extends HttpMethodSchema> = HttpRequest<
  HttpRequestBodySchema<MethodSchema>,
  HttpRequestHeadersSchema<MethodSchema>
>;

export type FetchResponse<
  MethodSchema extends HttpMethodSchema,
  IsError extends boolean = false,
> = FetchResponseForEachStatusCode<MethodSchema, FetchResponseStatusCode<MethodSchema, IsError>>;

export interface FetchOptions {
  baseURL: string;
}

class FetchClient<Schema extends HttpSchema> {
  private _baseURL: string;

  private originalFetch = globalThis.fetch;

  constructor(options: FetchOptions) {
    this._baseURL = options.baseURL;
  }

  baseURL() {
    return this._baseURL;
  }

  setBaseURL(baseURL: string) {
    this._baseURL = baseURL;
  }

  fetch = async <Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    input: Path,
    init?: FetchRequestInit<Schema, Path, Method>,
  ): Promise<FetchResponse<Default<Schema[Path][Method]>>> => {
    const requestURL = joinURL(this._baseURL, input);

    const fetchRequest = new Request(requestURL, init) as FetchRequest<Default<Schema[Path][Method]>>;

    const response = await this.originalFetch(fetchRequest);

    const fetchResponse = new Proxy(response as FetchResponse<Default<Schema[Path][Method]>>, {
      get(target, property) {
        if (property === 'error') {
          if (response.ok) {
            throw new Error('Cannot create an error from successful response.');
          }

          return new FetchRequestError(
            fetchRequest,
            fetchResponse as FetchResponse<Default<Schema[Path][Method]>, true>,
          );
        }
        return Reflect.get(target, property, target);
      },

      has(target, property) {
        return property === 'error' || Reflect.has(target, property);
      },
    });

    return fetchResponse;
  };

  isRequestError<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    error: unknown,
    path: Path,
    method: Method,
  ): error is FetchRequestError<Default<Schema[Path][Method]>> {
    return error instanceof FetchRequestError && error.request.method === method && error.request.url === path;
  }
}

export default FetchClient;
