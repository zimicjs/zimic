import { HttpSchema } from '@/http';
import { ConvertToStrictHttpSchema } from '@/http/types/schema';

import FetchClient from './FetchClient';
import { FetchClientOptions, Fetch as PublicFetch } from './types/public';

function createFetch<Schema extends HttpSchema>(
  options: FetchClientOptions<ConvertToStrictHttpSchema<Schema>>,
): PublicFetch<ConvertToStrictHttpSchema<Schema>> {
  const { fetch } = new FetchClient<ConvertToStrictHttpSchema<Schema>>(options);
  return fetch;
}

export default createFetch;
