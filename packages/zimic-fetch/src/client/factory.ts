import { HttpSchema } from '@zimic/http';
import { assertTypeOf } from '@zimic/utils/validation';

import FetchClient from './FetchClient';
import { FetchOptions, Fetch } from './types/public';

/** @see {@link https://zimic.dev/docs/fetch/api/create-fetch `createFetch` API reference} */
function createFetch<Schema extends HttpSchema>(options: FetchOptions<Schema>): Fetch<Schema> {
  assertTypeOf('options.baseURL', options.baseURL, 'string');
  assertTypeOf('options.onRequest', options.onRequest, 'function', { optional: true });
  assertTypeOf('options.onResponse', options.onResponse, 'function', { optional: true });

  const { fetch } = new FetchClient<Schema>(options);
  return fetch;
}

export default createFetch;
