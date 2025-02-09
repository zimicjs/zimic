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
} from '@/http';
import {
  HttpResponseBodySchema,
  HttpResponseHeadersSchema,
  HttpRequestBodySchema,
  HttpRequestHeadersSchema,
} from '@/interceptor/http/requestHandler/types/requests';
import { Default } from '@/types/utils';

import FetchResponseError from '../FetchResponseError';

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

export type FetchRequestInit<
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

export type FetchRequest<
  Path extends string,
  Method extends HttpMethod,
  MethodSchema extends HttpMethodSchema,
> = HttpRequest<HttpRequestBodySchema<MethodSchema>, HttpRequestHeadersSchema<MethodSchema>> & {
  path: Path;
  method: Method;
};

type FetchResponsePerStatusCode<
  Path extends string,
  Method extends HttpMethod,
  MethodSchema extends HttpMethodSchema,
  StatusCode extends HttpStatusCode,
> = HttpResponse<
  HttpResponseBodySchema<MethodSchema, StatusCode>,
  StatusCode,
  HttpResponseHeadersSchema<MethodSchema, StatusCode>
> &
  (StatusCode extends HttpStatusCode.ClientError | HttpStatusCode.ServerError
    ? { error: () => FetchResponseError<Path, Method, MethodSchema> }
    : { error: () => null });

export type FetchResponse<
  Path extends string,
  Method extends HttpMethod,
  MethodSchema extends HttpMethodSchema,
  IsError extends boolean = false,
  StatusCode extends FetchResponseStatusCode<MethodSchema, IsError> = FetchResponseStatusCode<MethodSchema, IsError>,
> = StatusCode extends StatusCode ? FetchResponsePerStatusCode<Path, Method, MethodSchema, StatusCode> : never;
