import { HttpSchemaPath, HttpSchemaMethod, LiteralHttpSchemaPathFromNonLiteral, HttpSchema } from '@zimic/http';
import { PossiblePromise, RequiredByKey } from '@zimic/utils/types';

import FetchResponseError from '../errors/FetchResponseError';
import { FetchRequest, FetchRequestConstructor, FetchRequestInit, FetchResponse } from './requests';

/**
 * The input to fetch a resource, either a path, a URL, or a {@link FetchRequest request}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetch `fetch` API reference}
 */
export type FetchInput<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.NonLiteral<Schema, Method>,
> = Path | URL | FetchRequest<Schema, Method, LiteralHttpSchemaPathFromNonLiteral<Schema, Method, Path>>;

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
 *   interface User {
 *     id: string;
 *     username: string;
 *   }
 *
 *   type Schema = HttpSchema<{
 *     '/users': {
 *       GET: {
 *         request: {
 *           searchParams: { query?: string };
 *         };
 *         response: {
 *           200: { body: User[] };
 *           404: { body: { message: string } };
 *           500: { body: { message: string } };
 *         };
 *       };
 *     };
 *   }>;
 *
 *   const fetch = createFetch<Schema>({
 *     baseURL: 'http://localhost:3000',
 *     headers: { 'accept-language': 'en' },
 *   });
 *
 *   const response = await fetch('/users', {
 *     method: 'GET',
 *     searchParams: { query: 'u' },
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
 *   return users; // User[]
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
export interface Fetch<Schema extends HttpSchema> extends Pick<FetchOptions<Schema>, 'onRequest' | 'onResponse'> {
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

  /**
   * The default options for each request sent by the fetch instance. The available options are the same as the
   * {@link https://developer.mozilla.org/docs/Web/API/RequestInit `RequestInit`} options, plus `baseURL`.
   *
   * @example
   *   import { type HttpSchema } from '@zimic/http';
   *   import { createFetch } from '@zimic/fetch';
   *
   *   interface Post {
   *     id: string;
   *     title: string;
   *   }
   *
   *   type Schema = HttpSchema<{
   *     '/posts': {
   *       POST: {
   *         request: {
   *           headers: { 'content-type': 'application/json' };
   *           body: { title: string };
   *         };
   *         response: {
   *           201: { body: Post };
   *         };
   *       };
   *     };
   *   }>;
   *
   *   const fetch = createFetch<Schema>({
   *     baseURL: 'http://localhost:3000',
   *     headers: { 'accept-language': 'en' },
   *   });
   *
   *   // Set the authorization header for all requests
   *   const { accessToken } = await authenticate();
   *
   *   fetch.defaults.headers.authorization = `Bearer ${accessToken}`;
   *   console.log(fetch.defaults.headers);
   *
   *   const response = await fetch('/posts', {
   *     method: 'POST',
   *     headers: { 'content-type': 'application/json' },
   *     body: JSON.stringify({ title: 'My post' }),
   *   });
   *
   *   const post = await response.json(); // Post
   */
  defaults: FetchDefaults;

  /**
   * A loosely-typed version of {@link Fetch `fetch`}. This can be useful to make requests with fewer type constraints,
   * such as in {@link onRequest `onRequest`} and {@link onResponse `onResponse`} listeners.
   *
   * @example
   *   import { type HttpSchema } from '@zimic/http';
   *   import { createFetch } from '@zimic/fetch';
   *
   *   interface User {
   *     id: string;
   *     username: string;
   *   }
   *
   *   type Schema = HttpSchema<{
   *     '/auth/login': {
   *       POST: {
   *         request: {
   *           headers: { 'content-type': 'application/json' };
   *           body: { username: string; password: string };
   *         };
   *         response: {
   *           201: { body: { accessToken: string } };
   *         };
   *       };
   *     };
   *
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
   *
   *     async onResponse(response) {
   *       if (response.status === 401) {
   *         const body = await response.clone().json();
   *
   *         if (body.message === 'Access token expired') {
   *           // Refresh the access token
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
   *   // Authenticate to your service before requests
   *   const loginRequest = await fetch('/auth/login', {
   *     method: 'POST',
   *     headers: { 'content-type': 'application/json' },
   *     body: JSON.stringify({ username: 'me', password: 'password' }),
   *   });
   *   const { accessToken } = await loginRequest.json();
   *
   *   // Set the authorization header for all requests
   *   fetch.defaults.headers.authorization = `Bearer ${accessToken}`;
   *
   *   const request = await fetch('/users', {
   *     method: 'GET',
   *     searchParams: { query: 'u' },
   *   });
   *
   *   const users = await request.json(); // User[]
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
  loose: Fetch.Loose;

  /**
   * A constructor for creating
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchrequest-1 `FetchRequest`}, closely compatible with
   * the native {@link https://developer.mozilla.org/docs/Web/API/Request Request} constructor.
   *
   * @example
   *   import { type HttpSchema } from '@zimic/http';
   *   import { createFetch } from '@zimic/fetch';
   *
   *   interface User {
   *     id: string;
   *     username: string;
   *   }
   *
   *   type Schema = HttpSchema<{
   *     '/users': {
   *       POST: {
   *         request: {
   *           headers: { 'content-type': 'application/json' };
   *           body: { username: string };
   *         };
   *         response: {
   *           201: { body: User };
   *         };
   *       };
   *     };
   *   }>;
   *
   *   const fetch = createFetch<Schema>({
   *     baseURL: 'http://localhost:3000',
   *   });
   *
   *   const request = new fetch.Request('/users', {
   *     method: 'POST',
   *     headers: { 'content-type': 'application/json' },
   *     body: JSON.stringify({ username: 'me' }),
   *   });
   *
   *   console.log(request); // FetchRequest<Schema, 'POST', '/users'>
   *   console.log(request.path); // '/users'
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchrequest-1 `FetchRequest`}
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
   *   interface User {
   *     id: string;
   *     username: string;
   *   }
   *
   *   type Schema = HttpSchema<{
   *     '/users': {
   *       POST: {
   *         request: {
   *           headers: { 'content-type': 'application/json' };
   *           body: { username: string };
   *         };
   *         response: {
   *           201: { body: User };
   *         };
   *       };
   *     };
   *   }>;
   *
   *   const fetch = createFetch<Schema>({
   *     baseURL: 'http://localhost:3000',
   *   });
   *
   *   const request = new fetch.Request('/users', {
   *     method: 'POST',
   *     headers: { 'content-type': 'application/json' },
   *     body: JSON.stringify({ username: 'me' }),
   *   });
   *
   *   if (fetch.isRequest(request, 'POST', '/users')) {
   *     // request is a FetchRequest<Schema, 'POST', '/users'>
   *
   *     const contentType = request.headers.get('content-type'); // 'application/json'
   *     const body = await request.json(); // { username: string }
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
   *   interface User {
   *     id: string;
   *     username: string;
   *   }
   *
   *   type Schema = HttpSchema<{
   *     '/users': {
   *       GET: {
   *         request: {
   *           searchParams: { query?: string };
   *         };
   *         response: {
   *           200: { body: User[] };
   *         };
   *       };
   *     };
   *   }>;
   *
   *   const fetch = createFetch<Schema>({
   *     baseURL: 'http://localhost:3000',
   *   });
   *
   *   const response = await fetch('/users', {
   *     method: 'GET',
   *     searchParams: { query: 'u' },
   *   });
   *
   *   if (fetch.isResponse(response, 'GET', '/users')) {
   *     // response is a FetchResponse<Schema, 'GET', '/users'>
   *
   *     const users = await response.json(); // User[]
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
   *   interface User {
   *     id: string;
   *     username: string;
   *   }
   *
   *   type Schema = HttpSchema<{
   *     '/users': {
   *       GET: {
   *         request: {
   *           searchParams: { query?: string };
   *         };
   *         response: {
   *           200: { body: User[] };
   *           400: { body: { message: string } };
   *           500: { body: { message: string } };
   *         };
   *       };
   *     };
   *   }>;
   *
   *   const fetch = createFetch<Schema>({
   *     baseURL: 'http://localhost:3000',
   *   });
   *
   *   try {
   *     const response = await fetch('/users', {
   *       method: 'GET',
   *       searchParams: { query: 'u' },
   *     });
   *
   *     if (!response.ok) {
   *       throw response.error; // FetchResponseError<Schema, 'GET', '/users'>
   *     }
   *   } catch (error) {
   *     if (fetch.isResponseError(error, 'GET', '/users')) {
   *       // error is a FetchResponseError<Schema, 'GET', '/users'>
   *
   *       const status = error.response.status; // 400 | 500
   *       const { message } = await error.response.json(); // { message: string }
   *
   *       console.error('Could not fetch users:', { status, message });
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

export namespace Fetch {
  /** A loosely-typed version of {@link Fetch `fetch`}. This can be useful to make requests with fewer type constraints, */
  export type Loose = (
    input: string | URL | FetchRequest.Loose,
    init?: FetchRequestInit.Loose,
  ) => Promise<FetchResponse.Loose>;
}

/**
 * The options to create a {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetch fetch instance}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#createfetch `createFetch(options)` API reference}
 */
export interface FetchOptions<Schema extends HttpSchema> extends Omit<FetchRequestInit.Defaults, 'method'> {
  /**
   * A listener function that is called for each request. It can modify the requests before they are sent.
   *
   * @example
   *   import { createFetch } from '@zimic/fetch';
   *   import { type HttpSchema } from '@zimic/http';
   *
   *   interface User {
   *     id: string;
   *     username: string;
   *   }
   *
   *   type Schema = HttpSchema<{
   *     '/users': {
   *       GET: {
   *         request: {
   *           searchParams: { page?: number; limit?: number };
   *         };
   *         response: {
   *           200: { body: User[] };
   *         };
   *       };
   *     };
   *   }>;
   *
   *   const fetch = createFetch<Schema>({
   *     baseURL: 'http://localhost:80',
   *
   *     onRequest(request) {
   *       if (this.isRequest(request, 'GET', '/users')) {
   *         const url = new URL(request.url);
   *         url.searchParams.append('limit', '10');
   *
   *         const updatedRequest = new Request(url, request);
   *         return updatedRequest;
   *       }
   *
   *       return request;
   *     },
   *   });
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
   *   import { type HttpSchema } from '@zimic/http';
   *   import { createFetch } from '@zimic/fetch';
   *
   *   interface User {
   *     id: string;
   *     username: string;
   *   }
   *
   *   type Schema = HttpSchema<{
   *     '/users': {
   *       GET: {
   *         response: {
   *           200: {
   *             headers: { 'content-encoding'?: string };
   *             body: User[];
   *           };
   *         };
   *       };
   *     };
   *   }>;
   *
   *   const fetch = createFetch<Schema>({
   *     baseURL: 'http://localhost:80',
   *
   *     onResponse(response) {
   *       if (this.isResponse(response, 'GET', '/users')) {
   *         console.log(response.headers.get('content-encoding'));
   *       }
   *       return response;
   *     },
   *   });
   *
   * @param response The original response.
   * @returns The response to be returned.
   * @this {Fetch<Schema>} The fetch instance that received the response.
   */
  onResponse?: (this: Fetch<Schema>, response: FetchResponse.Loose) => PossiblePromise<Response>;
}

/**
 * The default options for each request sent by the fetch instance.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchdefaults `fetch.defaults` API reference}
 */
export type FetchDefaults = RequiredByKey<FetchRequestInit.Defaults, 'headers' | 'searchParams'>;

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
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetch `fetch` API reference}
 */
export type InferFetchSchema<FetchInstance> = FetchInstance extends Fetch<infer Schema> ? Schema : never;
