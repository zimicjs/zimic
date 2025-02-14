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
  HttpHeaders,
} from '@/http';
import { AllowAnyStringInPathParams, LiteralHttpSchemaPathFromNonLiteral } from '@/http/types/schema';
import {
  HttpResponseBodySchema,
  HttpRequestBodySchema,
  HttpRequestHeadersSchema,
  HttpResponseHeadersSchema,
} from '@/interceptor/http/requestHandler/types/requests';
import { Default } from '@/types/utils';

import FetchResponseError, { AnyFetchRequestError } from '../errors/FetchResponseError';
import { FetchInput } from './public';

type FetchRequestInitWithHeaders<RequestSchema extends HttpRequestSchema> = [RequestSchema['headers']] extends [never]
  ? { headers?: undefined }
  : undefined extends RequestSchema['headers']
    ? { headers?: undefined }
    : { headers: RequestSchema['headers'] | HttpHeaders<Default<RequestSchema['headers']>> };

type FetchRequestInitWithSearchParams<RequestSchema extends HttpRequestSchema> = [
  RequestSchema['searchParams'],
] extends [never]
  ? { searchParams?: undefined }
  : undefined extends RequestSchema['searchParams']
    ? { searchParams?: undefined }
    : { searchParams: RequestSchema['searchParams'] | HttpSearchParams<Default<RequestSchema['searchParams']>> };

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

type FetchResponseStatusCode<MethodSchema extends HttpMethodSchema, ErrorOnly extends boolean> = ErrorOnly extends true
  ? AllFetchResponseStatusCode<MethodSchema> & (HttpStatusCode.ClientError | HttpStatusCode.ServerError)
  : AllFetchResponseStatusCode<MethodSchema>;

export interface FetchRequest<
  Path extends string = string,
  Method extends HttpMethod = HttpMethod,
  MethodSchema extends HttpMethodSchema = HttpMethodSchema,
> extends HttpRequest<HttpRequestBodySchema<MethodSchema>, HttpRequestHeadersSchema<MethodSchema>> {
  path: AllowAnyStringInPathParams<Path>;
  method: Method;
}

export namespace FetchRequest {
  export interface Loose extends Request {
    path: string;
    method: HttpMethod;
  }
}

export interface FetchResponsePerStatusCode<
  Path extends string = string,
  Method extends HttpMethod = HttpMethod,
  MethodSchema extends HttpMethodSchema = HttpMethodSchema,
  StatusCode extends HttpStatusCode = HttpStatusCode,
> extends HttpResponse<
    HttpResponseBodySchema<MethodSchema, StatusCode>,
    StatusCode,
    HttpResponseHeadersSchema<MethodSchema, StatusCode>
  > {
  request: FetchRequest<Path, Method, MethodSchema>;

  error: StatusCode extends HttpStatusCode.ClientError | HttpStatusCode.ServerError
    ? FetchResponseError<Path, Method, MethodSchema>
    : null;
}

export type FetchResponse<
  Path extends string = string,
  Method extends HttpMethod = HttpMethod,
  MethodSchema extends HttpMethodSchema = HttpMethodSchema,
  ErrorOnly extends boolean = false,
  StatusCode extends FetchResponseStatusCode<MethodSchema, ErrorOnly> = FetchResponseStatusCode<
    MethodSchema,
    ErrorOnly
  >,
> = StatusCode extends StatusCode ? FetchResponsePerStatusCode<Path, Method, MethodSchema, StatusCode> : never;

export namespace FetchResponse {
  export interface Loose extends Response {
    request: FetchRequest.Loose;

    error: AnyFetchRequestError | null;
  }
}

export type FetchRequestConstructor<Schema extends HttpSchema> = new <
  Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
>(
  input: FetchInput<Schema, Path, Method>,
  init: FetchRequestInit<Schema, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Method>,
) => FetchRequest<
  LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>,
  Method,
  Default<Schema[LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>][Method]>
>;
