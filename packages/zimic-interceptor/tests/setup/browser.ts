const DEFAULT_HEADERS: Record<string, string> = {
  // We need to disable caching by default to avoid double requests when running tests in a browser environment.
  'cache-control': 'no-store',
};

const originalFetch = globalThis.fetch;

function customFetch(input: string | URL | Request, init?: RequestInit) {
  const request = new Request(input, init);

  for (const [headerName, headerValue] of Object.entries(DEFAULT_HEADERS)) {
    if (!request.headers.has(headerName)) {
      request.headers.set(headerName, headerValue);
    }
  }

  return originalFetch(request);
}

globalThis.fetch = customFetch;
