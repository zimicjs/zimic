import { HttpSchema } from '@zimic/http';

import FetchClient from './FetchClient';
import { FetchOptions, Fetch as PublicFetch } from './types/public';

function createFetch<Schema extends HttpSchema>(options: FetchOptions<Schema>): PublicFetch<Schema> {
  const { fetch } = new FetchClient<Schema>(options);
  return fetch;
}

export default createFetch;
