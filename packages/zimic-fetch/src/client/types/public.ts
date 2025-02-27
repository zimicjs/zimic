import { HttpSchemaPath, HttpSchemaMethod, LiteralHttpSchemaPathFromNonLiteral, HttpSchema } from '@zimic/http';
import { PossiblePromise, RequiredByKey } from '@zimic/utils/types';

import FetchResponseError from '../errors/FetchResponseError';
import { FetchRequest, FetchRequestConstructor, FetchRequestInit, FetchResponse } from './requests';

/** The input to fetch a resource, either a path, a URL, or a {@link FetchRequest request}. */
export type FetchInput<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
> = Path | URL | FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>;

export interface FetchFunction<Schema extends HttpSchema> {
  <
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
    Redirect extends RequestRedirect = 'follow',
  >(
    input: Path | URL,
    init: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Redirect>,
  ): Promise<FetchResponse<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, false, Redirect>>;

  <
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
    Redirect extends RequestRedirect = 'follow',
  >(
    input: FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>,
    init?: FetchRequestInit<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, Redirect>,
  ): Promise<FetchResponse<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>, false, Redirect>>;
}

export namespace FetchFunction {
  export type Loose = (
    input: string | URL | FetchRequest.Loose,
    init?: FetchRequestInit.Loose,
  ) => Promise<FetchResponse.Loose>;
}

/**
 * The options to create a {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetch fetch instance}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#createfetchoptions `createFetch(options)` API reference}
 */
export interface FetchOptions<Schema extends HttpSchema> extends Omit<FetchRequestInit.Defaults, 'method'> {
  /**
   * A listener function that is called for each request. It can modify the requests before they are sent.
   *
   * @example
   *   import { createFetch } from '@zimic/fetch';
   *
   *   const fetch = createFetch<MySchema>({
   *     baseURL: 'http://localhost:3000',
   *   });
   *
   *   fetch.onRequest = function (request) {
   *     if (this.isRequest(request, 'GET', '/users')) {
   *       request.searchParams.set('limit', '10');
   *     }
   *     return request;
   *   };
   *
   * @param request The original request.
   * @returns The request to be sent. It can be the original request or a modified version of it.
   * @this {Fetch<Schema>} The fetch instance that is sending the request.
   */
  onRequest?: (this: Fetch<Schema>, request: FetchRequest.Loose) => PossiblePromise<Request>;

  /**
   * A listener function that is called after each response is received. It can modify the responses before they are
   * returned to the fetch caller.
   *
   * @example
   *   import { createFetch } from '@zimic/fetch';
   *
   *   const fetch = createFetch<MySchema>({
   *     baseURL: 'http://localhost:3000',
   *   });
   *
   *   fetch.onResponse = function (response) {
   *     const updatedHeaders = new Headers(response.headers);
   *     updatedHeaders.set('content-language', 'en');
   *
   *     const updatedResponse = new Response(response.body, {
   *       status: response.status,
   *       statusText: response.statusText,
   *       headers: updatedHeaders,
   *     });
   *
   *     return updatedResponse;
   *   };
   *
   * @param response The original response.
   * @returns The response to be returned.
   * @this {Fetch<Schema>} The fetch instance that received the response.
   */
  onResponse?: (this: Fetch<Schema>, response: FetchResponse.Loose) => PossiblePromise<Response>;
}

/** The default options for each request sent by the fetch instance. */
export type FetchDefaults = RequiredByKey<FetchRequestInit.Defaults, 'headers' | 'searchParams'>;

export interface FetchClient<Schema extends HttpSchema> extends Pick<FetchOptions<Schema>, 'onRequest' | 'onResponse'> {
  /** The default options for each request sent by the fetch instance. */
  defaults: FetchDefaults;

