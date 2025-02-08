import { HttpSchema } from '@/http';

import FetchClient, { FetchOptions } from './FetchClient';

function createFetch<Schema extends HttpSchema>(options: FetchOptions<true>): FetchClient<Schema, true>;
function createFetch<Schema extends HttpSchema>(options: FetchOptions<false>): FetchClient<Schema, false>;
function createFetch<Schema extends HttpSchema>(options: FetchOptions<boolean>): FetchClient<Schema, boolean> {
  return new FetchClient<Schema, boolean>(options);
}

export default createFetch;
