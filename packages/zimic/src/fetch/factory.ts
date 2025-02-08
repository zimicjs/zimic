import { HttpSchema } from '@/http';

import FetchClient, { FetchOptions } from './FetchClient';

function createFetchClient<Schema extends HttpSchema>(options: FetchOptions): FetchClient<Schema> {
  return new FetchClient<Schema>(options);
}

export default createFetchClient;
