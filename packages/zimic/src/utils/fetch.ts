import { JSONValue } from '@/types/json';

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
