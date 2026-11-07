import { excludeNonPathParams } from '@zimic/utils/url';

// Base URLs match URLs by prefix, so a URL extending the last path segment of a base URL also matches. A base URL at the
// root path is a bare origin, though, so the origins must also be equal to not match other ports or hosts.
export function isURLUnderBaseURL(url: string, baseURL: string) {
  return url.startsWith(baseURL) && new URL(url).origin === new URL(baseURL).origin;
}

// Base URLs at the root path are bare origins, so a URL at the root path is matched without its slash.
export function createPathMatchingURL(url: string) {
  const urlWithoutNonPathParams = excludeNonPathParams(new URL(url));

  return urlWithoutNonPathParams.href === `${urlWithoutNonPathParams.origin}/`
    ? urlWithoutNonPathParams.origin
    : urlWithoutNonPathParams.href;
}

export function parsePathParams(url: string, baseURL: string, pathRegex: RegExp | undefined) {
  const path = url.replace(baseURL, '');
  const paramsMatch = pathRegex?.exec(path);

  const params: Record<string, string | undefined> = {};

  for (const [paramName, paramValue] of Object.entries(paramsMatch?.groups ?? {})) {
    params[paramName] = typeof paramValue === 'string' ? decodeURIComponent(paramValue) : undefined;
  }

  return params;
}
