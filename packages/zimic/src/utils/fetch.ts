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

export function joinURLPaths(...paths: string[]) {
  return paths.map((path) => path.replace(/^\/|\/$/g, '')).join('/');
}
