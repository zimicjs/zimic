import { HttpMethod } from '@zimic/http';

export const HTTP_METHODS_WITH_REQUEST_BODY = new Set<HttpMethod>(['POST', 'PUT', 'PATCH', 'DELETE']);

export const HTTP_METHODS_WITH_RESPONSE_BODY = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]);

export function methodCanHaveResponseBody(method: HttpMethod) {
  return HTTP_METHODS_WITH_RESPONSE_BODY.has(method);
}

export const LOOPBACK_HOSTNAMES = Object.freeze(['localhost', '127.0.0.1', '::1']);

export function isLoopbackHostname(hostname: string) {
  return LOOPBACK_HOSTNAMES.includes(hostname.toLowerCase());
}
