import { JSONValue } from '@/types/json';

import { convertArrayBufferToBase64, convertBase64ToArrayBuffer } from './data';

export async function fetchWithTimeout(url: URL | RequestInfo, options: RequestInit & { timeout: number }) {
  const { timeout: timeoutDuration, ...fetchOptions } = options;

  const abort = new AbortController();

  const timeout =
    timeoutDuration > 0
      ? setTimeout(() => {
          abort.abort();
        }, timeoutDuration)
      : undefined;

  try {
    const result = await fetch(url, { ...fetchOptions, signal: abort.signal });
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
  const serializedBody = requestClone.body ? convertArrayBufferToBase64(await requestClone.arrayBuffer()) : null;

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
  const deserializedBody = serializedRequest.body ? convertBase64ToArrayBuffer(serializedRequest.body) : null;

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
    body: deserializedBody,
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
  const serializedBody = responseClone.body ? convertArrayBufferToBase64(await responseClone.arrayBuffer()) : null;

  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers),
    body: serializedBody,
  };
}

export function deserializeResponse(serializedResponse: SerializedResponse): Response {
  const deserializedBody = serializedResponse.body ? convertBase64ToArrayBuffer(serializedResponse.body) : null;

  return new Response(deserializedBody, {
    status: serializedResponse.status,
    statusText: serializedResponse.statusText,
    headers: new Headers(serializedResponse.headers),
  });
}
