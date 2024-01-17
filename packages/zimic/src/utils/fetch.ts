export async function fetchWithTimeout(
  input: string | URL | Request,
  options: RequestInit & {
    timeout: number;
  },
) {
  const abortController = new AbortController();

  const abortTimeout = setTimeout(() => {
    abortController.abort();
  }, options.timeout);

  const fetchPromise = await fetch(input, options);
  clearTimeout(abortTimeout);

  return fetchPromise;
}
