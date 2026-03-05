import {
  HttpHeadersSchema,
  HttpHeadersInit,
  HttpSearchParamsSchema,
  HttpSearchParamsInit,
  HttpRequestSchema,
  HttpSearchParams,
  HttpFormData,
  HttpBody,
  HttpMethodSchema,
  HttpRequestHeadersSchema,
  HttpRequestSearchParamsSchema,
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpHeadersSerialized,
} from '@zimic/http';
import { Default, JSONStringified, UnionToIntersection, IndexUnion } from '@zimic/utils/types';

import { FetchRequest } from './FetchRequest';

export type FetchRequestInitWithHeaders<HeadersSchema extends HttpHeadersSchema | undefined> = [HeadersSchema] extends [
  never,
]
  ? { headers?: undefined }
  : undefined extends HeadersSchema
    ? { headers?: HttpHeadersInit<Default<HeadersSchema>> }
    : { headers: HttpHeadersInit<Default<HeadersSchema>> };

type FetchRequestInitWithSearchParams<SearchParamsSchema extends HttpSearchParamsSchema | undefined> = [
  SearchParamsSchema,
] extends [never]
  ? { searchParams?: undefined }
  : undefined extends SearchParamsSchema
    ? { searchParams?: HttpSearchParamsInit<Default<SearchParamsSchema>> }
    : { searchParams: HttpSearchParamsInit<Default<SearchParamsSchema>> };

export type FetchRequestBodySchema<RequestSchema extends HttpRequestSchema> = 'body' extends keyof RequestSchema
  ? [RequestSchema['body']] extends [never]
    ? null | undefined
    : [Extract<RequestSchema['body'], BodyInit | HttpSearchParams | HttpFormData>] extends [never]
      ? undefined extends RequestSchema['body']
        ? JSONStringified<Exclude<RequestSchema['body'], null | undefined>> | null | undefined
        : JSONStringified<Exclude<RequestSchema['body'], null>> | Extract<RequestSchema['body'], null>
      : undefined extends RequestSchema['body']
        ? RequestSchema['body']
        : RequestSchema['body']
  : null | undefined;

export type FetchRequestInitWithBody<BodySchema extends HttpBody> = [BodySchema] extends [never]
  ? { body?: BodySchema }
  : undefined extends BodySchema
    ? { body?: BodySchema }
    : { body: BodySchema };

type FetchRequestInitPerPath<MethodSchema extends HttpMethodSchema> = FetchRequestInitWithHeaders<
  HttpRequestHeadersSchema<MethodSchema>
> &
  FetchRequestInitWithSearchParams<HttpRequestSearchParamsSchema<MethodSchema>> &
  FetchRequestInitWithBody<FetchRequestBodySchema<Default<MethodSchema['request']>>>;

/** @see {@link https://zimic.dev/docs/fetch/api/fetch `fetch` API reference} */
export type FetchRequestInit<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  Redirect extends RequestRedirect = 'follow',
> = Omit<RequestInit, 'method' | 'headers' | 'body'> & {
  method: Method;
  baseURL?: string;
  redirect?: Redirect;
  duplex?: 'half';
} & (Path extends Path ? FetchRequestInitPerPath<Default<Schema[Path][Method]>> : never);

export namespace FetchRequestInit {
  type DefaultHeadersSchema<Schema extends HttpSchema> = {
    [Path in HttpSchemaPath.Literal<Schema>]: {
      [Method in keyof Schema[Path]]: HttpRequestHeadersSchema<Default<Schema[Path][Method]>>;
    }[keyof Schema[Path]];
  }[HttpSchemaPath.Literal<Schema>];

  export type DefaultHeaders<Schema extends HttpSchema> = {
    [HeaderName in keyof UnionToIntersection<Default<DefaultHeadersSchema<Schema>>>]?: IndexUnion<
      DefaultHeadersSchema<Schema>,
      HeaderName
    >;
  };

  type DefaultSearchParamsSchema<Schema extends HttpSchema> = {
    [Path in HttpSchemaPath.Literal<Schema>]: {
      [Method in keyof Schema[Path]]: HttpRequestSearchParamsSchema<Default<Schema[Path][Method]>>;
    }[keyof Schema[Path]];
  }[HttpSchemaPath.Literal<Schema>];

  export type DefaultSearchParams<Schema extends HttpSchema> = {
    [SearchParamName in keyof UnionToIntersection<Default<DefaultSearchParamsSchema<Schema>>>]?: IndexUnion<
      DefaultSearchParamsSchema<Schema>,
      SearchParamName
    >;
  };

  export type DefaultBody<Schema extends HttpSchema> = {
    [Path in HttpSchemaPath.Literal<Schema>]: {
      [Method in keyof Schema[Path]]: FetchRequestBodySchema<
        Default<Schema[Path][Method]> extends HttpMethodSchema
          ? Default<Default<Schema[Path][Method]>['request']>
          : never
      >;
    }[keyof Schema[Path]];
  }[HttpSchemaPath.Literal<Schema>];

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch#fetch-defaults `fetch` defaults API reference} */
  export interface Defaults<Schema extends HttpSchema = HttpSchema> extends Omit<RequestInit, 'headers' | 'body'> {
    baseURL: string;
    headers?: DefaultHeaders<Schema>;
    searchParams?: DefaultSearchParams<Schema>;
    body?: DefaultBody<Schema>;
    duplex?: 'half';
  }

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch `fetch` API reference} */
  export type Loose = Partial<Defaults>;
}

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-request#errortoobject `request.toObject()` API reference} */
export interface FetchRequestObjectOptions {
  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-request#errortoobject `request.toObject()` API reference} */
  includeBody?: boolean;
}

export namespace FetchRequestObjectOptions {
  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-request#errortoobject `request.toObject()` API reference} */
  export interface WithBody {
    includeBody: true;
  }

  /** @see {@link https://zimic.dev/docs/fetch/api/fetch-request#errortoobject `request.toObject()` API reference} */
  export interface WithoutBody {
    includeBody?: false;
  }
}

/** @see {@link https://zimic.dev/docs/fetch/api/fetch-request#requesttoobject `request.toObject()`} */
export type FetchRequestObject = Pick<
  FetchRequest.Loose,
  | 'url'
  | 'path'
  | 'method'
  | 'cache'
  | 'destination'
  | 'credentials'
  | 'integrity'
  | 'keepalive'
  | 'mode'
  | 'redirect'
  | 'referrer'
  | 'referrerPolicy'
> & {
  headers: HttpHeadersSerialized<HttpHeadersSchema>;
  body?: HttpBody | null;
};
