import { HttpSchema } from '@/http';

import FetchClient from './FetchClient';
import { FetchClientOptions, Fetch as PublicFetch } from './types/public';

function createFetch<Schema extends HttpSchema>(options: FetchClientOptions): PublicFetch<Schema> {
  const { fetch } = new FetchClient<Schema>(options);
  return fetch;
}

export default createFetch;
