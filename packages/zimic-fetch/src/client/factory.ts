import { HttpSchema } from '@zimic/http';

import FetchClient from './FetchClient';
import { FetchOptions, Fetch } from './types/public';

function createFetch<Schema extends HttpSchema>(options: FetchOptions<Schema>): Fetch<Schema> {
  const { fetch } = new FetchClient<Schema>(options);
  return fetch;
}

export default createFetch;