  /**
   * A loosely-typed version of the {@link Fetch fetch instance}. This can be useful to make requests with fewer type
   * constraints, such as in {@link onRequest `onRequest`} and {@link onResponse `onResponse`} listeners.
   *
   * @example
   *   type Schema = HttpSchema<{
   *     '/auth/refresh': {
   *       POST: {
   *         response: {
   *           201: { body: { accessToken: string } };
   *         };
   *       };
   *     };
   *
   *     '/users': {
   *       GET: {
   *         request: {
   *           headers: { authorization: string };
   *         };
   *         response: {
   *           200: { body: User[] };
   *           401: { body: { message: string } };
   *           403: { body: { message: string } };
   *         };
   *       };
   *     };
   *   }>;
   *
   *   const fetch = createFetch<Schema>({
   *     baseURL,
   *     onResponse(response) {
   *       if (response.status === 401) {
   *         const data = (await response.clone().json()) as unknown;
   *
   *         if (data.message === 'Access token expired') {
   *           const refreshResponse = await this('/auth/refresh', { method: 'POST' });
   *           const { accessToken } = await refreshResponse.json();
   *
   *           // Clone the original request and update its headers
   *           const updatedRequest = response.request.clone();
   *           updatedRequest.headers.set('authorization', `Bearer ${accessToken}`);
   *
   *           // Retry the original request with the updated headers
   *           return this.loose(updatedRequest);
   *         }
   *       }
   *
   *       return response;
   *     },
   *   });
   *
   * @param input The resource to fetch, either a path, a URL, or a {@link FetchRequest request}. If a path is provided,
   *   it is automatically prefixed with the base URL of the fetch instance when the request is sent. If a URL or a
   *   request is provided, it is used as is.
   * @param init The request options. If a path or a URL is provided as the first argument, this argument is required
   *   and should contain at least the method of the request. If the first argument is a {@link FetchRequest request},
   *   this argument is optional.
   * @returns A promise that resolves to the response to the request.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchloose `fetch.loose` API reference}
   * @see {@link https://developer.mozilla.org/docs/Web/API/Fetch_API}
   * @see {@link https://developer.mozilla.org/docs/Web/API/Request}
   * @see {@link https://developer.mozilla.org/docs/Web/API/RequestInit}
   * @see {@link https://developer.mozilla.org/docs/Web/API/Response}
   */
  loose: FetchFunction.Loose;

  /**
   * A constructor for creating requests, closely compatible with the native {@link Request} constructor.
   *
   * Requests created by this constructor have their URL automatically prefixed with the base URL of the fetch instance.
   * Default options are also applied to the requests, if present in the instance.
   */
  Request: FetchRequestConstructor<Schema>;

  /**
   * A type guard that checks if a request is a {@link FetchRequest}, was created by the fetch instance, and has a
   * specific method and path. This is useful to narrow down the type of a request before using it.
   *
   * @example
   *   import { type HttpSchema } from '@zimic/http';
   *   import { createFetch } from '@zimic/fetch';
   *
   *   type MySchema = HttpSchema<{
   *     // ...
   *   }>;
   *
   *   const fetch = createFetch<MySchema>({
   *     baseURL: 'http://localhost:3000',
   *   });
   *
   *   const request = new fetch.Request('POST', '/users', {
   *     body: JSON.stringify({ username: 'my-user' }),
   *   });
   *
   *   if (fetch.isRequest(request, 'POST', '/users')) {
   *     // request is a FetchRequest<MySchema, 'POST', '/users'>
   *   }
   *
   * @param request The request to check.
   * @param method The method to check.
   * @param path The path to check.
   * @returns `true` if the request was created by the fetch instance and has the specified method and path; `false`
   *   otherwise.
   */
  isRequest: <Method extends HttpSchemaMethod<Schema>, Path extends HttpSchemaPath.Literal<Schema, Method>>(
    request: unknown,
    method: Method,
    path: Path,
  ) => request is FetchRequest<Schema, Method, Path>;

  /**
   * A type guard that checks if a response is a {@link FetchResponse}, was received by the fetch instance, and has a
   * specific method and path. This is useful to narrow down the type of a response before using it.
   *
   * @example
   *   import { type HttpSchema } from '@zimic/http';
   *   import { createFetch } from '@zimic/fetch';
   *
   *   type MySchema = HttpSchema<{
   *     // ...
   *   }>;
   *
   *   const fetch = createFetch<MySchema>({
   *     baseURL: 'http://localhost:3000',
   *   });
   *
   *   const response = await fetch('/users', {
   *     method: 'GET',
   *     searchParams: { username: 'my', limit: '10' },
   *   });
   *
   *   if (fetch.isResponse(response, 'GET', '/users')) {
   *     // response is a FetchResponse<MySchema, 'GET', '/users'>
   *   }
   *
   * @param response The response to check.
   * @param method The method to check.
   * @param path The path to check.
   * @returns `true` if the response was received by the fetch instance and has the specified method and path; `false`
   *   otherwise.
   */
  isResponse: <Method extends HttpSchemaMethod<Schema>, Path extends HttpSchemaPath.Literal<Schema, Method>>(
    response: unknown,
    method: Method,
    path: Path,
  ) => response is FetchResponse<Schema, Method, Path>;

