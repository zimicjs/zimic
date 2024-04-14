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
  return paths
    .map((path, index) => {
      const isLast = index === paths.length - 1;
      const trimmedPath = path.trim();
      return isLast ? trimmedPath.replace(/^\/+/, '') : trimmedPath.replace(/^\/+|\/+$/, '');
    })
    .filter((path) => path.length > 0)
    .join('/');
}
