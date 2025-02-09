import { HttpSchema } from '@/http';

import FetchClient from './FetchClient';
import { FetchClientOptions, FetchClient as PublicFetchClient } from './types/public';

function createFetch<Schema extends HttpSchema>(options: FetchClientOptions): PublicFetchClient<Schema> {
  return new FetchClient<Schema>(options);
}

export default createFetch;
