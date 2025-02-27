import { HttpSchema } from '@zimic/http';

import FetchClient from './FetchClient';
import { FetchOptions, Fetch } from './types/public';

/**
 * Creates to create a {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetch fetch instance} typed with an
 * HTTP schema, closely compatible with the
 * {@link https://developer.mozilla.org/docs/Web/API/Fetch_API native Fetch API}. All requests and responses are typed by
 * default with the schema, including methods, paths, status codes, parameters, and bodies.
 *
 * Requests sent by the fetch instance have their URL automatically prefixed with the base URL of the instance.
 * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetch.defaults Default options} are also applied to the
 * requests, if provided.
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
 *
 *       GET: {
 *         request: {
 *           searchParams: {
 *             query?: string;
 *             page?: number;
 *             limit?: number;
 *           };
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
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#createfetchoptions `createFetch(options)` API reference}
 */
function createFetch<Schema extends HttpSchema>(options: FetchOptions<Schema>): Fetch<Schema> {
  const { fetch } = new FetchClient<Schema>(options);
  return fetch;
}

export default createFetch;
