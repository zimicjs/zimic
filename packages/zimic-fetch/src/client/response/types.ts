import {
  HttpBody,
  HttpHeadersSchema,
  HttpHeadersSerialized,
  HttpMethodSchema,
  HttpResponseSchemaStatusCode,
  HttpStatusCode,
} from '@zimic/http';
import { Default } from '@zimic/utils/types';

import { FetchResponse } from './FetchResponse';

type AllFetchResponseStatusCode<MethodSchema extends HttpMethodSchema> = HttpResponseSchemaStatusCode<
  Default<MethodSchema['response']>
>;

type FilterFetchResponseStatusCodeByError<
  StatusCode extends HttpStatusCode,
  ErrorOnly extends boolean,
> = ErrorOnly extends true ? Extract<StatusCode, HttpStatusCode.ClientError | HttpStatusCode.ServerError> : StatusCode;

type FilterFetchResponseStatusCodeByRedirect<
  StatusCode extends HttpStatusCode,
  Redirect extends RequestRedirect,
> = Redirect extends 'error'
  ? FilterFetchResponseStatusCodeByRedirect<StatusCode, 'follow'>
  : Redirect extends 'follow'
    ? Exclude<StatusCode, Exclude<HttpStatusCode.Redirection, 304>>
    : StatusCode;

export type FetchResponseStatusCode<
  MethodSchema extends HttpMethodSchema,
  ErrorOnly extends boolean,
  Redirect extends RequestRedirect,
> = FilterFetchResponseStatusCodeByRedirect<
  FilterFetchResponseStatusCodeByError<AllFetchResponseStatusCode<MethodSchema>, ErrorOnly>,
  Redirect
>;

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject `error.toObject()`} */
export type FetchResponseObject = Pick<
  FetchResponse.Loose,
  'url' | 'type' | 'status' | 'statusText' | 'ok' | 'redirected'
> & {
  headers: HttpHeadersSerialized<HttpHeadersSchema>;
  body?: HttpBody | null;
};
