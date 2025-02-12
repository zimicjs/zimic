import {
  HttpRequestSchema,
  HttpMethod,
  HttpSchema,
  HttpSchemaPath,
  HttpSchemaMethod,
  HttpMethodSchema,
  HttpResponseSchemaStatusCode,
  HttpStatusCode,
  HttpResponse,
  HttpRequest,
  HttpSearchParams,
} from '@/http';
import {
  HttpResponseBodySchema,
  HttpRequestBodySchema,
  HttpRequestHeadersSchema,
} from '@/interceptor/http/requestHandler/types/requests';
import { Default } from '@/types/utils';

import FetchResponseError, { AnyFetchRequestError } from '../errors/FetchResponseError';

type FetchRequestInitWithHeaders<RequestSchema extends HttpRequestSchema> = [RequestSchema['headers']] extends [never]
  ? { headers?: undefined }
  : undefined extends RequestSchema['headers']
    ? { headers?: undefined }
    : { headers: RequestSchema['headers'] };

type FetchRequestInitWithSearchParams<RequestSchema extends HttpRequestSchema> = [
  RequestSchema['searchParams'],
] extends [never]
  ? { searchParams?: undefined }
  : undefined extends RequestSchema['searchParams']
    ? { searchParams?: undefined }
    : { searchParams: RequestSchema['searchParams'] };

type FetchRequestInitWithBody<RequestSchema extends HttpRequestSchema> = [RequestSchema['body']] extends [never]
  ? { body?: null }
  : undefined extends RequestSchema['body']
    ? { body?: null }
    : { body: RequestSchema['body'] };

type FetchRequestInitPerPath<Method extends HttpMethod, RequestSchema extends HttpRequestSchema> = RequestInit & {
  baseURL?: string;
  method: Method;
} & FetchRequestInitWithHeaders<RequestSchema> &
  FetchRequestInitWithSearchParams<RequestSchema> &
  FetchRequestInitWithBody<RequestSchema>;

export type FetchRequestInit<
  Schema extends HttpSchema,
  Path extends HttpSchemaPath<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
> = Path extends Path ? FetchRequestInitPerPath<Method, Default<Default<Schema[Path][Method]>['request']>> : never;

export namespace FetchRequestInit {
  export interface Defaults extends RequestInit {
    baseURL: string;
    method?: HttpMethod;
    searchParams?: HttpSearchParams;
  }
}

type AllFetchResponseStatusCode<MethodSchema extends HttpMethodSchema> = HttpResponseSchemaStatusCode<
  Default<MethodSchema['response']>
>;

type FetchResponseStatusCode<MethodSchema extends HttpMethodSchema, IsError extends boolean> = IsError extends true
  ? AllFetchResponseStatusCode<MethodSchema> & (HttpStatusCode.ClientError | HttpStatusCode.ServerError)
  : AllFetchResponseStatusCode<MethodSchema>;

export interface FetchRequest<
  Path extends string = string,
  Method extends HttpMethod = HttpMethod,
  MethodSchema extends HttpMethodSchema = HttpMethodSchema,
> extends HttpRequest<HttpRequestBodySchema<MethodSchema>, HttpRequestHeadersSchema<MethodSchema>> {
  path: Path;
  method: Method;
}

export namespace FetchRequest {
  export interface Loose extends Request {
    path: string;
    method: HttpMethod;
  }
}

interface FetchResponsePerStatusCode<
  Path extends string = string,
  Method extends HttpMethod = HttpMethod,
  MethodSchema extends HttpMethodSchema = HttpMethodSchema,
  StatusCode extends HttpStatusCode = HttpStatusCode,
> extends HttpResponse<
    HttpResponseBodySchema<MethodSchema, StatusCode>,
    StatusCode,
    HttpRequestHeadersSchema<MethodSchema>
  > {
  request: FetchRequest<Path, Method, MethodSchema>;

  error: () => StatusCode extends HttpStatusCode.ClientError | HttpStatusCode.ServerError
    ? FetchResponseError<Path, Method, MethodSchema>
    : null;
}

export type FetchResponse<
  Path extends string = string,
  Method extends HttpMethod = HttpMethod,
  MethodSchema extends HttpMethodSchema = HttpMethodSchema,
  IsError extends boolean = false,
  StatusCode extends FetchResponseStatusCode<MethodSchema, IsError> = FetchResponseStatusCode<MethodSchema, IsError>,
> = StatusCode extends StatusCode ? FetchResponsePerStatusCode<Path, Method, MethodSchema, StatusCode> : never;

export namespace FetchResponse {
  export interface Loose extends Response {
    request: FetchRequest.Loose;

    error: () => AnyFetchRequestError | null;
  }
}
