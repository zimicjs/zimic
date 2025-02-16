import { requestCanHaveBody } from '@tests/utils/bodies';
import { convertHeadersToObject, convertObjectToHeaders } from '@tests/utils/headers';
import { createCachedDynamicImport } from '@tests/utils/imports';

export const importNodeFetch = createCachedDynamicImport(() => import('node-fetch'));

export async function nodeFetchAsFetch(request: Request): Promise<Response> {
  const { default: fetch } = await importNodeFetch();

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