  /**
   * A type guard that checks if an error is a {@link FetchResponseError} related to a {@link FetchResponse response}
   * received by the fetch instance with a specific method and path. This is useful to narrow down the type of an error
   * before handling it.
   *
   * @example
   *   import { type HttpSchema } from '@zimic/http';
   *   import { createFetch } from '@zimic/fetch';
   *
   *   type MySchema = HttpSchema<{
   *     // ...
   *   }>;
   *
   *   const fetch = createFetch<MySchema>({
   *     baseURL: 'http://localhost:3000',
   *   });
   *
   *   try {
   *     await fetch('/users', {
   *       method: 'GET',
   *       searchParams: { username: 'my', limit: '10' },
   *     });
   *
   *     if (!response.ok) {
   *       throw response.error;
   *     }
   *   } catch (error) {
   *     if (fetch.isResponseError(error, 'GET', '/users')) {
   *       // error is a FetchResponseError<MySchema, 'GET', '/users'>
   *     }
   *   }
   *
   * @param error The error to check.
   * @param method The method to check.
   * @param path The path to check.
   * @returns `true` if the error is a response error received by the fetch instance and has the specified method and
   *   path; `false` otherwise.
   */
  isResponseError: <Method extends HttpSchemaMethod<Schema>, Path extends HttpSchemaPath.Literal<Schema, Method>>(
    error: unknown,
    method: Method,
    path: Path,
  ) => error is FetchResponseError<Schema, Method, Path>;
}

/**
 * A fetch instance typed with an HTTP schema, closely compatible with the
 * {@link https://developer.mozilla.org/docs/Web/API/Fetch_API native Fetch API}. All requests and responses are typed by
 * default with the schema, including methods, paths, status codes, parameters, and bodies.
 *
 * Requests sent by the fetch instance have their URL automatically prefixed with the base URL of the instance. Default
 * options are also applied to the requests, if present in the instance.
 *
 * @example
 *   import { type HttpSchema } from '@zimic/http';
 *   import { createFetch } from '@zimic/fetch';
 *
 *   type MySchema = HttpSchema<{
 *     // ...
 *   }>;
 *
 *   const fetch = createFetch<MySchema>({
 *     baseURL: 'http://localhost:3000',
 *   });
 *
 *   const response = await fetch('/users', {
 *     method: 'GET',
 *     searchParams: { username: 'my', limit: '10' },
 *   });
 *
 *   if (response.status === 404) {
 *     return null; // User not found
 *   }
 *
 *   if (!response.ok) {
 *     throw response.error;
 *   }
 *
 *   const users = await response.json();
 *   return users; // [{ username: 'my-user' }]
 *
 * @param input The resource to fetch, either a path, a URL, or a {@link FetchRequest request}. If a path is provided, it
 *   is automatically prefixed with the base URL of the fetch instance when the request is sent. If a URL or a request
 *   is provided, it is used as is.
 * @param init The request options. If a path or a URL is provided as the first argument, this argument is required and
 *   should contain at least the method of the request. If the first argument is a {@link FetchRequest request}, this
 *   argument is optional.
 * @returns A promise that resolves to the response to the request.
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetch `fetch` API reference}
 * @see {@link https://developer.mozilla.org/docs/Web/API/Fetch_API}
 * @see {@link https://developer.mozilla.org/docs/Web/API/Request}
 * @see {@link https://developer.mozilla.org/docs/Web/API/RequestInit}
 * @see {@link https://developer.mozilla.org/docs/Web/API/Response}
 */
export type Fetch<Schema extends HttpSchema> = FetchFunction<Schema> & FetchClient<Schema>;

/**
 * Infers the schema of a {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetch fetch instance}.
 *
 * @example
 *   import { type HttpSchema } from '@zimic/http';
 *   import { createFetch, InferFetchSchema } from '@zimic/fetch';
 *
 *   const fetch = createFetch<{
 *     '/users': {
 *       GET: {
 *         response: { 200: { body: User[] } };
 *       };
 *     };
 *   }>({
 *     baseURL: 'http://localhost:3000',
 *   });
 *
 *   type Schema = InferFetchSchema<typeof fetch>;
 *   // {
 *   //   '/users': {
 *   //     GET: {
 *   //      response: { 200: { body: User[] } };
 *   //    };
 *   // };
 *   // }
 */
export type InferFetchSchema<FetchInstance> = FetchInstance extends Fetch<infer Schema> ? Schema : never;
