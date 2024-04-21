import { JSONValue } from '..';

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

export function joinURL(...paths: string[]) {
  return paths
    .map((path, index) => {
      const isLast = index === paths.length - 1;
      const trimmedPath = path.trim();
      return isLast ? trimmedPath.replace(/^\/+/, '') : trimmedPath.replace(/^\/+|\/+$/, '');
    })
    .filter((path) => path.length > 0)
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

function convertReadableStreamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  return new Promise((resolve) => {
    function pump() {
      void reader.read().then(({ done, value }) => {
        if (done) {
          resolve(Buffer.concat(chunks));
          return;
        }

        chunks.push(value);
        pump();
      });
    }

    pump();
  });
}

function convertBufferToReadableStream(buffer: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(buffer);
    },
  });
}

export async function serializeRequest(request: Request): Promise<SerializedHttpRequest> {
  const bufferedBody = request.body ? await convertReadableStreamToBuffer(request.body) : null;

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
    body: bufferedBody?.toString('base64') ?? null,
  };
}

export function deserializeRequest(serializedRequest: SerializedHttpRequest): Request {
  const bufferedBody = serializedRequest.body ? Buffer.from(serializedRequest.body, 'base64') : null;

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
    body: bufferedBody ? convertBufferToReadableStream(bufferedBody) : null,
  });
}

export type SerializedResponse = JSONValue<{
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | null;
}>;

export async function serializeResponse(response: Response): Promise<SerializedResponse> {
  const bufferedBody = response.body ? await convertReadableStreamToBuffer(response.body) : null;

  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers),
    body: bufferedBody?.toString('base64') ?? null,
  };
}

export function deserializeResponse(serializedResponse: SerializedResponse): Response {
  const bufferedBody = serializedResponse.body ? Buffer.from(serializedResponse.body, 'base64') : null;

  return new Response(bufferedBody ? convertBufferToReadableStream(bufferedBody) : null, {
    status: serializedResponse.status,
    statusText: serializedResponse.statusText,
    headers: new Headers(serializedResponse.headers),
  });
}
