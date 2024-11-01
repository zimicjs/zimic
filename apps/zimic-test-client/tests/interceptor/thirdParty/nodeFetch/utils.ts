import fetch from 'node-fetch';

import { requestCanHaveBody } from '@tests/utils/bodies';
import { convertHeadersToObject, convertObjectToHeaders } from '@tests/utils/headers';

export async function nodeFetchAsFetch(request: Request): Promise<Response> {
  const response = await fetch(request.url, {
    method: request.method,
    headers: convertHeadersToObject(request.headers),
    body: requestCanHaveBody(request) ? await request.text() : undefined,
  });

  const responseBody = response.status === 204 ? undefined : await response.text();

  return new Response(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: convertObjectToHeaders(Object.fromEntries(response.headers)),
  });
}
