import { JSONValue } from '..';

export interface ExtendedURL extends URL {
  raw: string;
}

export function createExtendedURL(
  rawURL: string | URL,
  options: {
    protocols?: string[];
  } = {},
) {
  const url = new URL(rawURL) as ExtendedURL;

  const protocol = url.protocol.replace(/:$/, '');

  if (options.protocols && !options.protocols.includes(protocol)) {
    throw new TypeError(`Expected URL with protocol (${options.protocols.join('|')}), but got '${protocol}'`);
  }

  Object.defineProperty(url, 'raw', {
    value: rawURL.toString(),
    writable: false,
    enumerable: true,
    configurable: false,
  });

  return url;
}

export function excludeDynamicParams(url: URL) {
  url.hash = '';
  url.search = '';
  url.username = '';
  url.password = '';
  return url;
}

export function createRegexFromURL(url: string) {
  const urlWithReplacedPathParams = url.replace(/\/:([^/]+)/g, '/(?<$1>[^/]+)').replace(/(\/+)$/, '(?:$1)?');
  return new RegExp(`^${urlWithReplacedPathParams}$`);
}

export async function fetchWithTimeout(url: URL | RequestInfo, options: RequestInit & { timeout: number }) {
  const abort = new AbortController();

  const timeout = setTimeout(() => {
    abort.abort();
  }, options.timeout);

  try {
    const result = await fetch(url, { ...options, signal: abort.signal });
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

export function joinURL(...parts: (string | URL)[]) {
  return parts
    .map((part, index) => {
      const partAsString = part.toString();
      const isLastPath = index === parts.length - 1;
      return isLastPath ? partAsString.replace(/^[/ ]+/, '') : partAsString.replace(/^[/ ]+|[/ ]+$/, '');
    })
    .filter((part) => part.length > 0)
    .join('/');
}

export type SerializedHttpRequest = JSONValue<{
  url: string;
  method: string;
  mode: RequestMode;
  headers: Record<string, string>;
  cache: RequestCache;
  credentials: RequestCredentials;
  integrity: string;
  keepalive: boolean;
  redirect: RequestRedirect;
  referrer: string;
  referrerPolicy: ReferrerPolicy;
  body: string | null;
}>;

export async function serializeRequest(request: Request): Promise<SerializedHttpRequest> {
  const requestClone = request.clone();
  const serializedBody = request.body ? await requestClone.text() : null;

  return {
    url: request.url,
    method: request.method,
    mode: request.mode,
    headers: Object.fromEntries(request.headers),
    cache: request.cache,
    credentials: request.credentials,
    integrity: request.integrity,
    keepalive: request.keepalive,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    body: serializedBody,
  };
}

export function deserializeRequest(serializedRequest: SerializedHttpRequest): Request {
  return new Request(serializedRequest.url, {
    method: serializedRequest.method,
    mode: serializedRequest.mode,
    headers: new Headers(serializedRequest.headers),
    cache: serializedRequest.cache,
    credentials: serializedRequest.credentials,
    integrity: serializedRequest.integrity,
    keepalive: serializedRequest.keepalive,
    redirect: serializedRequest.redirect,
    referrer: serializedRequest.referrer,
    referrerPolicy: serializedRequest.referrerPolicy,
    body: serializedRequest.body,
  });
}

export type SerializedResponse = JSONValue<{
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | null;
}>;

export async function serializeResponse(response: Response): Promise<SerializedResponse> {
  const responseClone = response.clone();
  const serializedBody = response.body ? await responseClone.text() : null;

  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers),
    body: serializedBody,
  };
}

export function deserializeResponse(serializedResponse: SerializedResponse): Response {
  return new Response(serializedResponse.body, {
    status: serializedResponse.status,
    statusText: serializedResponse.statusText,
    headers: new Headers(serializedResponse.headers),
  });
}
