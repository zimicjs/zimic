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
import { Default, IfNever } from '@/types/utils';

import FetchRequestError from '../FetchRequestError';

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
    : { error: () => null });

export type FetchRequest<MethodSchema extends HttpMethodSchema> = HttpRequest<
  HttpRequestBodySchema<MethodSchema>,
  HttpRequestHeadersSchema<MethodSchema>
>;

export type FetchResponse<
  MethodSchema extends HttpMethodSchema,
  IsError extends boolean = false,
  StatusCode extends FetchResponseStatusCode<MethodSchema, IsError> = FetchResponseStatusCode<MethodSchema, IsError>,
> = StatusCode extends StatusCode ? FetchResponsePerStatusCode<MethodSchema, StatusCode> : never;
