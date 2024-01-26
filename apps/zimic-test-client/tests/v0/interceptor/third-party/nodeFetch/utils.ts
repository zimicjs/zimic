import fetch from 'node-fetch';

import { convertHeadersToObject, convertObjectToHeaders } from '@tests/utils/headers';

export async function nodeFetchAsFetch(request: Request): Promise<Response> {
  const requestCanContainBody = request.method === 'GET' || request.method === 'HEAD';

  const response = await fetch(request.url, {
    method: request.method,
    headers: convertHeadersToObject(request.headers),
    body: requestCanContainBody ? undefined : await request.text(),
  });

  return new Response(response.status === 204 ? undefined : await response.text(), {
    status: response.status,
    statusText: response.statusText,
    headers: convertObjectToHeaders({ ...response.headers }),
  });
}
