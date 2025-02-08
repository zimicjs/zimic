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

type FetchResponseStatusCode<
  MethodSchema extends HttpMethodSchema,
  ThrowOnError extends boolean,
> = ThrowOnError extends true
  ? Exclude<AllFetchResponseStatusCode<MethodSchema>, HttpStatusCode.ClientError | HttpStatusCode.ServerError>
  : AllFetchResponseStatusCode<MethodSchema>;

type FetchResponsePerStatusCode<
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpStatusCode,
> = HttpResponse<
  HttpResponseBodySchema<MethodSchema, StatusCode>,
  StatusCode,
  HttpResponseHeadersSchema<MethodSchema, StatusCode>
>;

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
  ThrowOnError extends boolean,
> = FetchResponseForEachStatusCode<MethodSchema, FetchResponseStatusCode<MethodSchema, ThrowOnError>>;
export interface FetchOptions<ThrowOnError extends boolean> {
  baseURL: string;
  throwOnError?: ThrowOnError;
}

class FetchClient<Schema extends HttpSchema, ThrowOnError extends boolean> {
  private _baseURL: string;
  private _throwOnError: boolean;

  private originalFetch = globalThis.fetch;

  constructor(options: FetchOptions<ThrowOnError>) {
    this._baseURL = options.baseURL;
    this._throwOnError = options.throwOnError ?? false;
  }

  baseURL() {
    return this._baseURL;
  }

  setBaseURL(baseURL: string) {
    this._baseURL = baseURL;
  }

  throwOnError() {
    return this._throwOnError;
  }

  setThrowOnError(throwOnError: boolean) {
    this._throwOnError = throwOnError;
  }

  fetch = async <Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    input: Path,
    init?: FetchRequestInit<Schema, Path, Method>,
  ): Promise<FetchResponse<Default<Schema[Path][Method]>, ThrowOnError>> => {
    const requestURL = joinURL(this._baseURL, input);
    const request = new Request(requestURL, init) as FetchRequest<Default<Schema[Path][Method]>>;

    const response = (await this.originalFetch(request)) as FetchResponse<Default<Schema[Path][Method]>, ThrowOnError>;

    if (this._throwOnError && !response.ok) {
      throw new FetchRequestError(request, response);
    }

    return response;
  };
}

export default FetchClient;
