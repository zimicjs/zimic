import { HttpSchema } from '@zimic/http';

import FetchClient from './FetchClient';
import { FetchOptions, Fetch as PublicFetch } from './types/public';

function createFetch<Schema extends HttpSchema>(
  options: FetchOptions<HttpSchema<Schema>>,
): PublicFetch<HttpSchema<Schema>> {
  const { fetch } = new FetchClient<HttpSchema<Schema>>(options);
  return fetch;
}

export default createFetch;
